"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/config/firebase";
import Providers from '@/components/Providers';
import { CourseViewShared } from "@/components/CourseViewShared";
import { ArrowLeft } from 'lucide-react';
import { measureAsync } from '@/utils/perf';

// Cache helpers
const CACHE_TTL_MS = 60 * 1000; // 60s

function getSessionCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { timestamp: number; data: T };
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function setSessionCache<T>(key: string, data: T) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    // Ignore storage errors
  }
}

function TeacherCoursePreviewContent() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const courseId = params?.id;

  const [course, setCourse] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourseData = useCallback(async () => {
    if (!courseId || !user || authLoading) return;

    setLoading(true);
    try {
      await measureAsync('TeacherCoursePreview:fetchCourseData', async () => {
        // Check cache
        const cacheKey = `teacher_course_preview_${courseId}`;
        const cached = getSessionCache<{ course: any; sections: any[]; quizzes: any[] }>(cacheKey);
        
        if (cached) {
          setCourse(cached.course);
          setSections(cached.sections);
          setQuizzes(cached.quizzes);
          setLoading(false);
          return;
        }

        // Fetch course and quizzes in parallel
        const [courseDoc, quizzesSnapshot] = await Promise.all([
          getDoc(doc(db, "courses", String(courseId))),
          getDocs(query(collection(db, "quizzes"), where("courseId", "==", String(courseId)), limit(50)))
        ]);
        
        if (!courseDoc.exists()) {
          setError("Nie znaleziono kursu.");
          setLoading(false);
          return;
        }

        const courseData = courseDoc.data();
        
        // Check access
        if (user.role !== 'admin' && courseData.created_by !== user.email && courseData.teacherEmail !== user.email) {
          setError("Nie masz dostępu do tego kursu.");
          setLoading(false);
          return;
        }

        const sectionsData = courseData.sections || [];
        const quizzesData = quizzesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setCourse(courseData);
        setSections(sectionsData);
        setQuizzes(quizzesData);
        
        // Cache the data
        setSessionCache(cacheKey, {
          course: courseData,
          sections: sectionsData,
          quizzes: quizzesData
        });
      });
    } catch (err) {
      console.error("Error fetching course:", err);
      setError("Błąd podczas ładowania kursu.");
    } finally {
      setLoading(false);
    }
  }, [courseId, user, authLoading]);

  useEffect(() => {
    if (!authLoading) {
      fetchCourseData();
    }
  }, [fetchCourseData, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Ładowanie podglądu kursu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Błąd</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Powrót</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <CourseViewShared
      course={course}
      sections={sections}
      quizzes={quizzes}
      isTeacherPreview={true}
    />
  );
}

export default function TeacherCoursePreview() {
  return (
    <Providers>
      <TeacherCoursePreviewContent />
    </Providers>
  );
}
