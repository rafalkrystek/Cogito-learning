'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { FirebaseQuizDisplay } from '@/components/FirebaseQuizDisplay';
import Providers from '@/components/Providers';
import { ArrowLeft } from 'lucide-react';
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

interface Quiz {
  id: string;
  title: string;
  description: string;
  subject: string;
  course_id: string;
  course_title: string;
  created_at: string;
  max_attempts: number;
}

interface QuizAttempt {
  id: string;
  user_id: string;
  quiz_id: string;
  started_at: string;
  completed_at?: string;
  score?: number;
  answers: Record<string, string>;
  time_spent?: number;
}

function StudentQuizzesPageContent() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<Record<string, QuizAttempt[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);

  const fetchQuizzes = useCallback(async () => {
    if (!user) return;
    
    const cacheKey = `student_quizzes_${user.uid}`;
    const attemptsCacheKey = `student_quiz_attempts_${user.uid}`;
    
    // Check cache
    const cachedQuizzes = getSessionCache<Quiz[]>(cacheKey);
    const cachedAttempts = getSessionCache<Record<string, QuizAttempt[]>>(attemptsCacheKey);
    
    if (cachedQuizzes && cachedAttempts) {
      setQuizzes(cachedQuizzes);
      setQuizAttempts(cachedAttempts);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // OPTYMALIZACJA: Pobierz tylko kursy ucznia używając where, nie wszystkie!
      const userCourses = await measureAsync('StudentQuizzes:fetchCourses', async () => {
        const coursesCollection = collection(db, 'courses');
        
        const [coursesByUid, coursesByEmail] = await Promise.all([
          getDocs(query(coursesCollection, where('assignedUsers', 'array-contains', user.uid))),
          user.email ? getDocs(query(coursesCollection, where('assignedUsers', 'array-contains', user.email))) : Promise.resolve({ docs: [] } as any)
        ]);
        
        const coursesMap = new Map();
        [...coursesByUid.docs, ...coursesByEmail.docs].forEach(doc => {
          coursesMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
        
        // Sprawdź kursy przypisane do klas
        if ((user as any).classes && Array.isArray((user as any).classes) && (user as any).classes.length > 0) {
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
        
        return Array.from(coursesMap.values());
      });

      const courseIds = userCourses.map((c: any) => c.id);
      
      if (courseIds.length === 0) {
        setQuizzes([]);
        setQuizAttempts({});
        setLoading(false);
        return;
      }

      // OPTYMALIZACJA: Pobierz tylko quizy z kursów ucznia używając where z 'in'
      const availableQuizzes = await measureAsync('StudentQuizzes:fetchQuizzes', async () => {
        const quizzesCollection = collection(db, 'quizzes');
        
        // Chunk courseIds (max 10 w 'in')
        const chunks: string[][] = [];
        for (let i = 0; i < courseIds.length; i += 10) {
          chunks.push(courseIds.slice(i, i + 10));
        }
        
        const quizQueries = chunks.map(chunk =>
          getDocs(query(quizzesCollection, where('course_id', 'in', chunk)))
        );
        
        const quizSnapshots = await Promise.all(quizQueries);
        return quizSnapshots.flatMap(snapshot =>
          snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz))
        );
      });

      setQuizzes(availableQuizzes);

      // OPTYMALIZACJA: Napraw N+1 problem - pobierz wszystkie próby jednym zapytaniem!
      const attemptsMap = await measureAsync('StudentQuizzes:fetchAttempts', async () => {
        // Pobierz wszystkie próby użytkownika jednym zapytaniem
        const allAttemptsQuery = query(
          collection(db, 'quiz_attempts'),
          where('user_id', '==', user.uid)
        );
        
        const allAttemptsSnapshot = await getDocs(allAttemptsQuery);
        const allAttempts = allAttemptsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as QuizAttempt[];
        
        // Grupuj próby po quiz_id
        const grouped: Record<string, QuizAttempt[]> = {};
        allAttempts.forEach(attempt => {
          if (!grouped[attempt.quiz_id]) {
            grouped[attempt.quiz_id] = [];
          }
          grouped[attempt.quiz_id].push(attempt);
        });
        
        return grouped;
      });
      
      setQuizAttempts(attemptsMap);
      
      // Cache results
      setSessionCache(cacheKey, availableQuizzes);
      setSessionCache(attemptsCacheKey, attemptsMap);
    } catch (error) {
      console.error('Error fetching quizzes:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6FB] flex items-center justify-center w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#4067EC] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Ładowanie quizów...</p>
        </div>
      </div>
    );
  }

  if (selectedQuiz) {
    return (
      <div className="min-h-screen bg-[#F4F6FB] p-4 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setSelectedQuiz(null)}
            className="mb-4 px-4 py-2 bg-[#4067EC] text-white rounded-lg hover:bg-[#3050b3] transition flex items-center gap-2"
          >
            ← Powrót do listy quizów
          </button>
          <FirebaseQuizDisplay quizId={selectedQuiz.id} onBack={() => setSelectedQuiz(null)} />
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
            Dostępne quizy
          </h1>
          
          <div className="w-20"></div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="bg-white/90 backdrop-blur-xl w-full max-w-5xl mx-auto p-4 md:p-6 rounded-2xl shadow-lg border border-white/20">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Dostępne quizy <span className="inline-block">📝</span></h2>
          <p className="text-gray-600 mb-6">Wybierz quiz, który chcesz rozwiązać</p>
        
        {quizzes.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">Brak dostępnych quizów</h3>
            <p className="text-gray-500">Nie masz jeszcze przypisanych quizów do swoich kursów.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {quizzes.slice(0, 12).map((quiz) => { // Lazy loading: pokaż tylko pierwsze 12
              const attempts = quizAttempts[quiz.id] || [];
              const completedAttempts = attempts.filter(attempt => attempt.completed_at);
              const canStartNewAttempt = completedAttempts.length < quiz.max_attempts;
              const bestScore = completedAttempts.length > 0 
                ? Math.max(...completedAttempts.map(attempt => attempt.score || 0))
                : null;

              // Logika czasowa
              const now = new Date();
              const startTime = (quiz as any).start_time ? new Date((quiz as any).start_time) : null;
              const deadline = (quiz as any).submission_deadline ? new Date((quiz as any).submission_deadline) : null;
              
              let timeStatus: 'before' | 'available' | 'after' = 'available';
              let timeMessage: string | null = null;
              
              if (deadline) {
                if (startTime && now < startTime) {
                  timeStatus = 'before';
                  timeMessage = `Dostępny od: ${startTime.toLocaleString('pl-PL', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}`;
                } else if (now > deadline) {
                  timeStatus = 'after';
                  timeMessage = 'Czas minął';
                }
              }
              
              const isTimeBlocked = timeStatus === 'before' || timeStatus === 'after';
              const isButtonDisabled = !canStartNewAttempt || isTimeBlocked;

              return (
                <div key={quiz.id} className="bg-[#F8F9FB] rounded-xl p-4 md:p-6 border border-gray-200 hover:border-[#4067EC] transition-colors">
                  <div className="mb-4">
                    <h3 className="text-lg md:text-xl font-semibold text-gray-800 mb-2">{quiz.title}</h3>
                    {/* Opis zawsze widoczny */}
                    {quiz.description && (
                      <p className="text-gray-600 text-sm mb-3">{quiz.description}</p>
                    )}
                    
                    {/* Komunikaty czasowe */}
                    {timeMessage && (
                      <div className={`mb-3 p-2 rounded-lg text-xs ${
                        timeStatus === 'before' 
                          ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                          : 'bg-red-50 border border-red-200 text-red-800'
                      }`}>
                        {timeStatus === 'before' ? '⏰' : '❌'} {timeMessage}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="px-2 py-1 bg-[#4067EC] text-white text-xs rounded-full">{quiz.subject}</span>
                      <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-full">{quiz.course_title}</span>
                    </div>
                    
                    {/* Informacje o próbach */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Próby:</span>
                        <span className="font-medium">
                          {completedAttempts.length}/{quiz.max_attempts}
                        </span>
                      </div>
                      
                      {bestScore !== null && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Najlepszy wynik:</span>
                          <span className={`font-medium px-2 py-1 rounded text-xs ${
                            bestScore >= 50 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {bestScore}%
                          </span>
                        </div>
                      )}
                      
                      {!canStartNewAttempt && (
                        <div className="text-center">
                          <span className="text-orange-600 text-xs font-medium">
                            ⚠️ Limit prób przekroczony
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setSelectedQuiz(quiz)}
                    disabled={isButtonDisabled}
                    className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                      isButtonDisabled
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-[#4067EC] text-white hover:bg-[#3050b3]'
                    }`}
                  >
                    {isTimeBlocked 
                      ? (timeStatus === 'before' ? 'Niedostępny' : 'Czas minął')
                      : !canStartNewAttempt 
                        ? 'Limit prób przekroczony'
                        : 'Rozpocznij Quiz'
                    }
                  </button>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default function StudentQuizzesPage() {
  return (
    <Providers>
      <StudentQuizzesPageContent />
    </Providers>
  );
}
