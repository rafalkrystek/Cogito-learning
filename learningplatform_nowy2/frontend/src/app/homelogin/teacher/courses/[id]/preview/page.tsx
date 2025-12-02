"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/config/firebase";
import Providers from '@/components/Providers';
import { CourseViewShared } from "@/components/CourseViewShared";
import { ArrowLeft } from 'lucide-react';

function TeacherCoursePreviewContent() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const courseId = params?.id;

  const [course, setCourse] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourseData = async () => {
      if (!courseId || !user) return;

      setLoading(true);
      try {
        // Pobierz dane kursu
        const courseDoc = await getDoc(doc(db, "courses", String(courseId)));
        
        if (!courseDoc.exists()) {
          setError("Nie znaleziono kursu.");
          setLoading(false);
          return;
        }

        const courseData = courseDoc.data();
        
        // Sprawdź czy nauczyciel ma dostęp do tego kursu
        if (user.role !== 'admin' && courseData.created_by !== user.email && courseData.teacherEmail !== user.email) {
          setError("Nie masz dostępu do tego kursu.");
          setLoading(false);
          return;
        }

        setCourse(courseData);
        setSections(courseData.sections || []);

        // Pobierz quizy przypisane do tego kursu
        const quizzesQuery = query(
          collection(db, "quizzes"),
          where("courseId", "==", String(courseId))
        );
        const quizzesSnapshot = await getDocs(quizzesQuery);
        const quizzesData = quizzesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setQuizzes(quizzesData);

        setLoading(false);
      } catch (err) {
        console.error("Error fetching course:", err);
        setError("Błąd podczas ładowania kursu.");
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchCourseData();
    }
  }, [courseId, user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Ładowanie podglądu kursu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Błąd</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Powrót
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
