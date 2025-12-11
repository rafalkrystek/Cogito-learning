'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import useApi from '@/hooks/useApi';

interface Course {
  id: string;
  title: string;
}

interface DebugData {
  user_id: string;
  username: string;
  progress_count: number;
  all_courses: Course[];
  enrolled_courses: Course[];
  user_courses_reverse: Course[];
}

export default function DebugPage() {
  const { user } = useAuth();
  const api = useApi();
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkUserCourses = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const data = await api.get<DebugData>('/api/debug-user-courses/');
      setDebugData(data);
      console.log('Debug data:', data);
    } catch (err) {
      console.error('Error checking user courses:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Nie udało się sprawdzić kursów');
      }
    } finally {
      setLoading(false);
    }
  }, [user, api, setDebugData, setLoading, setError]);

  useEffect(() => {
    if (user) {
      checkUserCourses();
    }
  }, [user, checkUserCourses]);

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Zaloguj się</h2>
          <p className="text-gray-600">Musisz być zalogowany, aby zobaczyć debug.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      <h1 className="text-3xl font-bold mb-8">Debug - Przypisania kursów</h1>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={checkUserCourses}
        disabled={loading}
        className="mb-8 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {loading ? 'Sprawdzanie...' : 'Sprawdź kursy'}
      </button>

      {debugData && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Informacje o użytkowniku</h2>
            <p><strong>ID:</strong> {debugData.user_id}</p>
            <p><strong>Username:</strong> {debugData.username}</p>
            <p><strong>Progress records:</strong> {debugData.progress_count}</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Wszystkie kursy ({debugData.all_courses.length})</h2>
            <ul className="space-y-2">
              {debugData.all_courses.map((course: Course) => (
                <li key={course.id} className="p-2 bg-gray-50 rounded">
                  {course.title} (ID: {course.id})
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Zapisane kursy ({debugData.enrolled_courses.length})</h2>
            <ul className="space-y-2">
              {debugData.enrolled_courses.map((course: Course) => (
                <li key={course.id} className="p-2 bg-green-50 rounded border border-green-200">
                  ✅ {course.title} (ID: {course.id})
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Kursy przez relację wsteczną ({debugData.user_courses_reverse.length})</h2>
            <ul className="space-y-2">
              {debugData.user_courses_reverse.map((course: Course) => (
                <li key={course.id} className="p-2 bg-blue-50 rounded border border-blue-200">
                  🔄 {course.title} (ID: {course.id})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
} 