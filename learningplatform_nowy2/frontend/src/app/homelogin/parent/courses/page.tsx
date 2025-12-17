'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { collection, getDocs, query, where, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import Providers from '@/components/Providers';
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
  iconUrl?: string;
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

function ParentCoursesContent() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentData, setStudentData] = useState<any>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const coursesPerPage = 12; // Responsive: 12 na desktop, mniej na mobile

  // Pobierz przypisanego ucznia
  const fetchAssignedStudent = useCallback(async () => {
    if (!user) return;

    const cacheKey = `parent_student_${user.uid}`;
    const cached = getSessionCache<{ studentId: string; studentData: any; displayName: string }>(cacheKey);
    
    if (cached) {
      setStudentId(cached.studentId);
      setStudentData(cached.studentData);
      setDisplayName(cached.displayName);
      return;
    }

    try {
      // 1. Znajdź przypisanego ucznia
      const parentStudentsRef = collection(db, 'parent_students');
      const parentStudentsQuery = query(parentStudentsRef, where('parent', '==', user.uid));
      const parentStudentsSnapshot = await getDocs(parentStudentsQuery);

      if (parentStudentsSnapshot.empty) {
        setLoading(false);
        return;
      }

      const foundStudentId = parentStudentsSnapshot.docs[0].data().student;
      
      // 2. Pobierz dane ucznia
      const studentDoc = await getDoc(doc(db, 'users', foundStudentId));
      if (studentDoc.exists()) {
        const student = studentDoc.data();
        const displayNameValue = student.displayName || 
          `${student.firstName || ''} ${student.lastName || ''}`.trim() || 
          student.email || 
          'Uczeń';
        
        setStudentId(foundStudentId);
        setStudentData(student);
        setDisplayName(displayNameValue);
        
        // Cache student data
        setSessionCache(cacheKey, {
          studentId: foundStudentId,
          studentData: student,
          displayName: displayNameValue
        });
      }
    } catch (error) {
      console.error('Error fetching assigned student:', error);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAssignedStudent();
  }, [fetchAssignedStudent]);

  // Pobierz kursy dla przypisanego ucznia
  const fetchCourses = useCallback(async () => {
    if (!studentId || !studentData) return;
    
    const cacheKey = `parent_courses_${studentId}`;
    const cached = getSessionCache<Course[]>(cacheKey);
    
    if (cached) {
      setCourses(cached);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      await measureAsync('ParentCourses:fetchCourses', async () => {
        // Pobierz kursy przypisane do ucznia - użyj where zamiast pobierać wszystkie
        const coursesCollection = collection(db, 'courses');
        
        // Pobierz kursy gdzie assignedUsers zawiera studentId lub email
        const [coursesByUid, coursesByEmail, coursesByClass] = await Promise.all([
          getDocs(query(coursesCollection, where('assignedUsers', 'array-contains', studentId), limit(100))),
          studentData.email ? getDocs(query(coursesCollection, where('assignedUsers', 'array-contains', studentData.email), limit(100))) : Promise.resolve({ docs: [] } as any),
          studentData.classes && Array.isArray(studentData.classes) && studentData.classes.length > 0
            ? Promise.all(
                studentData.classes.slice(0, 10).map((classId: string) =>
                  getDocs(query(coursesCollection, where('assignedClasses', 'array-contains', classId), limit(100)))
                )
              ).then(snapshots => {
                const allDocs: any[] = [];
                snapshots.forEach(snapshot => allDocs.push(...snapshot.docs));
                return { docs: allDocs };
              })
            : Promise.resolve({ docs: [] } as any)
        ]);
        
        // Połącz i deduplikuj kursy
        const coursesMap = new Map();
        [...coursesByUid.docs, ...coursesByEmail.docs, ...coursesByClass.docs].forEach(doc => {
          coursesMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
        
        const relevantCourses = Array.from(coursesMap.values());
        
        // Pobierz postęp ucznia - użyj where zamiast pobierać wszystkie
        const progressCollection = collection(db, 'progress');
        const [progressByStudentId, progressByUserId] = await Promise.all([
          getDocs(query(progressCollection, where('studentId', '==', studentId), limit(500))),
          getDocs(query(progressCollection, where('user_id', '==', studentId), limit(500)))
        ]);
        
        // Utwórz mapę postępu: lessonId -> progress data
        const progressMap = new Map();
        [...progressByStudentId.docs, ...progressByUserId.docs].forEach(doc => {
          const data = doc.data();
          const lessonId = data.lessonId || data.lesson_id || data.lesson;
          if (lessonId) {
            progressMap.set(lessonId, data);
          }
        });

        // Pobierz wszystkie unikalne teacher IDs
        const teacherIds = new Set<string>();
        relevantCourses.forEach((course: any) => {
          if (course.teacher) teacherIds.add(course.teacher);
        });
        
        // Pobierz dane nauczycieli równolegle (N+1 fix)
        const teachersMap = new Map<string, string>();
        if (teacherIds.size > 0) {
          const teacherQueries = Array.from(teacherIds).slice(0, 50).map(teacherId =>
            getDoc(doc(db, 'users', teacherId)).then(teacherDoc => {
              if (teacherDoc.exists()) {
                const teacher = teacherDoc.data();
                return { id: teacherId, name: teacher.displayName || teacher.email || 'Nieznany nauczyciel' };
              }
              return { id: teacherId, name: 'Nieznany nauczyciel' };
            }).catch(() => ({ id: teacherId, name: 'Nieznany nauczyciel' }))
          );
          
          const teachers = await Promise.all(teacherQueries);
          teachers.forEach(teacher => {
            teachersMap.set(teacher.id, teacher.name);
          });
        }

        // Przetwórz kursy - oblicz postęp z sekcji kursu zamiast pobierać wszystkie moduły/lekcje
        const userCourses = await Promise.all(
          relevantCourses.map(async (course: any) => {
            // Oblicz postęp z sekcji kursu (jeśli są)
            let totalLessons = 0;
            let completedLessons = 0;
            let lastAccessed: string | null = null;

            if (course.sections && Array.isArray(course.sections)) {
              course.sections.forEach((section: any) => {
                if (section.subsections && Array.isArray(section.subsections)) {
                  section.subsections.forEach((subsection: any) => {
                    totalLessons++;
                    const progressData = progressMap.get(String(subsection.id));
                    if (progressData) {
                      if (progressData.completed) {
                        completedLessons++;
                      }
                      const lessonLastAccessed = progressData.lastViewed || progressData.last_viewed;
                      if (lessonLastAccessed) {
                        if (!lastAccessed || new Date(lessonLastAccessed) > new Date(lastAccessed)) {
                          lastAccessed = lessonLastAccessed;
                        }
                      }
                    }
                  });
                }
              });
            }

            const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

            // Pobierz dane nauczyciela z mapy
            let teacherName = 'Nieznany nauczyciel';
            if (course.instructor_name) {
              teacherName = course.instructor_name;
            } else if (course.teacher && teachersMap.has(course.teacher)) {
              teacherName = teachersMap.get(course.teacher)!;
            } else if (course.teacherName) {
              teacherName = course.teacherName;
            } else if (course.teacherEmail) {
              teacherName = course.teacherEmail;
            } else if (course.created_by) {
              teacherName = course.created_by;
            }

            return {
              id: course.id,
              title: course.title || 'Brak tytułu',
              description: course.description || 'Brak opisu',
              subject: course.subject || 'Brak przedmiotu',
              yearOfStudy: course.year_of_study || 1,
              isActive: course.is_active !== false,
              teacherName: teacherName,
              progress: progress,
              lastAccessed: lastAccessed || course.updated_at || course.created_at || new Date().toISOString(),
              totalLessons: totalLessons,
              completedLessons: completedLessons,
              iconUrl: course.iconUrl || ''
            };
          })
        );

        setCourses(userCourses);
        setSessionCache(cacheKey, userCourses);
      });
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  }, [studentId, studentData]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Filtruj kursy - memoized
  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      const matchesSubject = selectedSubject === 'all' || course.subject === selectedSubject;
      const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           course.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSubject && matchesSearch;
    });
  }, [courses, selectedSubject, searchTerm]);

  // Paginacja - memoized
  const paginatedCourses = useMemo(() => {
    const startIndex = (currentPage - 1) * coursesPerPage;
    const endIndex = startIndex + coursesPerPage;
    return filteredCourses.slice(startIndex, endIndex);
  }, [filteredCourses, currentPage, coursesPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredCourses.length / coursesPerPage);
  }, [filteredCourses.length, coursesPerPage]);

  // Pobierz unikalne przedmioty - memoized
  const subjects = useMemo(() => {
    return ['all', ...Array.from(new Set(courses.map(c => c.subject)))];
  }, [courses]);

  const getProgressColor = useCallback((progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 60) return 'bg-blue-500';
    if (progress >= 40) return 'bg-yellow-500';
    if (progress >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  }, []);

  const handlePrevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  }, [totalPages]);



  if (loading) {
    return (
      <div className="h-screen overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#4067EC] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Ładowanie kursów...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full">
      {/* Header bez przycisku powrotu */}
      <div className="flex-shrink-0 bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Kursy Dziecka
        </h1>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col px-4 sm:px-6 lg:px-8 py-4 min-h-0">
        <div className="bg-white/90 backdrop-blur-xl w-full h-full p-4 md:p-6 rounded-2xl shadow-lg border border-white/20 flex flex-col min-h-0 overflow-hidden">
          <p className="text-gray-600 mb-4 flex-shrink-0">
            {displayName ? `Kursy przypisane do ${displayName}` : 'Kursy przypisane do Twojego podopiecznego'}
          </p>
        
          {/* Filtry i wyszukiwanie */}
          <div className="flex flex-col md:flex-row gap-4 mb-4 flex-shrink-0">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Wyszukaj kursy..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-transparent text-base"
                style={{ fontSize: '16px' }}
              />
            </div>
            
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-transparent text-base"
              style={{ fontSize: '16px' }}
            >
              {subjects.map(subject => (
                <option key={subject} value={subject}>
                  {subject === 'all' ? 'Wszystkie przedmioty' : subject}
                </option>
              ))}
            </select>
          </div>

          {filteredCourses.length === 0 ? (
            <div className="text-center py-12 flex-1 flex items-center justify-center min-h-0 overflow-hidden">
              <div>
                <div className="text-gray-400 text-6xl mb-4">📚</div>
                <h3 className="text-xl font-semibold text-gray-600 mb-2">Brak kursów</h3>
                <p className="text-gray-500">
                  {courses.length === 0 
                    ? 'Twój podopieczny nie ma jeszcze przypisanych kursów.'
                    : 'Nie znaleziono kursów spełniających kryteria wyszukiwania.'
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-hidden min-h-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 content-start pb-4">
                  {paginatedCourses.map((course) => {
                return (
                  <div key={course.id} className="bg-white rounded-xl border border-gray-200 hover:border-[#4067EC] transition-all duration-300 hover:shadow-lg overflow-hidden flex flex-col">
                    {/* Course Header */}
                    <div className="p-4 flex-1 flex flex-col">
                      <div className={`w-12 h-12 ${course.iconUrl ? 'bg-transparent' : 'bg-[#4067EC]'} rounded-lg flex items-center justify-center text-white text-xl font-bold mb-3 overflow-hidden`}>
                        {course.iconUrl ? (
                          <Image
                            src={course.iconUrl}
                            alt={course.title || 'Course icon'}
                            width={48}
                            height={48}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          course.title.charAt(0).toUpperCase()
                        )}
                      </div>
                      <h3 className="font-semibold text-base text-gray-800 mb-2 line-clamp-2">
                        {course.title}
                      </h3>
                      <p className="text-xs text-gray-600 mb-3 line-clamp-2 flex-1">
                        {course.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="px-2 py-1 bg-[#4067EC] text-white rounded-full text-xs">
                          {course.subject}
                        </span>
                        <span className="text-xs text-gray-600">
                          {course.progress}%
                        </span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(course.progress)}`}
                            style={{ width: `${course.progress}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {course.completedLessons} z {course.totalLessons} lekcji
                        </div>
                      </div>
                      
                      {/* Course Info */}
                      <div className="space-y-1 mb-3 text-xs text-gray-600">
                        <div className="flex items-center justify-between">
                          <span>Nauczyciel:</span>
                          <span className="truncate ml-2">{course.teacherName}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Rok:</span>
                          <span>{course.yearOfStudy}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="p-4 border-t border-gray-100 flex gap-2">
                      <Link
                        href={`/homelogin/parent/courses/${course.id}`}
                        className="flex-1 bg-[#4067EC] text-white py-2 px-3 rounded-lg text-xs font-medium hover:bg-[#3050b3] transition-colors text-center"
                      >
                        Zobacz szczegóły
                      </Link>
                    </div>
                  </div>
                );
              })}
                </div>
              </div>
              
              {/* Paginacja */}
              {totalPages > 1 && (
                <div className="flex-shrink-0 flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    Strona {currentPage} z {totalPages} ({filteredCourses.length} kursów)
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePrevPage}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-[#4067EC] text-white rounded-lg hover:bg-[#3050b3] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      Poprzednia
                    </button>
                    <button
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-[#4067EC] text-white rounded-lg hover:bg-[#3050b3] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      Następna
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ParentCoursesPage() {
  return (
    <Providers>
      <ParentCoursesContent />
    </Providers>
  );
}
