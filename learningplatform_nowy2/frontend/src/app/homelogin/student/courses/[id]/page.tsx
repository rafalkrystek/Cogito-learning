"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
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
    // Ignore cache errors
  }
}

function StudentCourseDetailContent() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const courseId = params?.id;

  const [course, setCourse] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourseData = useCallback(async () => {
    if (!courseId || !user) return;
    
    const cacheKey = `student_course_detail_${courseId}_${user.uid}`;
    const cached = getSessionCache<{
      course: any;
      sections: any[];
      quizzes: any[];
    }>(cacheKey);
    
    if (cached) {
      setCourse(cached.course);
      setSections(cached.sections);
      setQuizzes(cached.quizzes);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Pobierz dane kursu
      const courseData = await measureAsync('StudentCourseDetail:fetchCourse', async () => {
        const courseDoc = await getDoc(doc(db, "courses", String(courseId)));
        
        if (!courseDoc.exists()) {
          setError("Nie znaleziono kursu.");
          setLoading(false);
          return null;
        }

        const courseData = courseDoc.data();
        
        // Sprawdź dostęp do kursu
        const assignedUsers = courseData.assignedUsers || [];
        const assignedClasses = courseData.assignedClasses || [];
        const isAdmin = user?.role === 'admin';
        const userEmail = user?.email?.trim().toLowerCase();
        const userUid = user?.uid;
        
        // Sprawdź dostęp przez email lub uid
        const hasEmailAccess = userEmail && assignedUsers.some((assigned: any) => 
          String(assigned).trim().toLowerCase() === userEmail
        );
        const hasUidAccess = userUid && assignedUsers.some((assigned: any) => 
          String(assigned) === userUid
        );
        
        let hasAccess = isAdmin || hasEmailAccess || hasUidAccess;
        
        // Jeśli nie ma dostępu, sprawdź klasy
        if (!hasAccess) {
          const userClasses = (user as any).classes;
          if (Array.isArray(userClasses) && userClasses.length > 0 && assignedClasses.length > 0) {
            hasAccess = assignedClasses.some((classId: string) =>
              userClasses.some((userClass: any) => String(userClass) === String(classId))
            );
          }
        }
        
        if (!hasAccess) {
          setError("Nie masz dostępu do tego kursu. Skontaktuj się z nauczycielem.");
          setLoading(false);
          return null;
        }
        
        // Pobierz quizy
        const quizzesSnapshot = await getDocs(query(collection(db, "quizzes"), where("courseId", "==", String(courseId))));
        
        const quizzesData = quizzesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        return {
          course: courseData,
          sections: courseData.sections || [],
          quizzes: quizzesData
        };
      });
      
      if (courseData) {
        setCourse(courseData.course);
        setSections(courseData.sections);
        setQuizzes(courseData.quizzes);
        setSessionCache(cacheKey, courseData);
      }
    } catch (err) {
      console.error("Error fetching course:", err);
      setError("Błąd podczas ładowania kursu.");
    } finally {
      setLoading(false);
    }
  }, [courseId, user]);

  useEffect(() => {
    if (!authLoading && courseId && user) {
      fetchCourseData();
    }
  }, [authLoading, courseId, user, fetchCourseData]);

  if (authLoading || loading) {
  return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Ładowanie kursu...</p>
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
      isTeacherPreview={false}
    />
  );
}

export default function StudentCourseDetail() {
  return (
    <Providers>
      <StudentCourseDetailContent />
    </Providers>
  );
}