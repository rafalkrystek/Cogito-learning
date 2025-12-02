'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query, where, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';
import Providers from '@/components/Providers';
import { ArrowLeft } from 'lucide-react';

interface Grade {
  id: string;
  user_id: string;
  course_id: string;
  value: number;
  comment?: string;
  graded_by: string;
  graded_at: string;
  quiz_id?: string;
  quiz_title?: string;
  subject?: string;
  grade_type?: string;
  percentage?: number;
}

interface GroupedGrades {
  [subject: string]: Grade[];
}

function GradesPageContent() {
  console.log('🚀 GradesPageContent function called!');
  
  const { user, loading: authLoading } = useAuth();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string>('');
  const [toast, setToast] = useState<{grade: number, description: string, date: string, gradeType?: string, quizTitle?: string, percentage?: number} | null>(null);
  const [userCourses, setUserCourses] = useState<any[]>([]);

  console.log('🔄 GradesPageContent rendered, user:', user?.uid, 'authLoading:', authLoading);
  console.log('🔄 User object:', user);
  console.log('🔄 AuthLoading object:', authLoading);

  useEffect(() => {
    if (!user) return;
    // Pobierz displayName z Firestore
    const fetchDisplayName = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setDisplayName(data.displayName || '');
      }
    };
    fetchDisplayName();
  }, [user]);

  // Pobierz kursy użytkownika
  useEffect(() => {
    const fetchUserCourses = async () => {
      if (!user) return;
      
      console.log('🔄 Fetching user courses for:', user.uid);
      const coursesQuery = query(
        collection(db, 'courses'),
        where('assignedUsers', 'array-contains', user.uid)
      );
      const coursesSnapshot = await getDocs(coursesQuery);
      const coursesList = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('📚 User courses:', coursesList);
      setUserCourses(coursesList);
    };

    fetchUserCourses();
  }, [user]);

  const fetchGrades = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    
    // Pobierz wszystkie oceny równolegle zamiast sekwencyjnie
    const gradeQueries: Promise<any>[] = [
      getDocs(query(collection(db, 'grades'), where('user_id', '==', user.uid), limit(100)))
    ];
    if (user.email) {
      gradeQueries.push(getDocs(query(collection(db, 'grades'), where('studentEmail', '==', user.email), limit(100))));
    }
    const results = await Promise.all(gradeQueries);
    const gradesByUid = results[0];
    const gradesByEmail = results[1] || { docs: [] };
    
    // Połącz obie listy i usuń duplikaty
    const snapshots = user.email ? [gradesByUid, gradesByEmail] : [gradesByUid];
    const allGrades = snapshots.flatMap(snapshot => 
      snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Grade))
    );
    const uniqueGrades = allGrades.filter((grade, index, self) => 
      index === self.findIndex(g => g.id === grade.id)
    );
    
    setGrades(uniqueGrades);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    console.log('🔄 Grades useEffect triggered, user:', user?.uid, 'authLoading:', authLoading);
    console.log('🔄 useEffect dependencies changed - user:', user?.uid, 'authLoading:', authLoading);
    if (authLoading) {
      console.log('⏳ Auth still loading, waiting...');
      return;
    }
    if (!user) {
      console.log('❌ No user found');
      return;
    }
    console.log('✅ User found, fetching grades...');
    fetchGrades();
  }, [user, authLoading, fetchGrades]);

  // Grupowanie ocen po przedmiocie i sortowanie po dacie rosnąco
  const groupedGrades: GroupedGrades = grades.reduce((acc, grade) => {
    const subject = grade.subject || 'Inne';
    if (!acc[subject]) acc[subject] = [];
    acc[subject].push(grade);
    return acc;
  }, {} as GroupedGrades);

  // Dodaj kursy bez ocen
  userCourses.forEach(course => {
    const courseTitle = course.title || course.name || 'Nieznany kurs';
    if (!groupedGrades[courseTitle]) {
      groupedGrades[courseTitle] = [];
    }
  });
  // Sortuj oceny w każdym przedmiocie po dacie rosnąco
  Object.keys(groupedGrades).forEach(subject => {
    groupedGrades[subject].sort((a, b) => {
      // Jeśli data nie istnieje, traktuj jako najstarszą
      if (!a.graded_at) return -1;
      if (!b.graded_at) return 1;
      return new Date(a.graded_at).getTime() - new Date(b.graded_at).getTime();
    });
  });

  // Funkcja do określania koloru badge na podstawie oceny
  function getGradeColor(grade: number) {
    if (grade === 5) return 'bg-green-500 text-white';
    if (grade === 4) return 'bg-blue-500 text-white';
    if (grade === 3) return 'bg-yellow-500 text-white';
    if (grade === 2) return 'bg-orange-500 text-white';
    if (grade === 1) return 'bg-red-500 text-white';
    return 'bg-gray-500 text-white';
  }

  // Funkcja do liczenia średniej ocen (tylko liczbowych)
  function calculateAverage(grades: Grade[]): string {
    const numericGrades = grades
      .map(g => g.value)
      .filter(n => !isNaN(n));
    if (numericGrades.length === 0) return '-';
    const avg = numericGrades.reduce((a, b) => a + b, 0) / numericGrades.length;
    return avg.toFixed(2);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full">
      {/* Header z przyciskiem powrotu */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => window.location.href = '/homelogin'}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Powrót
          </button>
          
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Dziennik ocen
          </h1>
          
          <button
            onClick={fetchGrades}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Odświeżanie...' : 'Odśwież'}
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="flex items-center gap-4 mb-8 max-w-5xl mx-auto">
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-bold text-gray-500">
            {displayName ? displayName.split(' ').map(n => n[0]).join('').toUpperCase() : ''}
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Dziennik ocen</h2>
            <p className="text-gray-600">Twoje oceny z wszystkich przedmiotów</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#4067EC] border-t-transparent"></div>
          </div>
        ) : grades.length === 0 ? (
          <div className="text-center py-12 max-w-5xl mx-auto">
            <div className="text-gray-400 text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">Brak ocen</h3>
            <p className="text-gray-500">Nie masz jeszcze żadnych ocen w dzienniku.</p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-6">
            {Object.entries(groupedGrades).map(([subject, subjectGrades]) => (
            <div key={subject} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#4067EC] to-[#5577FF] px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">{subject}</h2>
                  <div className="text-right">
                    <div className="text-white text-sm opacity-90">Średnia</div>
                    <div className="text-white text-2xl font-bold">
                      {subjectGrades.length > 0 ? calculateAverage(subjectGrades) : 'Brak ocen'}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subjectGrades.length > 0 ? (
                    subjectGrades.map((grade) => (
                    <div 
                      key={grade.id} 
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-[#4067EC] transition-colors cursor-pointer"
                      onClick={() => setToast({
                        grade: grade.value,
                        description: grade.comment || 'Brak opisu',
                        date: grade.graded_at,
                        gradeType: grade.grade_type,
                        quizTitle: grade.quiz_title,
                        percentage: grade.percentage
                      })}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getGradeColor(grade.value)}`}>
                          {grade.value}
                        </span>
                        <span className="text-xs text-gray-500">
                          {grade.graded_at ? new Date(grade.graded_at).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '/') : 'Brak daty'}
                        </span>
                      </div>
                      
                      <h4 className="font-medium text-gray-800 mb-2 line-clamp-2">
                        {grade.comment || 'Brak opisu'}
                      </h4>
                      
                      {grade.grade_type && (
                        <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                          {grade.grade_type}
                        </span>
                      )}
                    </div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-8">
                      <div className="text-gray-400 text-4xl mb-2">📝</div>
                      <p className="text-gray-500">Brak ocen w tym przedmiocie</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toast notification - ZAKTUALIZOWANY */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm z-[9999]">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${getGradeColor(toast.grade)}`}>
              {toast.grade}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-800 mb-1">Szczegóły oceny</h4>
              <p className="text-sm text-gray-600 mb-2">{toast.description}</p>
              {toast.quizTitle && (
                <p className="text-xs text-blue-600 mb-1">Quiz: {toast.quizTitle}</p>
              )}
              {toast.percentage !== undefined && (
                <p className="text-xs text-green-600 mb-1">Wynik: {toast.percentage}%</p>
              )}
              <p className="text-xs text-gray-500">Data: {toast.date ? new Date(toast.date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '/') : 'Brak daty'}</p>
              {toast.gradeType && (
                <p className="text-xs text-gray-500">Typ: {toast.gradeType}</p>
              )}
            </div>
            <button 
              onClick={() => setToast(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default function GradesPage() {
  return (
    <Providers>
      <GradesPageContent />
    </Providers>
  );
}

