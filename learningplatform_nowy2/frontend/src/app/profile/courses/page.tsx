'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import useApi from '@/hooks/useApi';
import Image from 'next/image';
import ThemeToggle from '@/components/ThemeToggle';

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  level: string;
  is_enrolled: boolean;
  progress: number;
  lastAccessed: string | null;
  total_lessons: number;
  completed_lessons: number;
}

interface UserCoursesResponse {
  enrolled_courses: Course[];
  available_courses: Course[];
  all_courses: Course[];
}

export default function CoursesPage() {
  const { user } = useAuth();
  const api = useApi();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCourses = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await api.get<UserCoursesResponse>('/api/user-courses/');
      setCourses(data.all_courses ?? []);
    } catch (err) {
      if (err instanceof Error) {
        console.error('Error loading courses:', err.message);
        setError(err.message);
      } else {
        console.error('Error loading courses:', err);
        setError('Nie udało się załadować kursów');
      }
    } finally {
      setLoading(false);
    }
  }, [user, api, setCourses, setLoading, setError]);

  const enrollInCourse = useCallback(async (courseId: string) => {
    try {
      await api.post('/api/enroll-course/', { course_id: courseId });
      // Odśwież listę kursów
      await loadCourses();
    } catch (err) {
      if (err instanceof Error) {
        console.error('Error enrolling in course:', err.message);
        setError(err.message);
      } else {
        console.error('Error enrolling in course:', err);
        setError('Nie udało się zapisać na kurs');
      }
    }
  }, [api, loadCourses, setError]);

  useEffect(() => {
    loadCourses();
  }, [user, loadCourses, api]);

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Zaloguj się</h2>
          <p className="text-gray-600">Musisz być zalogowany, aby zobaczyć kursy.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 relative w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      
      <h1 className="text-3xl font-bold mb-8">Moje kursy</h1>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#4067EC] border-t-transparent"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div key={course.id} className="bg-white rounded-xl shadow-md overflow-hidden">
              <Image
                src={course.thumbnail || '/default-course-thumbnail.png'}
                alt={course.title}
                width={400}
                height={192}
                className="w-full h-48 object-cover"
              />
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold">{course.title}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    course.level === 'beginner' ? 'bg-green-100 text-green-800' :
                    course.level === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {course.level}
                  </span>
                </div>
                
                <p className="text-gray-600 mb-4 line-clamp-3">{course.description}</p>
                
                {course.is_enrolled ? (
                  <div>
                    <div className="mb-2">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Postęp</span>
                        <span>{course.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-[#4067EC] h-2 rounded-full transition-all duration-300"
                          style={{ width: `${course.progress}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-500 mb-4">
                      {course.completed_lessons} z {course.total_lessons} lekcji ukończonych
                    </div>
                    
                    <button
                      onClick={() => window.location.href = `/courses/${course.id}`}
                      className="w-full bg-[#4067EC] text-white py-2 px-4 rounded-lg hover:bg-[#5577FF] transition-colors"
                    >
                      Kontynuuj naukę
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => enrollInCourse(course.id)}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Zapisz się na kurs
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && courses.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">Nie znaleziono żadnych kursów.</p>
        </div>
      )}
    </div>
  );
} 
