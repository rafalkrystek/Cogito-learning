'use client';

// Force dynamic rendering to prevent SSR issues with client-side hooks
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

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

    try {
      // 1. Znajdź przypisanego ucznia
      const parentStudentsRef = collection(db, 'parent_students');
      const parentStudentsQuery = query(parentStudentsRef, where('parent', '==', user.uid));
      const parentStudentsSnapshot = await getDocs(parentStudentsQuery);

      if (parentStudentsSnapshot.empty) {
        setError('Nie masz przypisanego żadnego ucznia.');
        setLoading(false);
        return;
      }

      const studentId = parentStudentsSnapshot.docs[0].data().student;

      // 2. Pobierz dane ucznia
      const studentDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', studentId)));
      if (studentDoc.empty) {
        setError('Nie znaleziono danych ucznia.');
        setLoading(false);
        return;
      }

      const studentData = studentDoc.docs[0].data();

      // 3. Pobierz kursy ucznia
      const coursesRef = collection(db, 'courses');
      const coursesSnapshot = await getDocs(coursesRef);
      const studentCourses = coursesSnapshot.docs
        .filter(doc => doc.data().students?.includes(studentId))
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

      // 4. Pobierz dane nauczycieli
      const teacherIds = [...new Set(studentCourses.map(course => (course as any).teacher))];
      const teachersData = await Promise.all(
        teacherIds.map(async (teacherId) => {
          const teacherDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', teacherId)));
          const teacherData = teacherDoc.docs[0]?.data() || {};

          const teacherCourses = studentCourses
            .filter(course => (course as any).teacher === teacherId)
            .map(course => ({
              id: course.id,
              title: (course as any).title
            }));

          return {
            id: teacherId,
            name: teacherData.displayName || teacherData.email,
            email: teacherData.email,
            bio: teacherData.bio,
            courses: teacherCourses
          };
        })
      );

      setAssignedStudent({
        id: studentId,
        name: studentData.displayName || studentData.email,
        email: studentData.email,
        teachers: teachersData
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
    <div className="container mx-auto px-4 py-8 w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
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
  );
} 