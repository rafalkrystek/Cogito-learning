'use client';

// Force dynamic rendering to prevent SSR issues with client-side hooks
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/config/firebase';
import { collection, getDocs, query, where, limit, doc, getDoc } from 'firebase/firestore';
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

interface Teacher {
  id: string;
  name: string;
  email: string;
  bio?: string;
  courses: {
    id: string;
    title: string;
  }[];
}

interface AssignedStudent {
  id: string;
  name: string;
  email: string;
  teachers: Teacher[];
}

export default function ParentTutors() {
  const { user } = useAuth();
  const [assignedStudent, setAssignedStudent] = useState<AssignedStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAssignedStudentData = useCallback(async () => {
    if (!user) return;

    const cacheKey = `parent_tutors_${user.uid}`;
    const cached = getSessionCache<AssignedStudent>(cacheKey);
    
    if (cached) {
      setAssignedStudent(cached);
      setLoading(false);
      return;
    }

    try {
      await measureAsync('ParentTutors:fetchAssignedStudentData', async () => {
        // 1. Znajdź przypisanego ucznia
        const parentStudentsSnapshot = await getDocs(query(collection(db, 'parent_students'), where('parent', '==', user.uid)));

        if (parentStudentsSnapshot.empty) {
          setError('Nie masz przypisanego żadnego ucznia.');
          setLoading(false);
          return;
        }

        const studentId = parentStudentsSnapshot.docs[0].data().student;

        // 2. Pobierz dane ucznia i kursy równolegle
        const [studentSnapshot, coursesSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('uid', '==', studentId))),
          getDocs(query(collection(db, 'courses'), limit(200)))
        ]);
        
        if (studentSnapshot.empty) {
          setError('Nie znaleziono danych ucznia.');
          setLoading(false);
          return;
        }

        const studentData = studentSnapshot.docs[0].data();

        // 3. Filtruj kursy ucznia
        const studentCourses = coursesSnapshot.docs
          .filter(doc => {
            const courseData = doc.data();
            return courseData.students?.includes(studentId) ||
                   courseData.assignedUsers?.includes(studentId) ||
                   courseData.assignedUsers?.includes(studentData.email);
          })
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

        // 4. Pobierz dane nauczycieli równolegle (N+1 fix)
        const teacherIds = [...new Set(studentCourses.map(course => (course as any).teacher).filter(Boolean))];
        
        const teacherQueries = teacherIds.slice(0, 50).map(teacherId =>
          getDoc(doc(db, 'users', teacherId))
        );
        const teacherDocs = await Promise.all(teacherQueries);
        
        const teachersData = teacherDocs.map((teacherDoc, index) => {
          const teacherId = teacherIds[index];
          const teacherData = teacherDoc.exists() ? teacherDoc.data() : {};

          const teacherCourses = studentCourses
            .filter(course => (course as any).teacher === teacherId)
            .map(course => ({
              id: course.id,
              title: (course as any).title
            }));

          return {
            id: teacherId,
            name: teacherData.displayName || teacherData.email || 'Nieznany nauczyciel',
            email: teacherData.email || '',
            bio: teacherData.bio,
            courses: teacherCourses
          };
        });

        const assignedStudentData: AssignedStudent = {
          id: studentId,
          name: studentData.displayName || studentData.email,
          email: studentData.email,
          teachers: teachersData
        };
        
        setAssignedStudent(assignedStudentData);
        setSessionCache(cacheKey, assignedStudentData);
      });
    } catch (err) {
      console.error('Error fetching student data:', err);
      setError('Wystąpił błąd podczas pobierania danych.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAssignedStudentData();
  }, [user, fetchAssignedStudentData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4067EC]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (!assignedStudent) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          Nie masz jeszcze przypisanego ucznia.
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col w-full" style={{ maxWidth: '100vw' }}>
      <div className="flex-1 overflow-y-auto container mx-auto px-4 py-8 min-h-0">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Nauczyciele</h1>
        <p className="text-gray-600">
          {assignedStudent.name} ({assignedStudent.email})
        </p>
      </div>

      {assignedStudent.teachers.length === 0 ? (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          Brak nauczycieli do wyświetlenia.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assignedStudent.teachers.map((teacher) => (
            <div key={teacher.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-2">{teacher.name}</h2>
                <p className="text-gray-500 text-sm mb-4">{teacher.email}</p>
                
                {teacher.bio && (
                  <p className="text-gray-600 mb-4">{teacher.bio}</p>
                )}

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Prowadzone kursy:</h3>
                  <ul className="space-y-1">
                    {teacher.courses.map((course) => (
                      <li key={course.id} className="text-sm text-gray-900">
                        {course.title}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
} 