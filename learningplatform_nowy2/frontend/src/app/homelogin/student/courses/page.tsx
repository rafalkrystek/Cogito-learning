'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import Providers from '@/components/Providers';
import { ArrowLeft } from 'lucide-react';
import { measureAsync } from '@/utils/perf';

interface Course {
  id: string;
  title: string;
  description: string;
  subject: string;
  yearOfStudy: number;
  isActive: boolean;
  teacherName: string;
  progress: number;
  lastAccessed: string;
  totalLessons: number;
  completedLessons: number;
}

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

function StudentCoursesContent() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const coursesPerPage = 12; // Responsive: 12 na desktop, mniej na mobile

  const fetchCourses = useCallback(async () => {
    if (!user) return;
    
    const cacheKey = `student_courses_${user.uid}`;
    const cached = getSessionCache<Course[]>(cacheKey);
    
    if (cached) {
      setCourses(cached);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const coursesCollection = collection(db, 'courses');
      
      const userCourses = await measureAsync('StudentCourses:fetchCourses', async () => {
        // Firestore nie obsługuje OR w jednym zapytaniu, więc użyj dwóch równoległych zapytań
        const [coursesByUid, coursesByEmail] = await Promise.all([
          getDocs(query(coursesCollection, where('assignedUsers', 'array-contains', user.uid))),
          user.email ? getDocs(query(coursesCollection, where('assignedUsers', 'array-contains', user.email))) : Promise.resolve({ docs: [] } as any)
        ]);
        
        // Połącz i deduplikuj kursy
        const coursesMap = new Map();
        [...coursesByUid.docs, ...coursesByEmail.docs].forEach(doc => {
          coursesMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
        
        // Sprawdź kursy przypisane do klas (jeśli użytkownik ma klasy)
        if ((user as any).classes && Array.isArray((user as any).classes) && (user as any).classes.length > 0) {
          // Pobierz kursy dla każdej klasy równolegle
          const classQueries = (user as any).classes.map((classId: string) =>
            getDocs(query(coursesCollection, where('assignedClasses', 'array-contains', classId)))
          );
          const classSnapshots = await Promise.all(classQueries);
          classSnapshots.forEach(snapshot => {
            snapshot.docs.forEach((doc: any) => {
              if (!coursesMap.has(doc.id)) {
                coursesMap.set(doc.id, { id: doc.id, ...doc.data() });
              }
            });
          });
        }
        
        return Array.from(coursesMap.values())
          .map((course: any) => ({
            id: course.id,
            title: course.title || 'Brak tytułu',
            description: course.description || 'Brak opisu',
            subject: course.subject || 'Brak przedmiotu',
            yearOfStudy: course.year_of_study || 1,
            isActive: course.is_active !== false,
            teacherName: course.instructor_name || course.teacherName || course.teacherEmail || course.created_by || 'Nieznany nauczyciel',
            progress: course.progress || 0,
            lastAccessed: course.lastAccessed || course.updated_at || new Date().toISOString(),
            totalLessons: course.totalLessons || 0,
            completedLessons: course.completedLessons || 0
          }));
      });

      setCourses(userCourses);
      setSessionCache(cacheKey, userCourses);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Memoized filtered courses
  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      const matchesSubject = selectedSubject === 'all' || course.subject === selectedSubject;
      const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           course.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSubject && matchesSearch;
    });
  }, [courses, selectedSubject, searchTerm]);

  // Pagination
  const paginatedCourses = useMemo(() => {
    const startIndex = (currentPage - 1) * coursesPerPage;
    return filteredCourses.slice(startIndex, startIndex + coursesPerPage);
  }, [filteredCourses, currentPage, coursesPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredCourses.length / coursesPerPage);
  }, [filteredCourses.length, coursesPerPage]);

  // Memoized subjects
  const subjects = useMemo(() => {
    return ['all', ...Array.from(new Set(courses.map(c => c.subject)))];
  }, [courses]);

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 60) return 'bg-blue-500';
    if (progress >= 40) return 'bg-yellow-500';
    if (progress >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '/');
    } catch {
      return 'Nieznana data';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6FB] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#4067EC] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Ładowanie kursów...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Header z przyciskiem powrotu */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => window.location.href = '/homelogin'}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Powrót</span>
          </button>
          
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Moje kursy
          </h1>
          
          <div className="w-20"></div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="bg-white/90 backdrop-blur-xl w-full max-w-6xl mx-auto p-4 md:p-6 rounded-2xl shadow-lg border border-white/20">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Moje kursy <span className="inline-block">📚</span></h2>
          <p className="text-gray-600 mb-6">Kursy przypisane do Twojego konta</p>
        
        {/* Filtry i wyszukiwanie */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Wyszukaj kursy..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-transparent"
            />
          </div>
          
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-transparent"
          >
            {subjects.map(subject => (
              <option key={subject} value={subject}>
                {subject === 'all' ? 'Wszystkie przedmioty' : subject}
              </option>
            ))}
          </select>
        </div>

        {filteredCourses.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">Brak kursów</h3>
            <p className="text-gray-500">
              {courses.length === 0 
                ? 'Nie masz jeszcze przypisanych kursów.'
                : 'Nie znaleziono kursów spełniających kryteria wyszukiwania.'
              }
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {paginatedCourses.map((course) => (
              <div key={course.id} className="bg-white/90 backdrop-blur-xl rounded-xl p-4 md:p-6 border border-white/20 hover:border-[#4067EC] transition-all duration-300 hover:shadow-lg">
                {/* Course Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-16 h-16 bg-[#4067EC] rounded-lg flex items-center justify-center text-white text-2xl font-bold">
                    {course.title.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-800 mb-2 line-clamp-2">
                      {course.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {course.description}
                    </p>
                  </div>
                </div>
                
                {/* Course Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium">Przedmiot:</span>
                    <span className="px-2 py-1 bg-[#4067EC] text-white rounded-full text-xs">
                      {course.subject}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium">Rok:</span>
                    <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded-full text-xs">
                      {course.yearOfStudy}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium">Nauczyciel:</span>
                    <span className="text-gray-700">{course.teacherName}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium">Status:</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      course.isActive 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {course.isActive ? 'Aktywny' : 'Nieaktywny'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium">Ostatni dostęp:</span>
                    <span className="text-gray-700">{formatDate(course.lastAccessed)}</span>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span>Postęp</span>
                    <span>{course.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(course.progress)}`}
                      style={{ width: `${course.progress}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {course.completedLessons} z {course.totalLessons} lekcji ukończonych
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Link
                    href={`/courses/${course.id}`}
                    className="flex-1 bg-[#4067EC] text-white py-2 px-4 rounded-lg font-medium hover:bg-[#3050b3] transition-colors text-center"
                  >
                    Przejdź do kursu
                  </Link>
                  
                  <button className="px-3 py-2 text-[#4067EC] hover:bg-[#4067EC] hover:text-white rounded-lg transition-colors">
                    ⭐
                  </button>
                </div>
              </div>
              ))}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-[#4067EC] text-white rounded-lg hover:bg-[#3050b3] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Poprzednia
                </button>
                <span className="px-4 py-2 text-gray-700">
                  Strona {currentPage} z {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-[#4067EC] text-white rounded-lg hover:bg-[#3050b3] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Następna
                </button>
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}

export default function StudentCoursesPage() {
  return (
    <Providers>
      <StudentCoursesContent />
    </Providers>
  );
} 