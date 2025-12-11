"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from '@/context/AuthContext';
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import TutorManagement from '@/components/TutorManagement';
import {
  BookOpen,
  Users,
  ClipboardList,
  BarChart3,
  Calendar,
  MessageSquare,
  Award,
  TrendingUp,
  Clock,
  UserPlus
} from 'lucide-react';

interface StatCard {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  color: string;
}

interface RecentActivity {
  id: string;
  type: 'course' | 'student' | 'grade' | 'quiz' | 'assignment' | 'survey';
  title: string;
  description: string;
  timestamp: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface Course {
  id: string;
  title: string;
  assignedUsers: string[];
  created_by: string;
  created_at?: any;
  updated_at?: any;
  sections?: any[];
}

interface Student {
  uid: string;
  displayName: string;
  email: string;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [showTutorManagement, setShowTutorManagement] = useState(false);
  const [stats, setStats] = useState({
    courses: 0,
    students: 0,
    averageGrade: 0
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const isAdmin = user?.role === 'admin';

  // Memoizuj filtrowane aktywności
  const filteredActivities = useMemo(() => {
    const filtered = recentActivities.filter(activity => {
      if (activeTab === 'all') return true;
      // Mapowanie typów aktywności do zakładek
      if (activeTab === 'quiz') {
        return activity.type === 'quiz';
      }
      if (activeTab === 'grade') {
        return activity.type === 'grade';
      }
      if (activeTab === 'course') {
        return activity.type === 'course';
      }
      return false;
    });
    console.log('🔍 Filtered activities:', { activeTab, total: recentActivities.length, filtered: filtered.length });
    return filtered;
  }, [recentActivities, activeTab]);

  // Memoizuj definicje zakładek
  const tabs = useMemo(() => [
    { id: 'all', label: 'Wszystkie', icon: '📊', count: recentActivities.length },
    { id: 'quiz', label: 'Quizy', icon: '🧪', count: recentActivities.filter(a => a.type === 'quiz').length },
    { id: 'grade', label: 'Oceny', icon: '📝', count: recentActivities.filter(a => a.type === 'grade').length },
    { id: 'course', label: 'Kursy', icon: '📚', count: recentActivities.filter(a => a.type === 'course').length }
  ], [recentActivities]);

  // Pobierz statystyki - zoptymalizowane
  const fetchStats = useCallback(async () => {
    if (!user?.email || !user?.uid) return;
    
    try {
      // Pobierz kursy nauczyciela - użyj query zamiast pobierania wszystkich
      const coursesCollection = collection(db, 'courses');
      const [coursesByEmail, coursesByUid, coursesByTeacherEmail] = await Promise.all([
        getDocs(query(coursesCollection, where('created_by', '==', user.email))),
        getDocs(query(coursesCollection, where('created_by', '==', user.uid))),
        getDocs(query(coursesCollection, where('teacherEmail', '==', user.email)))
      ]);
      
      // Połącz i deduplikuj kursy
      const coursesMap = new Map<string, Course>();
      [coursesByEmail, coursesByUid, coursesByTeacherEmail].forEach(snapshot => {
        snapshot.docs.forEach(doc => {
          coursesMap.set(doc.id, { id: doc.id, ...doc.data() } as Course);
        });
      });
      const courses = Array.from(coursesMap.values());
      
      // Pobierz wszystkich uczniów przypisanych do kursów nauczyciela
      const allAssignedUsers = new Set<string>();
      courses.forEach(course => {
        if (course.assignedUsers && Array.isArray(course.assignedUsers)) {
          course.assignedUsers.forEach(userId => allAssignedUsers.add(userId));
        }
      });
      
      // Pobierz dane uczniów - batch query zamiast pętli
      const studentsCollection = collection(db, 'users');
      const studentQueries = Array.from(allAssignedUsers).map(userId => {
        if (userId.includes('@')) {
          return getDocs(query(studentsCollection, where("email", "==", userId), limit(1)));
        } else {
          return getDocs(query(studentsCollection, where("uid", "==", userId), limit(1)));
        }
      });
      
      const studentSnapshots = await Promise.all(studentQueries);
      const studentsData: Student[] = studentSnapshots
        .filter(snapshot => !snapshot.empty)
        .map(snapshot => snapshot.docs[0].data() as Student);
      
      // Oblicz średnią ocen z quizów - tylko dla kursów nauczyciela, z limitem
      let totalQuizScore = 0;
      let quizCount = 0;
      
      if (courses.length > 0) {
        const quizResultsCollection = collection(db, 'quiz_results');
        const courseIds = courses.map(c => c.id);
        
        // Pobierz quiz results dla wszystkich kursów jednocześnie (maksymalnie 10 na kurs)
        const quizQueries = courseIds.slice(0, 10).map(courseId => 
          getDocs(query(quizResultsCollection, where('course_id', '==', courseId), limit(10)))
        );
        
        const quizSnapshots = await Promise.all(quizQueries);
        quizSnapshots.forEach(snapshot => {
          snapshot.docs.forEach(doc => {
            const result = doc.data();
            if (result.score !== undefined && result.score !== null) {
              const score = Number(result.score);
              if (!isNaN(score) && score >= 0 && score <= 100) {
                const normalizedScore = score > 10 ? score / 10 : score;
                totalQuizScore += normalizedScore;
                quizCount++;
              }
            }
          });
        });
      }
      
      const averageGrade = quizCount > 0 ? totalQuizScore / quizCount : 4.2;
      const clampedAverage = Math.max(0, Math.min(10, averageGrade));
      
      setStats({
        courses: courses.length,
        students: studentsData.length,
        averageGrade: Math.round(clampedAverage * 10) / 10
      });
      
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [user]);

  // Pobierz ostatnie aktywności - zoptymalizowane
  const fetchRecentActivities = useCallback(async () => {
    if (!user?.email || !user?.uid) return;

    try {
      const activities: RecentActivity[] = [];
      
      // Pobierz kursy nauczyciela - użyj query zamiast pobierania wszystkich
      const coursesCollection = collection(db, 'courses');
      const [coursesByEmail, coursesByUid, coursesByTeacherEmail] = await Promise.all([
        getDocs(query(coursesCollection, where('created_by', '==', user.email), limit(50))),
        getDocs(query(coursesCollection, where('created_by', '==', user.uid), limit(50))),
        getDocs(query(coursesCollection, where('teacherEmail', '==', user.email), limit(50)))
      ]);
      
      // Połącz i deduplikuj kursy
      const coursesMap = new Map<string, Course>();
      [coursesByEmail, coursesByUid, coursesByTeacherEmail].forEach(snapshot => {
        snapshot.docs.forEach(doc => {
          coursesMap.set(doc.id, { id: doc.id, ...doc.data() } as Course);
        });
      });
      const courses = Array.from(coursesMap.values());
      
      // Helper function do parsowania dat
      const parseTimestamp = (ts: any): string => {
        try {
          if (ts?.toDate) return ts.toDate().toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '/');
          if (ts) return new Date(ts).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '/');
          return 'Nieznana data';
        } catch {
          return 'Nieznana data';
        }
      };
      
      // Helper function do parsowania daty do Date object
      const parseDate = (ts: any): Date => {
        try {
          if (ts?.toDate) return ts.toDate();
          if (typeof ts === 'string') {
            const slashMatch = ts.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (slashMatch) {
              const [, dd, mm, yyyy] = slashMatch;
              return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
            }
            return new Date(ts);
          }
          return new Date(ts || 0);
        } catch {
          return new Date(0);
        }
      };
      
      // 1. Aktywności z tworzenia kursów (tylko 5 najnowszych)
      courses.slice(0, 5).forEach(course => {
        activities.push({
          id: `course-created-${course.id}`,
          type: 'course',
          title: 'Kurs utworzony',
          description: `Utworzono nowy kurs "${course.title}"`,
          timestamp: parseTimestamp(course.created_at),
          icon: BookOpen
        });
      });
      
      // 2-7. Pobierz wszystkie aktywności równolegle
      // Uwaga: Usuwamy orderBy z zapytań, które wymagają indeksu - sortowanie zrobimy w kodzie
      const [gradesSnapshot, , quizzesSnapshot, studentsSnapshot, surveysSnapshot] = await Promise.all([
        // Oceny - bez orderBy (sortowanie w kodzie)
        getDocs(query(collection(db, 'grades'), where('graded_by', '==', user.email), limit(20))).catch(() => ({ docs: [] })),
        // Czat - bez orderBy (sortowanie w kodzie) - usuwamy to zapytanie, bo wymaga indeksu
        Promise.resolve({ docs: [] }), // Tymczasowo wyłączone
        // Quizy - bez orderBy (sortowanie w kodzie)
        getDocs(query(collection(db, 'quizzes'), where('created_by', '==', user.email), limit(20))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'users'), where('primaryTutorId', '==', user.uid))).catch(() => ({ docs: [] })),
        // Ankiety - bez orderBy (sortowanie w kodzie)
        getDocs(query(collection(db, 'teacherSurveys'), where('teacherId', '==', user.uid), limit(20))).catch(() => ({ docs: [] }))
      ]);
      
      const teacherStudentEmails = studentsSnapshot.docs.map(doc => doc.data().email).filter(Boolean);
      
      // 2. Oceny - sortuj po dacie w kodzie
      const grades = gradesSnapshot.docs.map(doc => {
        const grade = doc.data();
        const date = parseDate(grade.graded_at);
        return {
          id: `grade-given-${doc.id}`,
          type: 'grade' as const,
          title: 'Ocena wystawiona',
          description: `Wystawiono ocenę ${grade.value || grade.grade} z ${grade.subject || 'przedmiotu'} dla ${grade.studentName || 'ucznia'}`,
          timestamp: parseTimestamp(grade.graded_at),
          icon: Award,
          sortDate: date // Pole do sortowania
        };
      }).sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime()).slice(0, 5).map(({ sortDate, ...activity }) => { void sortDate; return activity; });
      activities.push(...grades);
      
      // 3. Czat - tymczasowo wyłączone (wymaga indeksu)
      // chatSnapshot.docs.forEach(doc => { ... });
      
      // 4. Quizy - sortuj po dacie w kodzie
      const quizzes = quizzesSnapshot.docs.map(doc => {
        const quiz = doc.data();
        const date = parseDate(quiz.created_at);
        return {
          id: `quiz-created-${doc.id}`,
          type: 'quiz' as const,
          title: 'Quiz utworzony',
          description: `Utworzono quiz "${quiz.title}" dla kursu "${quiz.subject || 'nieznanego'}"`,
          timestamp: parseTimestamp(quiz.created_at),
          icon: Award,
          sortDate: date // Pole do sortowania
        };
      }).sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime()).slice(0, 3).map(({ sortDate: _, ...activity }) => { void _; return activity; });
      activities.push(...quizzes);
      
      // 5. Ankiety - sortuj po dacie w kodzie
      const surveys = surveysSnapshot.docs.map(doc => {
        const survey = doc.data();
        const date = parseDate(survey.submittedAt);
        return {
          id: `survey-${doc.id}`,
          type: 'survey' as const,
          title: 'Ankieta wypełniona',
          description: `Uczeń wypełnił ankietę oceniającą - średnia ocena: ${survey.averageScore?.toFixed(1) || 'N/A'}/10`,
          timestamp: parseTimestamp(survey.submittedAt),
          icon: Award,
          sortDate: date // Pole do sortowania
        };
      }).sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime()).slice(0, 3).map(({ sortDate: __, ...activity }) => { void __; return activity; });
      activities.push(...surveys);
      
      // 6. Quizy ukończone przez uczniów (tylko jeśli są uczniowie)
      if (teacherStudentEmails.length > 0 && courses.length > 0) {
        const courseIds = courses.slice(0, 5).map(c => c.id);
        const quizQueries = courseIds.map(courseId => 
          getDocs(query(collection(db, 'quiz_results'), where('course_id', '==', courseId), limit(5)))
        );
        const quizSnapshots = await Promise.all(quizQueries);
        
        quizSnapshots.forEach((snapshot, idx) => {
          const course = courses[idx];
          snapshot.docs.forEach(doc => {
            const result = doc.data();
            if (teacherStudentEmails.includes(result.user_email) && result.score > 0) {
              activities.push({
                id: `quiz-completed-${result.user_email}-${course.id}-${doc.id}`,
                type: 'quiz',
                title: 'Quiz ukończony przez ucznia',
                description: `Uczeń ukończył quiz w kursie "${course.title}" z wynikiem ${result.score || result.percentage || 0}%`,
                timestamp: parseTimestamp(result.completed_at),
                icon: Award
              });
            }
          });
        });
      }
      
      // Sortuj i deduplikuj aktywności
      activities.sort((a, b) => {
        const dateA = parseDate(a.timestamp);
        const dateB = parseDate(b.timestamp);
        return dateB.getTime() - dateA.getTime();
      });
      
      const uniqueActivities = activities.filter((activity, index, self) => 
        index === self.findIndex(a => a.id === activity.id)
      );
      
      const finalActivities = uniqueActivities.slice(0, 10);
      console.log('📊 Setting recent activities:', finalActivities.length, finalActivities);
      setRecentActivities(finalActivities);
      
    } catch (error) {
      console.error('❌ Error fetching recent activities:', error);
      setRecentActivities([]); // Ustaw puste w przypadku błędu
    }
  }, [user]);

  useEffect(() => {
    if (user?.email) {
      console.log('🔄 useEffect triggered, fetching stats and activities...');
      Promise.all([fetchStats(), fetchRecentActivities()]).finally(() => {
        setLoading(false);
        console.log('✅ Stats and activities loaded');
      });
    } else {
      console.log('⏸️ User not available, skipping fetch');
      setLoading(false);
    }
  }, [user?.email, user?.uid, fetchStats, fetchRecentActivities]);

  // Memoizuj statCards aby uniknąć niepotrzebnych re-renderów
  const statCards: StatCard[] = useMemo(() => [
    {
      title: "Moje Kursy",
      value: stats.courses.toString(),
      description: "aktywnych kursów",
      icon: BookOpen,
      color: "bg-blue-500"
    },
    {
      title: "Uczniowie", 
      value: stats.students.toString(),
      description: "wszystkich uczniów",
      icon: Users,
      color: "bg-green-500"
    },
    {
      title: "Średnia ocen",
      value: stats.averageGrade.toFixed(1),
      description: "+0.3 w tym miesiącu",
      icon: BarChart3,
      trend: "up",
      color: "bg-purple-500"
    },
  ], [stats.courses, stats.students, stats.averageGrade]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Header */}
      <div className="text-center max-w-4xl mx-auto px-4">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-gray-900 pt-4 sm:pt-0">
          Witaj z powrotem, {(user as any)?.displayName || user?.email || 'Nauczycielu'}!
        </h2>
        <p className="text-base sm:text-lg text-gray-600 mb-8">
          {isAdmin ? 'Przegląd aktywności w systemie edukacyjnym' : 'Przegląd Twoich kursów i aktywności uczniów'}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          const isCoursesCard = stat.title === "Moje Kursy";
          const isStudentsCard = stat.title === "Uczniowie";
          const isClickableCard = isCoursesCard || isStudentsCard;
          
          const cardContent = (
            <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full flex flex-col ${isClickableCard ? 'hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer' : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-500">{stat.title}</h3>
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</div>
              <p className="text-xs text-gray-600 flex items-center mt-auto">
                {stat.trend === "up" && <TrendingUp className="inline h-3 w-3 mr-1 text-green-500" />}
                {stat.description}
              </p>
            </div>
          );
          
          if (isCoursesCard) {
            return (
              <Link key={index} href="/homelogin/teacher/courses" className="h-full">
                {cardContent}
              </Link>
            );
          } else if (isStudentsCard) {
            return (
              <Link key={index} href="/homelogin/teacher/students" className="h-full">
                {cardContent}
              </Link>
            );
          } else {
            return (
              <div key={index} className="h-full">
                {cardContent}
              </div>
            );
          }
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Szybkie akcje</h3>
              <p className="text-sm text-gray-600">Najczęściej używane funkcje</p>
            </div>
            <div className="p-6 space-y-4">
              <button
                onClick={() => router.push('/homelogin/teacher/courses')}
                className="w-full flex items-center gap-3 p-3 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <BookOpen className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium text-gray-900">Zarządzaj kursami</div>
                  <div className="text-sm text-gray-600">Dodaj nowe materiały</div>
                </div>
              </button>

              <button
                onClick={() => router.push('/homelogin/teacher/students')}
                className="w-full flex items-center gap-3 p-3 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <Users className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-medium text-gray-900">Lista uczniów</div>
                  <div className="text-sm text-gray-600">Zobacz postępy</div>
                </div>
              </button>

              <button
                onClick={() => router.push('/homelogin/teacher/grades')}
                className="w-full flex items-center gap-3 p-3 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <ClipboardList className="h-5 w-5 text-orange-600" />
                <div>
                  <div className="font-medium text-gray-900">Dziennik ocen</div>
                  <div className="text-sm text-gray-600">Wystaw oceny</div>
                </div>
              </button>

              <button
                onClick={() => router.push('/homelogin/teacher/calendar')}
                className="w-full flex items-center gap-3 p-3 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <Calendar className="h-5 w-5 text-purple-600" />
                <div>
                  <div className="font-medium text-gray-900">Kalendarz</div>
                  <div className="text-sm text-gray-600">Zaplanuj zajęcia</div>
                </div>
              </button>

              <button
                onClick={() => router.push('/homelogin/group-chats')}
                className="w-full flex items-center gap-3 p-3 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <MessageSquare className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium text-gray-900">Czat grupowy</div>
                  <div className="text-sm text-gray-600">Komunikuj się</div>
                </div>
              </button>


              {/* Admin Only - Tutor Management */}
              {isAdmin && (
                <button
                  onClick={() => setShowTutorManagement(true)}
                  className="w-full flex items-center gap-3 p-3 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <UserPlus className="h-5 w-5 text-teal-600" />
                  <div>
                    <div className="font-medium text-gray-900">Zarządzaj Tutorami</div>
                    <div className="text-sm text-gray-600">Przypisz tutorów do studentów</div>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Twoje ostatnie aktywności</h3>
                <p className="text-sm text-gray-600">Co robiłeś w systemie - kursy, oceny, quizy, czat</p>
              </div>
              <button
                onClick={async () => {
                  console.log('🔄 Refreshing activities...');
                  setLoading(true);
                  try {
                    await fetchRecentActivities();
                    console.log('✅ Activities refreshed');
                  } catch (error) {
                    console.error('❌ Error refreshing activities:', error);
                  } finally {
                    setLoading(false);
                  }
                }}
                className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1 whitespace-nowrap"
              >
                <Clock className="h-3 w-3" />
                Odśwież
              </button>
            </div>
            
            {/* Zakładki */}
            <div className="px-4 sm:px-6 py-3 border-b border-gray-200">
              <div className="flex space-x-1 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      console.log('🔘 Tab clicked:', tab.id);
                      setActiveTab(tab.id);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-base">{tab.icon}</span>
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                        activeTab === tab.id
                          ? 'bg-blue-200 text-blue-800'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="p-4 sm:p-6">
              <div className="overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" style={{ WebkitOverflowScrolling: 'touch', maxHeight: 'calc(100vh - 250px)' }}>
                {filteredActivities.length > 0 ? (
                  filteredActivities.map((activity) => {
                    const Icon = activity.icon;
                    return (
                      <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="p-2 bg-white rounded-lg border">
                          <Icon className="h-4 w-4 text-gray-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 break-words">{activity.title}</h4>
                          <p className="text-sm text-gray-600 break-words">{activity.description}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3 text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-500">
                              {activity.timestamp}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {activeTab === 'all' 
                      ? 'Brak ostatnich aktywności' 
                      : `Brak aktywności typu "${tabs.find(t => t.id === activeTab)?.label}"`
                    }
                  </div>
                )}
              </div>
              
            </div>
          </div>
        </div>
      </div>


      {/* Modal zarządzania tutorami */}
      {showTutorManagement && (
        <TutorManagement onClose={() => setShowTutorManagement(false)} />
      )}
    </div>
  );
} 