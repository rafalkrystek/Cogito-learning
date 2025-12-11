'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { FirebaseQuizDisplay } from '@/components/FirebaseQuizDisplay';
import Providers from '@/components/Providers';
import { ArrowLeft } from 'lucide-react';

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

  useEffect(() => {
    if (!user) return;
    
    const fetchQuizzes = async () => {
      try {
        setLoading(true);
        // Pobierz quizy przypisane do kursów, w których uczestniczy uczeń
        const quizzesCollection = collection(db, 'quizzes');
        const quizzesSnapshot = await getDocs(quizzesCollection);
        
        // Pobierz kursy ucznia
        const coursesCollection = collection(db, 'courses');
        const coursesSnapshot = await getDocs(coursesCollection);
        const userCourses = coursesSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((course: any) => {
            // Sprawdź czy kurs jest przypisany bezpośrednio do użytkownika
            const isDirectlyAssigned = course.assignedUsers && 
              (course.assignedUsers.includes(user.uid) || course.assignedUsers.includes(user.email));
            
            // Sprawdź czy użytkownik jest w klasie, która ma przypisane kursy
            const isInAssignedClass = course.assignedClasses && course.assignedClasses.length > 0 &&
              (user as any).classes && (user as any).classes.some((classId: string) =>
                course.assignedClasses.includes(classId)
              );
            
            return isDirectlyAssigned || isInAssignedClass;
          });

        // Filtruj quizy tylko do kursów ucznia
        const availableQuizzes = quizzesSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Quiz))
          .filter((quiz: Quiz) => 
            userCourses.some(course => course.id === quiz.course_id)
          );

        setQuizzes(availableQuizzes);

        // Pobierz próby użytkownika dla wszystkich quizów
        const attemptsMap: Record<string, QuizAttempt[]> = {};
        
        for (const quiz of availableQuizzes) {
          const attemptsQuery = query(
            collection(db, 'quiz_attempts'),
            where('quiz_id', '==', quiz.id),
            where('user_id', '==', user.uid)
          );
          
          const attemptsSnapshot = await getDocs(attemptsQuery);
          const attempts = attemptsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as QuizAttempt[];
          
          attemptsMap[quiz.id] = attempts;
        }
        
        setQuizAttempts(attemptsMap);
      } catch (error) {
        console.error('Error fetching quizzes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, [user]);

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
            {quizzes.map((quiz) => {
              const attempts = quizAttempts[quiz.id] || [];
              const completedAttempts = attempts.filter(attempt => attempt.completed_at);
              const canStartNewAttempt = completedAttempts.length < quiz.max_attempts;
              const bestScore = completedAttempts.length > 0 
                ? Math.max(...completedAttempts.map(attempt => attempt.score || 0))
                : null;

              return (
                <div key={quiz.id} className="bg-[#F8F9FB] rounded-xl p-4 md:p-6 border border-gray-200 hover:border-[#4067EC] transition-colors">
                  <div className="mb-4">
                    <h3 className="text-lg md:text-xl font-semibold text-gray-800 mb-2">{quiz.title}</h3>
                    <p className="text-gray-600 text-sm mb-3">{quiz.description}</p>
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
                    disabled={!canStartNewAttempt}
                    className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                      canStartNewAttempt
                        ? 'bg-[#4067EC] text-white hover:bg-[#3050b3]'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {canStartNewAttempt ? 'Rozpocznij quiz' : 'Limit prób przekroczony'}
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
