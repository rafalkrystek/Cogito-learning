'use client';

// Force dynamic rendering to prevent SSR issues with client-side hooks
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useParams } from 'next/navigation';
import { db } from '@/config/firebase';
import { collection, getDocs, query, where, doc, getDoc, limit, QueryDocumentSnapshot } from 'firebase/firestore';
import { ArrowLeft, Clock, CheckCircle, XCircle, BarChart3, User, BookOpen, ChevronDown, ChevronUp, FileText, AlertCircle } from 'lucide-react';
import Providers from '@/components/Providers';
import Image from 'next/image';
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

interface AssignedStudent {
  id: string;
  name: string;
  email: string;
}

interface LessonProgress {
  id: string;
  title: string;
  completed: boolean;
  timeSpent: number;
  lastViewed?: string;
  score?: number;
}

interface SectionProgress {
  id: string;
  name: string;
  type?: string;
  lessons: LessonProgress[];
  completedLessons: number;
  totalLessons: number;
  progress: number;
  totalTimeSpent: number;
}

interface StudentStatistics {
  progress: number;
  completedLessons: number;
  totalLessons: number;
  totalTimeSpent: number;
  averageScore?: number;
  lastAccessed?: string;
  sections: SectionProgress[];
}

function ParentCourseDetailContent() {
  const { user } = useAuth();
  const params = useParams();
  const courseId = params?.id as string;
  
  const [course, setCourse] = useState<any>(null);
  const [assignedStudent, setAssignedStudent] = useState<AssignedStudent | null>(null);
  const [statistics, setStatistics] = useState<StudentStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({});
  const [exams, setExams] = useState<any[]>([]);

  const fetchStudentStatistics = useCallback(async (studentId: string, courseId: string, courseSections: any[], studentData: any): Promise<StudentStatistics> => {
    try {
      // Pobierz postęp ucznia - wszystkie warianty równolegle
      const progressRef = collection(db, 'progress');
      const [progressByStudentId, progressByUserId, progressByUserId2] = await Promise.all([
        getDocs(query(progressRef, where('studentId', '==', studentId), limit(500))),
        getDocs(query(progressRef, where('user_id', '==', studentId), limit(500))),
        getDocs(query(progressRef, where('userId', '==', studentId), limit(500)))
      ]);
      
      // Połącz wszystkie wyniki
      const allProgressDocs = [
        ...progressByStudentId.docs,
        ...progressByUserId.docs,
        ...progressByUserId2.docs
      ];
      
      // Usuń duplikaty
      const uniqueProgressDocs = allProgressDocs.filter((doc, index, self) =>
        index === self.findIndex(d => d.id === doc.id)
      );

      // Utwórz mapę postępu
      const progressMap = new Map();
      uniqueProgressDocs.forEach(doc => {
        const progressData = doc.data();
        const lessonId = progressData.lessonId || progressData.lesson_id || progressData.lesson;
        if (lessonId) {
          progressMap.set(String(lessonId), progressData);
        }
      });

      // Pobierz dodatkowy czas z user_learning_time - równolegle
      const learningTimeRef = collection(db, 'user_learning_time');
      const [learningTimeByUserId, learningTimeByUserId2] = await Promise.all([
        getDocs(query(learningTimeRef, where('userId', '==', studentId), limit(100))),
        getDocs(query(learningTimeRef, where('user_id', '==', studentId), limit(100)))
      ]);
      
      // Połącz wyniki
      const allLearningTimeDocs = [...learningTimeByUserId.docs, ...learningTimeByUserId2.docs];
      const uniqueLearningTimeDocs = allLearningTimeDocs.filter((doc, index, self) =>
        index === self.findIndex(d => d.id === doc.id)
      );

      // Przetwórz sekcje i lekcje
      const sectionsProgress: SectionProgress[] = [];
      let totalLessons = 0;
      let completedLessons = 0;
      let totalTimeSpent = 0;
      let lastAccessed: string | null = null;

      courseSections.forEach((section: any) => {
        const sectionLessons: LessonProgress[] = [];
        let sectionCompleted = 0;
        let sectionTimeSpent = 0;

        if (section.subsections) {
          section.subsections.forEach((subsection: any) => {
            totalLessons++;
            const lessonId = String(subsection.id);
            const progressData = progressMap.get(lessonId);
            
            const completed = progressData?.completed || false;
            const timeSpent = progressData?.timeSpent || progressData?.time_spent || progressData?.time_spent_minutes || 0;
            const score = progressData?.score;
            const lessonLastViewed = progressData?.lastViewed || progressData?.last_viewed;

            if (completed) {
              completedLessons++;
              sectionCompleted++;
            }
            totalTimeSpent += timeSpent;
            sectionTimeSpent += timeSpent;

            if (lessonLastViewed) {
              if (!lastAccessed || new Date(lessonLastViewed) > new Date(lastAccessed)) {
                lastAccessed = lessonLastViewed;
              }
            }

            sectionLessons.push({
              id: lessonId,
              title: subsection.name || 'Bez nazwy',
              completed,
              timeSpent,
              lastViewed: lessonLastViewed,
              score
            });
          });
        }

        sectionsProgress.push({
          id: String(section.id),
          name: section.name || 'Bez nazwy',
          type: section.type,
          lessons: sectionLessons,
          completedLessons: sectionCompleted,
          totalLessons: sectionLessons.length,
          progress: sectionLessons.length > 0 ? Math.round((sectionCompleted / sectionLessons.length) * 100) : 0,
          totalTimeSpent: sectionTimeSpent
        });
      });

      // Dodaj czas z user_learning_time dla tego kursu
      uniqueLearningTimeDocs.forEach(doc => {
        const timeData = doc.data();
        const courseIdFromTime = timeData.courseId || timeData.course_id || timeData.course;
        if (courseIdFromTime === courseId) {
          totalTimeSpent += timeData.time_spent_minutes || timeData.timeSpent || 0;
        }
      });

      // Pobierz oceny dla tego kursu - wszystkie warianty równolegle
      const gradesRef = collection(db, 'grades');
      const [gradesByUserId, gradesByEmail, gradesByStudentId] = await Promise.all([
        getDocs(query(gradesRef, where('user_id', '==', studentId), limit(200))),
        studentData.email ? getDocs(query(gradesRef, where('studentEmail', '==', studentData.email), limit(200))) : Promise.resolve({ docs: [] } as any),
        getDocs(query(gradesRef, where('studentId', '==', studentId), limit(200)))
      ]);
      
      const gradesList = gradesByUserId.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() }));
      const gradesByEmailList = gradesByEmail.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() }));
      const gradesByStudentIdList = gradesByStudentId.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() }));

      // Połącz wszystkie listy i usuń duplikaty
      const allGrades = [...gradesList, ...gradesByEmailList, ...gradesByStudentIdList];
      const uniqueGrades = allGrades.filter((grade, index, self) =>
        index === self.findIndex(g => g.id === grade.id)
      );

      // Filtruj oceny związane z tym kursem
      const courseGrades = uniqueGrades.filter(grade => {
        return grade.course_id === courseId || grade.courseId === courseId || grade.course === courseId;
      });

      // Oblicz średnią tak samo jak w dzienniku
      const numericGrades = courseGrades
        .map(g => {
          const gradeValue = g.grade || g.value || g.value_grade;
          if (!gradeValue) return NaN;
          return parseFloat(String(gradeValue).replace(',', '.'));
        })
        .filter(n => !isNaN(n));

      let averageScore: number | undefined = undefined;
      if (numericGrades.length > 0) {
        averageScore = numericGrades.reduce((a, b) => a + b, 0) / numericGrades.length;
      }

      const progressPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

      const statisticsData: StudentStatistics = {
        progress: Math.round(progressPercentage),
        completedLessons,
        totalLessons,
        totalTimeSpent,
        averageScore,
        lastAccessed: lastAccessed || undefined,
        sections: sectionsProgress
      };
      
      setStatistics(statisticsData);
      return statisticsData;
    } catch (error) {
      console.error('Error fetching student statistics:', error);
      const defaultStats: StudentStatistics = {
        progress: 0,
        completedLessons: 0,
        totalLessons: 0,
        totalTimeSpent: 0,
        sections: []
      };
      setStatistics(defaultStats);
      return defaultStats;
    }
  }, []);

  const fetchExams = useCallback(async (courseId: string, sections: any[]): Promise<any[]> => {
    try {
      // Znajdź sekcje z quizId (egzaminy)
      const examSections = sections.filter((section: any) => {
        // Sprawdź czy sekcja ma quizId lub czy jest typu exam
        return section.quizId || section.type === 'exam' || (section.subsections && section.subsections.some((sub: any) => sub.quizId));
      });

      if (examSections.length === 0) {
        return [];
      }

      // Zbierz wszystkie quizId
      const quizIds: string[] = [];
      examSections.forEach((section: any) => {
        if (section.quizId) {
          quizIds.push(section.quizId);
        }
        if (section.subsections) {
          section.subsections.forEach((sub: any) => {
            if (sub.quizId) {
              quizIds.push(sub.quizId);
            }
          });
        }
      });

      if (quizIds.length === 0) {
        return [];
      }

      // Pobierz quizy z Firestore - równolegle
      const quizQueries = quizIds.slice(0, 50).map(quizId => 
        getDoc(doc(db, 'quizzes', quizId)).then(quizDoc => {
          if (quizDoc.exists()) {
            return { id: quizDoc.id, ...quizDoc.data(), sectionId: examSections.find(s => s.quizId === quizId || s.subsections?.some((sub: any) => sub.quizId === quizId))?.id };
          }
          return null;
        }).catch(() => null)
      );

      const quizResults = await Promise.all(quizQueries);
      const validQuizzes = quizResults.filter(q => q !== null);

      // Połącz quizy z sekcjami i dodaj informacje o czasie
      const examsWithSections = examSections.map((section: any) => {
        const sectionQuizId = section.quizId || section.subsections?.find((sub: any) => sub.quizId)?.quizId;
        const quiz = validQuizzes.find(q => q.id === sectionQuizId);
        const sectionData = section as { start_time?: any; submission_deadline?: any; [key: string]: any };
        
        return {
          sectionId: section.id,
          sectionName: section.name || section.title || 'Egzamin',
          quizId: sectionQuizId,
          quiz: quiz || null,
          start_time: sectionData.start_time || (quiz as any)?.start_time || null,
          submission_deadline: sectionData.submission_deadline || (quiz as any)?.submission_deadline || null
        };
      }).filter(exam => exam.quizId);

      return examsWithSections;
    } catch (error) {
      console.error('Error fetching exams:', error);
      return [];
    }
  }, []);

  const fetchCourseData = useCallback(async () => {
    if (!courseId || !user) return;

    const cacheKey = `parent_course_${courseId}_${user.uid}`;
    const cached = getSessionCache<{ course: any; statistics: StudentStatistics; assignedStudent: AssignedStudent }>(cacheKey);
    
    if (cached) {
      setCourse(cached.course);
      setStatistics(cached.statistics);
      setAssignedStudent(cached.assignedStudent);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      await measureAsync('ParentCourseDetail:fetchCourseData', async () => {
        // 1. Znajdź przypisanego ucznia i pobierz dane kursu równolegle
        const [parentStudentsSnapshot, courseDoc] = await Promise.all([
          getDocs(query(collection(db, 'parent_students'), where('parent', '==', user.uid))),
          getDoc(doc(db, 'courses', String(courseId)))
        ]);

        if (parentStudentsSnapshot.empty) {
          setError('Nie masz przypisanego żadnego ucznia.');
          setLoading(false);
          return;
        }

        if (!courseDoc.exists()) {
          setError('Nie znaleziono kursu.');
          setLoading(false);
          return;
        }

        const studentId = parentStudentsSnapshot.docs[0].data().student;
        const courseData = courseDoc.data();

        // 2. Pobierz dane ucznia
        const studentSnapshot = await getDocs(query(collection(db, 'users'), where('uid', '==', studentId)));
        
        if (studentSnapshot.empty) {
          setError('Nie znaleziono danych ucznia.');
          setLoading(false);
          return;
        }

        const studentData = studentSnapshot.docs[0].data();
        const assignedStudentData = {
          id: studentId,
          name: studentData.displayName || `${studentData.firstName || ''} ${studentData.lastName || ''}`.trim() || studentData.email || 'Uczeń',
          email: studentData.email || ''
        };
        setAssignedStudent(assignedStudentData);
        
        // 3. Sprawdź czy uczeń ma dostęp do kursu
        const assignedUsers = courseData.assignedUsers || [];
        const hasAccess = assignedUsers.includes(studentData.email) || 
                         assignedUsers.includes(studentId) ||
                         (courseData.assignedClasses && courseData.assignedClasses.length > 0 &&
                          studentData.classes && Array.isArray(studentData.classes) && 
                          studentData.classes.some((classId: string) => 
                            courseData.assignedClasses.includes(classId)
                          ));
        
        if (!hasAccess) {
          setError('Uczeń nie ma dostępu do tego kursu.');
          setLoading(false);
          return;
        }
        
        setCourse(courseData);

        // 4. Pobierz statystyki ucznia dla tego kursu
        const statistics = await fetchStudentStatistics(studentId, courseId, courseData.sections || [], studentData);
        
        // 5. Pobierz egzaminy (quizzes) dla tego kursu
        const examsData = await fetchExams(courseId, courseData.sections || []);
        setExams(examsData);
        
        // Cache data
        setSessionCache(cacheKey, {
          course: courseData,
          statistics,
          assignedStudent: assignedStudentData
        });
      });
    } catch (err) {
      console.error('Error fetching course:', err);
      setError('Błąd podczas ładowania kursu.');
    } finally {
      setLoading(false);
    }
  }, [courseId, user, fetchStudentStatistics, fetchExams]);

  useEffect(() => {
    fetchCourseData();
  }, [fetchCourseData]);

  const formatTime = useCallback((minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  }, []);

  const formatDate = useCallback((dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('pl-PL', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(/\./g, '/');
    } catch {
      return 'Nieznana data';
    }
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Ładowanie kursu...</p>
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
            onClick={() => window.location.href = '/homelogin'}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Powrót
          </button>
        </div>
      </div>
    );
  }

  if (!course || !statistics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Brak danych kursu</p>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full" style={{ maxWidth: '100vw' }}>
      {/* Header z przyciskiem powrotu */}
      <div className="flex-shrink-0 bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => window.location.href = '/homelogin/parent/courses'}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Powrót</span>
          </button>

          <div className="flex items-center gap-3">
            {course.iconUrl && (
              <div className="w-12 h-12 sm:w-16 sm:h-16 relative flex-shrink-0">
                <Image
                  src={course.iconUrl}
                  alt={course.title || course.name || 'Course icon'}
                  fill
                  className="object-contain"
                />
              </div>
            )}
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {course.title || course.name}
            </h1>
          </div>

          <div className="w-20"></div>
        </div>
      </div>

      {/* Informacje o kursie */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 min-h-0">
        {/* Opis kursu */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-3">O kursie</h2>
          <p className="text-gray-700 mb-4">{course.description || course.description || 'Brak opisu kursu'}</p>
          <div className="flex flex-wrap gap-3">
            {course.subject && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                {course.subject}
              </span>
            )}
            {course.courseType && (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                course.courseType === 'fakultatywny' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-purple-100 text-purple-700'
              }`}>
                {course.courseType === 'fakultatywny' ? 'Fakultatywny' : 'Obowiązkowy'}
              </span>
            )}
            {course.year_of_study && (
              <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                Rok {course.year_of_study}
              </span>
            )}
          </div>
        </div>

        {/* Statystyki ucznia */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Postęp {assignedStudent?.name || 'ucznia'} w kursie
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm border border-blue-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-2 bg-blue-200 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-600 font-medium">Postęp</p>
                  <p className="text-xl font-bold text-blue-700">
                    {statistics.progress}%
                  </p>
                </div>
              </div>
              <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${statistics.progress}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm border border-green-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-2 bg-green-200 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-600 font-medium">Ukończone</p>
                  <p className="text-xl font-bold text-green-700">
                    {statistics.completedLessons}/{statistics.totalLessons}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-sm border border-purple-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-2 bg-purple-200 rounded-lg">
                  <Clock className="w-5 h-5 text-purple-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-600 font-medium">Czas nauki</p>
                  <p className="text-xl font-bold text-purple-700">
                    {formatTime(statistics.totalTimeSpent)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl shadow-sm border border-yellow-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-200 rounded-lg">
                  <User className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-600 font-medium">Śr. ocena</p>
                  <p className="text-xl font-bold text-yellow-700">
                    {statistics.averageScore !== undefined ? 
                      statistics.averageScore.toFixed(2) : 'Brak'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sekcja z egzaminami */}
        {exams.length > 0 && (
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-6 h-6 text-red-600" />
              Egzaminy
            </h2>
            
            <div className="space-y-4">
              {exams.map((exam) => {
                const now = new Date();
                const startTime = exam.start_time ? new Date(exam.start_time) : null;
                const deadline = exam.submission_deadline ? new Date(exam.submission_deadline) : null;
                
                let statusMessage = '';
                let statusColor = 'bg-blue-100 text-blue-800';
                
                if (deadline) {
                  if (startTime && now < startTime) {
                    statusMessage = `Egzamin dostępny od: ${startTime.toLocaleString('pl-PL', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}`;
                    statusColor = 'bg-yellow-100 text-yellow-800';
                  } else if (now > deadline) {
                    statusMessage = 'Czas na wykonanie egzaminu minął';
                    statusColor = 'bg-red-100 text-red-800';
                  } else {
                    statusMessage = 'Egzamin dostępny';
                    statusColor = 'bg-green-100 text-green-800';
                  }
                } else {
                  statusMessage = 'Egzamin bez ograniczeń czasowych';
                }

                return (
                  <div
                    key={exam.sectionId}
                    className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg mb-2">
                          {exam.sectionName}
                        </h3>
                        
                        <div className="space-y-2 text-sm text-gray-600">
                          {startTime && (
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-blue-600" />
                              <span className="font-medium">Dostępny od:</span>
                              <span>{startTime.toLocaleString('pl-PL', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}</span>
                            </div>
                          )}
                          
                          {deadline && (
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-red-600" />
                              <span className="font-medium">Termin zakończenia:</span>
                              <span>{deadline.toLocaleString('pl-PL', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="ml-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                          {statusMessage}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Szczegółowy postęp - tylko statystyki, bez treści */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Postęp w materiale</h2>
          
          {statistics.sections.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <BookOpen className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p>Brak materiałów w tym kursie</p>
            </div>
          ) : (
            <div className="space-y-4">
              {statistics.sections.map((section) => (
                <div
                  key={section.id}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                >
                  {/* Section Header */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-all"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {expandedSections[section.id] ? (
                        <ChevronUp className="text-blue-600 w-5 h-5" />
                      ) : (
                        <ChevronDown className="text-gray-400 w-5 h-5" />
                      )}
                      <div className="text-left flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg">{section.name}</h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                          <span>
                            {section.completedLessons}/{section.totalLessons} lekcji ukończonych
                          </span>
                          <span>{section.progress}%</span>
                          <span>{formatTime(section.totalTimeSpent)} czasu</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-24 h-2 bg-gray-200 rounded-full">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          section.progress >= 80 ? 'bg-green-500' :
                          section.progress >= 50 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${section.progress}%` }}
                      />
                    </div>
                  </button>

                  {/* Lessons List - tylko statystyki */}
                  {expandedSections[section.id] && (
                    <div className="divide-y divide-gray-200">
                      {section.lessons.length === 0 ? (
                        <div className="px-6 py-4 text-gray-500 text-sm">
                          Brak lekcji w tej sekcji
                        </div>
                      ) : (
                        section.lessons.map((lesson) => (
                          <div
                            key={lesson.id}
                            className="px-6 py-4 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <div className="flex-shrink-0 mt-1">
                                  {lesson.completed ? (
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                  ) : (
                                    <XCircle className="w-5 h-5 text-gray-300" />
                                  )}
                                </div>
                                
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900">{lesson.title}</h4>
                                  
                                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                    {lesson.timeSpent > 0 && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Spędzono: {formatTime(lesson.timeSpent)}
                                      </span>
                                    )}
                                    
                                    {lesson.score !== undefined && (
                                      <span className="flex items-center gap-1">
                                        <BarChart3 className="w-3 h-3" />
                                        Wynik: {lesson.score}%
                                      </span>
                                    )}
                                    
                                    {lesson.lastViewed && (
                                      <span className="flex items-center gap-1">
                                        Ostatnio: {formatDate(lesson.lastViewed)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex-shrink-0">
                                {lesson.completed ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Ukończona
                                  </span>
                                ) : lesson.timeSpent > 0 ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    W trakcie
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    Nierozpoczęta
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ParentCourseDetails() {
  return (
    <Providers>
      <ParentCourseDetailContent />
    </Providers>
  );
}
