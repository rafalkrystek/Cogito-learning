'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  BookOpen, 
  AlertCircle,
  Trophy
} from 'lucide-react';
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

interface Achievement {
  id: string;
  title: string;
  description: string;
  date: string;
  icon: string;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  currentLevel: number;
  currentProgress: number;
  nextLevelThreshold: number;
  levels: {
    name: string;
    threshold: number;
    color: string;
    gradient: string;
  }[];
}

interface Course {
  id: string;
  title: string;
  description?: string;
  subject?: string;
  thumbnail?: string;
}

interface TeacherProfile {
  id: string;
  fullName: string;
  displayName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  photoURL?: string;
  subject?: string;
  description?: string;
  experience?: string;
  specialization?: string[];
  availability?: string;
  activeCourses?: number;
  totalStudents?: number;
  averageRating?: number;
  achievements?: Achievement[];
}

export default function TeacherProfilePage() {
  const params = useParams();
  const router = useRouter();
  const teacherId = params?.id as string;
  
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);

  const fetchTeacherProfile = useCallback(async () => {
    if (!teacherId) return;
    
    const cacheKey = `student_teacher_profile_${teacherId}`;
    const cached = getSessionCache<{
      teacher: TeacherProfile;
      courses: Course[];
      badges: Badge[];
    }>(cacheKey);
    
    if (cached) {
      setTeacher(cached.teacher);
      setCourses(cached.courses);
      setBadges(cached.badges);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Pobierz dane nauczyciela
      const teacherData = await measureAsync('StudentTeacherProfile:fetchTeacher', async () => {
        const teacherDocRef = doc(db, 'users', teacherId);
        const teacherSnap = await getDoc(teacherDocRef);
        
        if (!teacherSnap.exists()) {
          throw new Error('Nauczyciel nie został znaleziony.');
        }
        
        return teacherSnap.data();
      });
      
      // Użyj statystyk z dokumentu (szybsze)
      let activeCourses = teacherData.activeCourses || 0;
      let totalStudents = teacherData.totalStudents || 0;
      let averageRating = teacherData.averageRating || 0;
      
      // Pobierz kursy nauczyciela równolegle (tylko raz!)
      const { teacherCourses, coursesMap, totalLessons } = await measureAsync('StudentTeacherProfile:fetchCourses', async () => {
        const coursesCollection = collection(db, 'courses');
        const [coursesByEmail, coursesByUid, coursesByTeacherEmail] = await Promise.all([
          getDocs(query(coursesCollection, where('created_by', '==', teacherData.email))),
          getDocs(query(coursesCollection, where('created_by', '==', teacherId))),
          getDocs(query(coursesCollection, where('teacherEmail', '==', teacherData.email)))
        ]);
        
        const coursesMap = new Map();
        [coursesByEmail, coursesByUid, coursesByTeacherEmail].forEach(snapshot => {
          snapshot.docs.forEach(doc => {
            coursesMap.set(doc.id, { id: doc.id, ...doc.data() });
          });
        });
        
        activeCourses = coursesMap.size;
        
        // Oblicz liczbę lekcji z już pobranych kursów
        let totalLessons = 0;
        coursesMap.forEach((course: any) => {
          if (course.sections && Array.isArray(course.sections)) {
            course.sections.forEach((section: any) => {
              if (section.subsections && section.subsections.length > 0) {
                totalLessons += section.subsections.length;
              } else if (section.contents && section.contents.length > 0) {
                totalLessons += 1;
              }
            });
          }
        });
        
        const teacherCourses = Array.from(coursesMap.values()).map((course: any) => ({
          id: course.id,
          title: course.title || 'Brak tytułu',
          description: course.description || '',
          subject: course.subject || course.category_name || '',
          thumbnail: course.thumbnail || ''
        }));
        
        return { teacherCourses, coursesMap, totalLessons };
      });
      
      setCourses(teacherCourses);
      
      // OPTYMALIZACJA: Pomiń ciężkie obliczanie statystyk - używaj tylko z dokumentu
      // Obliczanie uczniów, ocen, aktywności jest bardzo ciężkie i nie jest potrzebne przy każdym ładowaniu
      
      // Pobierz dodatkowe dane dla odznak (uproszczone)
      let totalGrades = teacherData.totalGrades || 0;
      let activeDays = teacherData.activeDays || 0;
      
      // Oblicz odznaki
      const calculateLevel = (value: number, thresholds: number[]): number => {
        for (let i = thresholds.length - 1; i >= 0; i--) {
          if (value >= thresholds[i]) return i;
        }
        return 0;
      };

      const calculatedBadges: Badge[] = [
        {
          id: 'education-master',
          name: 'Mistrz Edukacji',
          description: 'Za liczbę utworzonych kursów',
          icon: '📚',
          currentLevel: calculateLevel(activeCourses, [0, 3, 10, 20, 50]),
          currentProgress: activeCourses,
          nextLevelThreshold: [3, 10, 20, 50, 100][Math.min(calculateLevel(activeCourses, [0, 3, 10, 20, 50]) + 1, 4)] || 100,
          levels: [
            { name: 'Brąz', threshold: 0, color: 'bg-amber-700', gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 3, color: 'bg-gray-400', gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 10, color: 'bg-yellow-500', gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 20, color: 'bg-cyan-400', gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 50, color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' }
          ]
        },
        {
          id: 'mentor',
          name: 'Mentor',
          description: 'Za liczbę uczniów',
          icon: '👥',
          currentLevel: calculateLevel(totalStudents, [0, 5, 20, 50, 100]),
          currentProgress: totalStudents,
          nextLevelThreshold: [5, 20, 50, 100, 200][Math.min(calculateLevel(totalStudents, [0, 5, 20, 50, 100]) + 1, 4)] || 200,
          levels: [
            { name: 'Brąz', threshold: 0, color: 'bg-amber-700', gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 5, color: 'bg-gray-400', gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 20, color: 'bg-yellow-500', gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 50, color: 'bg-cyan-400', gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 100, color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' }
          ]
        },
        {
          id: 'expert',
          name: 'Ekspert',
          description: 'Za wysoką średnią ocenę od uczniów',
          icon: '⭐',
          currentLevel: calculateLevel(averageRating, [0, 3.5, 4, 4.5, 4.8]),
          currentProgress: Math.round(averageRating * 10) / 10,
          nextLevelThreshold: [3.5, 4, 4.5, 4.8, 5][Math.min(calculateLevel(averageRating, [0, 3.5, 4, 4.5, 4.8]) + 1, 4)] || 5,
          levels: [
            { name: 'Brąz', threshold: 0, color: 'bg-amber-700', gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 3.5, color: 'bg-gray-400', gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 4, color: 'bg-yellow-500', gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 4.5, color: 'bg-cyan-400', gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 4.8, color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' }
          ]
        },
        {
          id: 'content-creator',
          name: 'Twórca Treści',
          description: 'Za liczbę utworzonych lekcji',
          icon: '✍️',
          currentLevel: calculateLevel(totalLessons, [0, 10, 30, 50, 100]),
          currentProgress: totalLessons,
          nextLevelThreshold: [10, 30, 50, 100, 200][Math.min(calculateLevel(totalLessons, [0, 10, 30, 50, 100]) + 1, 4)] || 200,
          levels: [
            { name: 'Brąz', threshold: 0, color: 'bg-amber-700', gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 10, color: 'bg-gray-400', gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 30, color: 'bg-yellow-500', gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 50, color: 'bg-cyan-400', gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 100, color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' }
          ]
        },
        {
          id: 'active-teacher',
          name: 'Aktywny Nauczyciel',
          description: 'Za liczbę dni aktywności',
          icon: '🔥',
          currentLevel: calculateLevel(activeDays, [0, 7, 30, 60, 120]),
          currentProgress: activeDays,
          nextLevelThreshold: [7, 30, 60, 120, 180][Math.min(calculateLevel(activeDays, [0, 7, 30, 60, 120]) + 1, 4)] || 180,
          levels: [
            { name: 'Brąz', threshold: 0, color: 'bg-amber-700', gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 7, color: 'bg-gray-400', gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 30, color: 'bg-yellow-500', gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 60, color: 'bg-cyan-400', gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 120, color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' }
          ]
        },
        {
          id: 'fair-judge',
          name: 'Sprawiedliwy Sędzia',
          description: 'Za liczbę wystawionych ocen',
          icon: '⚖️',
          currentLevel: calculateLevel(totalGrades, [0, 10, 50, 100, 200]),
          currentProgress: totalGrades,
          nextLevelThreshold: [10, 50, 100, 200, 500][Math.min(calculateLevel(totalGrades, [0, 10, 50, 100, 200]) + 1, 4)] || 500,
          levels: [
            { name: 'Brąz', threshold: 0, color: 'bg-amber-700', gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 10, color: 'bg-gray-400', gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 50, color: 'bg-yellow-500', gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 100, color: 'bg-cyan-400', gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 200, color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' }
          ]
        }
      ];

      // Posortuj według poziomu (najwyższe pierwsze)
      const sorted = calculatedBadges.sort((a, b) => b.currentLevel - a.currentLevel || b.currentProgress - a.currentProgress);
      setBadges(sorted);
      
      const teacherProfile: TeacherProfile = {
        id: teacherId,
        fullName: teacherData.fullName || teacherData.displayName || 'Brak nazwiska',
        displayName: teacherData.displayName || teacherData.fullName || 'Brak nazwiska',
        email: teacherData.email || '',
        phone: teacherData.phone || '',
        avatarUrl: teacherData.avatarUrl || teacherData.photoURL || '',
        photoURL: teacherData.photoURL || teacherData.avatarUrl || '',
        subject: teacherData.subject || 'Ogólne',
        description: teacherData.description || 'Doświadczony nauczyciel z pasją do nauczania.',
        experience: teacherData.experience || '5+ lat',
        specialization: teacherData.specialization || ['Edukacja domowa', 'Indywidualne podejście'],
        availability: teacherData.availability || 'Pon-Pt 8:00-16:00',
        activeCourses,
        totalStudents,
        averageRating,
        achievements: []
      };
      
      setTeacher(teacherProfile);
      
      // Cache results
      setSessionCache(cacheKey, {
        teacher: teacherProfile,
        courses: teacherCourses,
        badges: calculatedBadges
      });
      
    } catch (err) {
      console.error('Błąd podczas pobierania profilu nauczyciela:', err);
      setError('Nie udało się pobrać profilu nauczyciela.');
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    fetchTeacherProfile();
  }, [fetchTeacherProfile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6FB] dark:bg-gray-900 flex items-center justify-center w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#4067EC] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Ładowanie profilu nauczyciela...</p>
        </div>
      </div>
    );
  }

  if (error || !teacher) {
    return (
      <div className="min-h-screen bg-[#F4F6FB] dark:bg-gray-900 p-4 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-500 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">Błąd</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error || 'Nauczyciel nie został znaleziony'}</p>
            <button
              onClick={() => router.push('/homelogin')}
              className="px-6 py-3 bg-[#4067EC] text-white rounded-lg hover:bg-[#3050b3] transition"
            >
              Powrót do panelu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6FB] dark:bg-gray-900 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-white/20 dark:border-gray-700 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/homelogin')}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Powrót</span>
          </button>
          
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Profil Nauczyciela
          </h1>
          
          <div className="w-20"></div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-white/20 dark:border-gray-700">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-[#4067EC] to-[#5577FF] text-white rounded-t-xl">
              <div className="flex items-center gap-4">
                {teacher.photoURL || teacher.avatarUrl ? (
                  <img 
                    src={teacher.photoURL || teacher.avatarUrl} 
                    alt={teacher.displayName} 
                    className="w-16 h-16 rounded-full object-cover border-2 border-white/20 shadow-lg"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                    {teacher.displayName[0] || 'N'}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold">{teacher.displayName}</h3>
                    <span className="px-2 py-1 bg-white/20 rounded-full text-xs font-medium">
                      Nauczyciel
                    </span>
                  </div>
                  <p className="text-sm opacity-90">{teacher.subject}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Description */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">O nauczycielu</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{teacher.description}</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{teacher.activeCourses || 0}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Kursy</div>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{teacher.totalStudents || 0}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Uczniów</div>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{(teacher.averageRating || 0).toFixed(1)}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Ocena</div>
                </div>
              </div>

              {/* Experience & Availability */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Doświadczenie</h5>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{teacher.experience}</p>
                </div>
                <div>
                  <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Dostępność</h5>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{teacher.availability}</p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-lg flex items-center justify-center">
                    <Mail className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">{teacher.email}</span>
                </div>
                {teacher.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-lg flex items-center justify-center">
                      <Phone className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                    </div>
                    <span className="text-gray-700 dark:text-gray-300">{teacher.phone}</span>
                  </div>
                )}
              </div>

              {/* Odznaki */}
              {badges.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
                      Odznaki
                    </h4>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{badges.length} odznak</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {badges.map((badge) => (
                      <TeacherBadgeCard key={badge.id} badge={badge} />
                    ))}
                  </div>
                </div>
              )}

              {/* Courses */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    Prowadzone kursy
                  </h4>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{courses.length} kursów</span>
                </div>
                
                {courses.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <BookOpen className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Ten nauczyciel nie prowadzi jeszcze żadnych kursów.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {courses.map((course) => (
                      <div
                        key={course.id}
                        onClick={() => router.push(`/courses/${course.id}`)}
                        className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 cursor-pointer transition-all duration-300 border-2 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-lg"
                      >
                        <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-[#4067EC] to-[#5577FF] rounded-xl flex items-center justify-center shadow-lg">
                          <BookOpen className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm truncate">{course.title}</div>
                          {course.subject && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{course.subject}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Komponent karty odznaki dla nauczyciela
function TeacherBadgeCard({ badge }: { badge: Badge }) {
  const [isHovered, setIsHovered] = useState(false);
  const currentLevelData = badge.levels[badge.currentLevel];
  const progressPercentage = badge.nextLevelThreshold > 0 
    ? Math.min(100, (badge.currentProgress / badge.nextLevelThreshold) * 100)
    : 100;

  return (
    <div
      className={`relative bg-gradient-to-br ${currentLevelData.gradient} rounded-xl p-4 border-2 border-white/30 dark:border-gray-600/30 hover:border-white/50 dark:hover:border-gray-500/50 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl cursor-pointer`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Poziom odznaki */}
      <div className="absolute top-2 right-2">
        <div className="px-2 py-1 rounded-full text-xs font-bold text-white bg-white/20 dark:bg-gray-800/50 backdrop-blur-sm">
          {currentLevelData.name}
        </div>
      </div>

      {/* Ikona */}
      <div className="flex justify-center mb-3">
        <div className={`text-4xl transform transition-transform duration-300 ${isHovered ? 'scale-125 rotate-12' : ''}`}>
          {badge.icon}
        </div>
      </div>

      {/* Nazwa */}
      <h4 className="text-base font-bold text-white mb-1 text-center">
        {badge.name}
      </h4>

      {/* Opis */}
      <p className="text-xs text-white/90 text-center mb-2">
        {badge.description}
      </p>

      {/* Poziom */}
      <p className="text-xs text-white/80 text-center mb-2">
        Poziom {badge.currentLevel + 1} / {badge.levels.length}
      </p>

      {/* Pasek postępu */}
      {badge.currentLevel < badge.levels.length - 1 ? (
        <div className="space-y-1">
          <div className="w-full bg-white/20 dark:bg-gray-800/50 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 bg-white/40 dark:bg-gray-200/40"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-xs text-white/80 text-center">
            {Math.round(badge.currentProgress)} / {badge.nextLevelThreshold}
          </p>
        </div>
      ) : (
        <div className="text-center">
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-white/20 dark:bg-gray-800/50 rounded-full">
            <Trophy className="w-3 h-3 text-yellow-300" />
            <span className="text-xs font-semibold text-white">Maksymalny poziom!</span>
          </div>
        </div>
      )}

      {/* Tooltip z wszystkimi poziomami */}
      {isHovered && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-gray-900 dark:bg-gray-800 text-white rounded-lg p-4 shadow-xl z-10">
          <div className="text-xs font-semibold mb-2">Wszystkie poziomy:</div>
          <div className="space-y-1">
            {badge.levels.map((level, idx) => (
              <div
                key={idx}
                className={`text-xs flex items-center justify-between ${
                  idx === badge.currentLevel ? 'font-bold' : idx < badge.currentLevel ? 'opacity-75' : 'opacity-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={idx <= badge.currentLevel ? level.color : 'text-gray-500'}>
                    {level.name}
                  </span>
                </span>
                <span className="text-gray-400">{typeof level.threshold === 'number' ? Math.round(level.threshold) : level.threshold}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

