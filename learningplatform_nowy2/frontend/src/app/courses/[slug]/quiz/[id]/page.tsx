'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/config/firebase';
import { doc, getDoc, collection, addDoc, updateDoc, serverTimestamp, query, where, getDocs, DocumentData } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import MathView from '@/components/MathView';
import QuizAnswerInput from '@/components/QuizAnswerInput';
import ThemeToggle from '@/components/ThemeToggle';
import { Quiz, Question } from '@/types';
import { QuizNotFound } from '@/components/QuizNotFound';
import { calculateGradeFromPercentage, getGradeDescription, getGradeColor } from '@/utils/gradeCalculator';
import Providers from '@/components/Providers';

// Funkcja pomocnicza do generowania UUID
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback dla starszych przeglądarek
  const pattern = /[xy]/g;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(pattern, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

function QuizTakingContent() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;
  const quizId = params?.id as string;
  const { user, loading: authLoading } = useAuth();
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [openAnswers, setOpenAnswers] = useState<Record<string, { content: string; type: 'text' | 'math' }>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [grade, setGrade] = useState(0);
  const [gradeDescription, setGradeDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsCount, setAttemptsCount] = useState(0);
  const [maxAttemptsReached, setMaxAttemptsReached] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null); // Will be set when quiz loads
  const [quizStarted, setQuizStarted] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);

  // Check if params are available
  useEffect(() => {
    if (!slug || !quizId) {
      setError('Nieprawidłowy URL quizu');
      setLoading(false);
      return;
    }
    
    // Wait for auth to finish loading
    if (authLoading) {
      console.log('Auth still loading...');
      return;
    }
    
    // Check if user is authenticated
    if (!user) {
      setError('Musisz być zalogowany, aby wziąć udział w quizie');
      setLoading(false);
      return;
    }
    
    console.log('Component initialized with:', { slug, quizId, user: !!user, userId: user?.uid, authLoading });
  }, [slug, quizId, user, authLoading]);

  // Handle quiz submission
  const handleSubmit = useCallback(async () => {
    console.log('🚀 handleSubmit called!', { quiz: !!quiz, user: !!user, quizId: quiz?.id, userId: user?.uid });
    
    if (!quiz || !user) {
      console.error('❌ Missing quiz or user:', { quiz: !!quiz, user: !!user });
      return;
    }
    
    try {
      console.log('✅ Starting quiz submission...', { quizId: quiz.id, userId: user.uid });
      setSubmitting(true);
      setError(null);
      
      // Calculate score
      let correctAnswers = 0;
      const totalQuestions = quiz.questions.length;
      
      console.log('Calculating score for', totalQuestions, 'questions');
      console.log('Selected answers:', selectedAnswers);
      console.log('Open answers:', openAnswers);
      console.log('All question IDs:', quiz.questions.map(q => q.id));
      
      quiz.questions.forEach((question, index) => {
        console.log(`Processing question ${index + 1} with ID: ${question.id}:`, question);
        
        if (question.type === 'open' || !question.answers?.length) {
          // For open questions, check if answer matches
          const userAnswer = openAnswers[question.id]?.content?.trim().toLowerCase() || '';
          const correctAnswer = question.answers[0]?.content?.trim().toLowerCase();
          console.log(`Question ${index + 1} (open):`, { 
            userAnswer, 
            correctAnswer, 
            isCorrect: userAnswer === correctAnswer,
            questionType: question.type,
            answersLength: question.answers?.length
          });
          if (userAnswer === correctAnswer) {
            correctAnswers++;
          }
        } else {
          // For multiple choice questions
          const selectedAnswerId = selectedAnswers[question.id];
          const correctAnswer = question.answers.find(answer => answer.is_correct === true);
          console.log(`Question ${index + 1} (multiple choice):`, { 
            questionId: question.id,
            selectedAnswerId, 
            correctAnswerId: correctAnswer?.id,
            correctAnswerData: correctAnswer,
            allAnswers: question.answers,
            isCorrect: selectedAnswerId === correctAnswer?.id 
          });
          if (selectedAnswerId === correctAnswer?.id) {
            correctAnswers++;
          }
        }
      });
      
      const finalScore = Math.round((correctAnswers / totalQuestions) * 100);
      console.log('Final score calculated:', { correctAnswers, totalQuestions, finalScore });
      setScore(finalScore);
      
      // Oblicz ocenę na podstawie procentów
      const calculatedGrade = calculateGradeFromPercentage(finalScore);
      const calculatedGradeDescription = getGradeDescription(calculatedGrade);
      
      console.log('📊 Quiz results:', {
        correctAnswers,
        totalQuestions,
        finalScore,
        calculatedGrade,
        calculatedGradeDescription
      });
      
      // Ustaw wartości w stanie
      setGrade(calculatedGrade);
      setGradeDescription(calculatedGradeDescription);
      
      // Save quiz results to Firestore
      const quizResult = {
        quiz_id: quiz.id,
        user_id: user.uid,
        user_email: user.email,
        score: finalScore,
        answers: {
          selected: selectedAnswers,
          open: openAnswers
        },
        completed_at: new Date(),
        timestamp: serverTimestamp(),
        course_id: quiz.course_id || slug
      };
      
      console.log('Saving quiz result to Firestore:', quizResult);
      
      // Save to quiz_results collection
      const resultDoc = await addDoc(collection(db, 'quiz_results'), quizResult);
      console.log('Quiz result saved with ID:', resultDoc.id);
      
      // Update quiz attempts
      const attemptData = {
        quiz_id: quiz.id,
        user_id: user.uid,
        user_email: user.email,
        attempt_date: serverTimestamp(),
        score: finalScore
      };
      
      console.log('Saving quiz attempt to Firestore:', attemptData);
      
      const attemptDoc = await addDoc(collection(db, 'quiz_attempts'), attemptData);
      console.log('Quiz attempt saved with ID:', attemptDoc.id);
      
      // 🆕 AUTOMATYCZNE WYSTAWIANIE OCENY DO DZIENNIKA
      try {
        // Pobierz ID nauczyciela z kursu
        console.log('🔍 Looking for course with ID:', quiz.course_id);
        // Poprawka: quiz.course_id to już document ID, nie pole 'id'
        const courseDocRef = doc(db, 'courses', quiz.course_id);
        const courseDocSnap = await getDoc(courseDocRef);
        if (courseDocSnap.exists()) {
          const courseData = courseDocSnap.data();
          const courseDocId = courseDocSnap.id;
          console.log('📚 Found course data:', courseData);
          console.log('📚 Course document ID:', courseDocId);
          const teacherEmail = courseData.created_by_email || courseData.teacherEmail || courseData.created_by;
          
          // Sprawdź czy już istnieje ocena z tego quizu
          const existingGradesQuery = query(
            collection(db, 'grades'),
            where('user_id', '==', user.uid),
            where('quiz_id', '==', quiz.id)
          );
          
          const existingGradesSnapshot = await getDocs(existingGradesQuery);
          
          // Określ numer próby dla opisu
          const currentAttemptNumber = attemptsCount + 1;
          
          // Jeśli już istnieje ocena z tego quizu, sprawdź czy nowa jest lepsza
          if (!existingGradesSnapshot.empty) {
            const existingGradeDoc = existingGradesSnapshot.docs[0];
            const existingGradeData = existingGradeDoc.data();
            const existingGrade = existingGradeData.value;
            
            // Aktualizuj tylko jeśli nowa ocena jest lepsza (wyższa)
            if (calculatedGrade > existingGrade) {
              await updateDoc(doc(db, 'grades', existingGradeDoc.id), {
                value: calculatedGrade,
                comment: `Quiz: ${quiz.title} - ${finalScore}% (${calculatedGradeDescription}) - Próba ${currentAttemptNumber} - NAJLEPSZE PODEJŚCIE`,
                graded_by: teacherEmail,
                graded_at: new Date().toISOString(),
                quiz_title: quiz.title,
                subject: quiz.subject || 'Quiz',
                grade_type: 'Quiz',
                percentage: finalScore,
                attempt_number: currentAttemptNumber,
                is_best_attempt: true
              });
              console.log(`✅ Zaktualizowano ocenę ${calculatedGrade} (${calculatedGradeDescription}) w dzienniku za quiz "${quiz.title}" - Próba ${currentAttemptNumber} - NOWA NAJLEPSZA OCENA`);

              // 🔔 Dodaj powiadomienie dla ucznia o zaktualizowanej ocenie
              try {
                const notificationData = {
                  user_id: user.uid,
                  type: 'grade',
                  title: 'Zaktualizowana ocena',
                  message: `Ocena z quizu "${quiz.title}" została poprawiona na ${calculatedGrade}`,
                  timestamp: new Date().toISOString(),
                  read: false,
                  course_id: courseDocId,
                  course_title: courseData.title || courseData.name || quiz.subject || 'Quiz',
                  grade_value: calculatedGrade,
                  quiz_title: quiz.title,
                  action_url: '/homelogin/student/grades',
                  created_at: serverTimestamp()
                };
                
                await addDoc(collection(db, 'notifications'), notificationData);
                console.log('🔔 Dodano powiadomienie o zaktualizowanej ocenie dla ucznia');
              } catch (notificationError) {
                console.error('❌ Błąd podczas dodawania powiadomienia o aktualizacji:', notificationError);
              }
            } else {
              console.log(`ℹ️ Ocena ${calculatedGrade} nie jest lepsza od istniejącej ${existingGrade} - nie aktualizowano dziennika`);
            }
          } else {
            // Dodaj nową ocenę
            const newGrade = {
              user_id: user.uid,
              course_id: courseDocId,
              value: calculatedGrade,
              comment: `Quiz: ${quiz.title} - ${finalScore}% (${calculatedGradeDescription}) - Próba ${currentAttemptNumber} - NAJLEPSZE PODEJŚCIE`,
              graded_by: teacherEmail,
              graded_at: new Date().toISOString(),
              quiz_id: quiz.id,
              quiz_title: quiz.title,
              subject: courseData.title || courseData.name || quiz.subject || 'Quiz',
              grade_type: 'Quiz',
              studentEmail: user.email,
              studentName: (user as any).displayName || user.email,
              teacherEmail: courseData.teacherEmail || courseData.created_by_email,
              percentage: finalScore,
              attempt_number: currentAttemptNumber,
              is_best_attempt: true,
              createdAt: serverTimestamp()
            };
            
            const gradeDoc = await addDoc(collection(db, 'grades'), newGrade);
            console.log(`✅ Dodano ocenę ${calculatedGrade} (${calculatedGradeDescription}) do dziennika za quiz "${quiz.title}" - Próba ${currentAttemptNumber}`);
            console.log('📝 Grade document ID:', gradeDoc.id);
            console.log('📊 Grade data saved:', newGrade);

            // 🔔 Dodaj powiadomienie dla ucznia o nowej ocenie
            try {
              const notificationData = {
                user_id: user.uid,
                type: 'grade',
                title: 'Nowa ocena',
                message: `Otrzymano ocenę ${calculatedGrade} z quizu "${quiz.title}"`,
                timestamp: new Date().toISOString(),
                read: false,
                course_id: courseDocId,
                course_title: courseData.title || courseData.name || quiz.subject || 'Quiz',
                grade_value: calculatedGrade,
                quiz_title: quiz.title,
                action_url: '/homelogin/student/grades',
                created_at: serverTimestamp()
              };
              
              await addDoc(collection(db, 'notifications'), notificationData);
              console.log('🔔 Dodano powiadomienie o nowej ocenie dla ucznia');
            } catch (notificationError) {
              console.error('❌ Błąd podczas dodawania powiadomienia:', notificationError);
            }
          }
        } else {
          console.warn('⚠️ Nie znaleziono kursu dla quizu:', quiz.course_id);
        }
      } catch (gradeError) {
        console.error('❌ Błąd podczas dodawania oceny do dziennika:', gradeError);
        // Nie przerywamy procesu - quiz został zapisany, tylko ocena się nie dodała
      }
      
      // Mark quiz as submitted
      setQuizSubmitted(true);
      console.log('Quiz submission completed successfully!');
      
    } catch (error) {
      console.error('Detailed error during quiz submission:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      setError(`Nie udało się zapisać wyników quizu: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setSubmitting(false);
    }
  }, [quiz, user, selectedAnswers, openAnswers, slug, attemptsCount]);

  const fetchAttempts = useCallback(async (quizId: string) => {
    if (!user) return 0;
    
    try {
      const attemptsCollection = collection(db, 'quiz_attempts');
      const attemptsQuery = query(
        attemptsCollection,
        where('user_id', '==', user.uid),
        where('quiz_id', '==', quizId)
      );
      
      const attemptsSnapshot = await getDocs(attemptsQuery);
      return attemptsSnapshot.size;
    } catch (error) {
        console.error('Error fetching quiz attempts:', error);
      return 0;
    }
  }, [user]);

  const fetchQuiz = useCallback(async () => {
    try {
      console.log('🔄 Starting fetchQuiz with ID:', quizId);
      console.log('Firebase db object:', db);
      setLoading(true);

      const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
      if (!quizDoc.exists()) throw new Error('Quiz not found');

      const data = quizDoc.data() as DocumentData;
      console.log('Quiz data from Firestore:', data);
      
      const questions = data.questions?.map((q: DocumentData, index: number) => ({
        ...q,
        id: q.id || `question_${index}_${generateUUID()}`,
        answers: q.answers?.map((a: DocumentData, answerIndex: number) => ({
          ...a,
          id: a.id || `answer_${index}_${answerIndex}_${generateUUID()}`
        })) || []
      })) || [];

      console.log('Processed questions with IDs:', questions.map((q: any) => ({ id: q.id, title: q.content?.substring(0, 50) })));

      const quizData: Quiz = {
        id: quizDoc.id,
        title: data.title,
        description: data.description,
        subject: data.subject,
        course_id: data.course_id,
        course_title: data.course_title || '',
        questions,
        max_attempts: data.max_attempts || 1,
        time_limit: data.time_limit || undefined,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
        created_by: data.created_by || null
      };
      
      console.log('Final quiz data:', quizData);
      setQuiz(quizData);
      
      // Initialize timer based on quiz time_limit
      if (quizData.time_limit) {
        setTimeLeft(quizData.time_limit * 60); // Convert minutes to seconds
      } else {
        setTimeLeft(null); // No time limit
      }
      
      // Check attempts
      if (user) {
        const attempts = await fetchAttempts(quizId);
        setAttemptsCount(attempts);
        if (attempts >= quizData.max_attempts) {
          setMaxAttemptsReached(true);
          setError('Wykorzystano maksymalną liczbę prób dla tego quizu.');
          router.push(`/courses/${slug}`);
          return;
        }
      }
    } catch (err) {
      console.error('Detailed error fetching quiz:', err);
      if (err instanceof Error) {
        console.error('Error message:', err.message);
        console.error('Error stack:', err.stack);
        setError(`Błąd ładowania quizu: ${err.message}`);
      } else {
        console.error('Unknown error:', err);
        setError('Nie udało się załadować quizu - nieznany błąd');
      }
    } finally {
      setLoading(false);
    }
  }, [router, slug, quizId, fetchAttempts, user]);

  useEffect(() => {
    if (slug && quizId && !authLoading && user) {
      console.log('🔄 Starting fetchQuiz - auth ready');
      fetchQuiz();
    }
  }, [fetchQuiz, slug, quizId, authLoading, user]);

  // Timer functionality
  useEffect(() => {
    // Don't start timer if there's no time limit or quiz is already submitted
    if (!quizStarted || timeLeft === null || timeLeft <= 0 || quizSubmitted || timeExpired) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          // Time's up - auto-submit quiz
          setTimeExpired(true);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [quizStarted, timeLeft, quizSubmitted, timeExpired, handleSubmit]);
  
  // Format time for display
  const formatTime = (seconds: number | null) => {
    if (seconds === null) return 'Bez limitu';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // Check if time is running low (less than 1 minute)
  const isTimeRunningLow = timeLeft !== null && timeLeft < 60 && timeLeft > 0;
  
  // Start quiz when first question is loaded
  useEffect(() => {
    if (quiz && !quizStarted) {
      setQuizStarted(true);
    }
  }, [quiz, quizStarted]);

  // Count answered questions
  const getAnsweredCount = useCallback(() => {
    if (!quiz) return 0;
    
    return quiz.questions.filter(question => {
      if (question.type === 'open' || !question.answers?.length) {
        return openAnswers[question.id]?.content?.trim();
      } else {
        return selectedAnswers[question.id];
      }
    }).length;
  }, [quiz, openAnswers, selectedAnswers]);
  
  // Calculate completion percentage
  const getCompletionPercentage = useCallback(() => {
    if (!quiz) return 0;
    return Math.round((getAnsweredCount() / quiz.questions.length) * 100);
  }, [quiz, getAnsweredCount]);

  // Check if current question is answered
  const isCurrentQuestionAnswered = useCallback(() => {
    if (!quiz || currentQuestionIndex < 0 || currentQuestionIndex >= quiz.questions.length) {
      console.log('❌ isCurrentQuestionAnswered: invalid quiz or index');
      return false;
    }
    
    const currentQuestion = quiz.questions[currentQuestionIndex];
    if (!currentQuestion) {
      console.log('❌ isCurrentQuestionAnswered: no current question');
      return false;
    }
    
    let isAnswered = false;
    if (currentQuestion.type === 'open' || !currentQuestion.answers?.length) {
      isAnswered = !!(openAnswers[currentQuestion.id]?.content?.trim());
    } else {
      isAnswered = !!(selectedAnswers[currentQuestion.id]);
    }
    
    console.log('🔍 isCurrentQuestionAnswered:', {
      questionId: currentQuestion.id,
      questionType: currentQuestion.type,
      isAnswered,
      openAnswer: openAnswers[currentQuestion.id],
      selectedAnswer: selectedAnswers[currentQuestion.id]
    });
    
    return isAnswered;
  }, [quiz, currentQuestionIndex, openAnswers, selectedAnswers]);


  if (authLoading || loading) return <div className="p-4">Ładowanie quizu...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!quiz) return <QuizNotFound />;
  if (!quiz.questions || quiz.questions.length === 0) return <div className="p-4 text-red-500">Quiz nie ma pytań</div>;
  if (maxAttemptsReached) return <div className="p-4 text-red-500">Wykorzystano maksymalną liczbę prób dla tego quizu.</div>;
  if (timeExpired && !quizSubmitted) {
    // Show message while auto-submitting
    return (
      <div className="p-4 text-center">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-6 max-w-md mx-auto">
          <h2 className="text-xl font-bold mb-2">Czas minął!</h2>
          <p>Quiz zostanie automatycznie zakończony...</p>
        </div>
      </div>
    );
  }

  // Reset question index if out of range
  if (currentQuestionIndex < 0 || currentQuestionIndex >= quiz.questions.length) {
    setCurrentQuestionIndex(0);
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];

  if (!currentQuestion) {
    return <div className="p-4 text-red-500">Błąd: Nie znaleziono pytania</div>;
  }

  // Funkcja do sprawdzania czy odpowiedź jest poprawna
  const isAnswerCorrect = (question: Question): boolean => {
    if (question.type === 'open' || !question.answers?.length) {
      const userAnswer = openAnswers[question.id]?.content?.trim().toLowerCase() || '';
      const correctAnswer = question.answers[0]?.content?.trim().toLowerCase();
      return userAnswer === correctAnswer;
    } else {
      const selectedAnswerId = selectedAnswers[question.id];
      const correctAnswer = question.answers.find(answer => answer.is_correct === true);
      return selectedAnswerId === correctAnswer?.id;
    }
  };

  // Funkcja do renderowania pytania z wynikami
  const renderQuestionWithResults = (question: Question) => {
    if (!question) {
      return <div className="p-4 text-red-500">Błąd: Nieprawidłowe pytanie</div>;
    }

    const isCorrect = isAnswerCorrect(question);

    return (
      <div className="bg-white rounded-xl border-2 p-6 shadow-sm">
        {/* Header pytania z wynikiem */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="text-lg font-semibold text-gray-900 mb-2">
              {question.content || 'Brak treści pytania'}
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            isCorrect 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {isCorrect ? '✓ Poprawne' : '✗ Błędne'}
          </div>
        </div>

        {/* Odpowiedzi */}
        <div className="space-y-3">
          {(question.type === 'open' || !question.answers?.length) ? (
            // Pytania otwarte
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm font-medium text-gray-700 mb-2">Twoja odpowiedź:</div>
                <div className="text-gray-900">
                  {openAnswers[question.id]?.type === 'math' ? (
                    <MathView content={openAnswers[question.id]?.content || ''} />
                  ) : (
                    <p className="italic">{openAnswers[question.id]?.content || 'Brak odpowiedzi'}</p>
                  )}
                </div>
              </div>
              
              <div className={`p-4 rounded-lg border-2 ${
                isCorrect ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="text-sm font-medium text-gray-700 mb-2">Poprawna odpowiedź:</div>
                <div className="text-gray-900">
                  {question.answers[0]?.type === 'math' ? (
                    <MathView content={question.answers[0].content} />
                  ) : (
                    <p className="font-medium">{question.answers[0]?.content}</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Pytania wielokrotnego wyboru
            (question.answers || []).map((answer, index) => {
              const isSelected = selectedAnswers[question.id] === answer.id;
              const isCorrectAnswer = answer.is_correct === true;
              
              let answerStyle = 'bg-gray-50 border-gray-200 text-gray-700';
              let icon = '';
              
              if (isCorrectAnswer) {
                answerStyle = 'bg-green-50 border-green-300 text-green-800';
                icon = '✓';
              } else if (isSelected && !isCorrectAnswer) {
                answerStyle = 'bg-red-50 border-red-300 text-red-800';
                icon = '✗';
              }
              
              return (
                <div
                  key={answer.id}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 ${answerStyle}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      isCorrectAnswer ? 'bg-green-500 text-white' : 
                      isSelected ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-600'
                    }`}>
                      {String.fromCharCode(65 + index)}
                    </div>
                    <div className="flex-1">
                      <span className="font-medium">{answer.content || 'Brak treści odpowiedzi'}</span>
                    </div>
                    {icon && (
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                        isCorrectAnswer ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                      }`}>
                        {icon}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderQuestion = (question: Question) => {
    if (!question) {
      return <div className="p-4 text-red-500">Błąd: Nieprawidłowe pytanie</div>;
    }

    if (quizSubmitted) {
      return renderQuestionWithResults(question);
    }

    return (
      <div className="space-y-4">
        {(question.type === 'open' || !question.answers?.length) ? (
          <div className="space-y-4">
            <QuizAnswerInput
              onSubmit={(answer) => {
                setOpenAnswers(prev => ({ ...prev, [question.id]: answer }));
                // Don't auto-advance - let user control navigation
              }}
              disabled={quizSubmitted}
            />
            <div className="text-sm text-blue-600 italic">
              Odpowiedź została zapisana. Użyj przycisku &quot;Następne&quot; aby przejść dalej.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {(question.answers || []).map((answer, index) => (
              <label
                key={answer.id}
                className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-blue-300 ${
                  selectedAnswers[question.id] === answer.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={answer.id}
                  checked={selectedAnswers[question.id] === answer.id}
                  onChange={() => {
                  setSelectedAnswers(prev => ({ ...prev, [question.id]: answer.id }));
                }}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="ml-3 text-gray-900">
                <span className="font-medium">{String.fromCharCode(65 + index)})</span>{' '}
                {answer.content || 'Brak treści odpowiedzi'}
                </span>
              </label>
            ))}
            {selectedAnswers[question.id] && (
              <div className="text-sm text-blue-600 italic mt-2">
                Odpowiedź została wybrana. Użyj przycisku &quot;Następne&quot; aby przejść dalej.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (quizSubmitted) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        {/* Theme Toggle */}
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        
        <h1 className="text-2xl font-bold mb-6">{quiz.title} - Wyniki</h1>
        
        {/* Wyniki quizu */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 mb-8">
          <div className="text-center mb-8">
            {timeExpired && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4">
                <p className="font-semibold">⏰ Czas minął! Quiz został automatycznie zakończony.</p>
              </div>
            )}
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {grade >= 3 ? 'Gratulacje! Quiz ukończony' : 'Quiz ukończony'}
            </h2>
            
            {/* Procent i pasek postępu */}
            <div className="mb-6">
              <div className="text-4xl font-bold text-blue-600 mb-2">
                {score.toFixed(1)}%
              </div>
              <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-6 bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
            
            {/* Ocena */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg ${getGradeColor(grade)}`}>
                {grade}
              </div>
              <div className="text-left">
                <div className="text-2xl font-bold text-gray-900">{gradeDescription}</div>
                <div className="text-gray-600">Ocena: {grade}/5</div>
              </div>
            </div>
            
            {/* Statystyki */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{score.toFixed(1)}%</div>
                <div className="text-sm text-blue-800">Wynik procentowy</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{grade}</div>
                <div className="text-sm text-green-800">Ocena</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{quiz.questions.length}</div>
                <div className="text-sm text-purple-800">Liczba pytań</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{attemptsCount} / {quiz.max_attempts}</div>
                <div className="text-sm text-orange-800">Próby</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Podgląd pytań z wynikami */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Podgląd odpowiedzi</h3>
              <p className="text-gray-600">Sprawdź swoje odpowiedzi i poprawne rozwiązania</p>
            </div>
          </div>
          
          {/* Statystyki odpowiedzi */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {(() => {
              const correctCount = quiz.questions.filter(q => isAnswerCorrect(q)).length;
              const incorrectCount = quiz.questions.length - correctCount;
              
              return (
                <>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="font-semibold text-green-800">Poprawne</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600">{correctCount}</div>
                  </div>
                  
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="font-semibold text-red-800">Błędne</span>
                    </div>
                    <div className="text-2xl font-bold text-red-600">{incorrectCount}</div>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="font-semibold text-blue-800">Łącznie</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">{quiz.questions.length}</div>
                  </div>
                </>
              );
            })()}
          </div>
          
          <div className="space-y-6">
            {quiz.questions.map((question, index) => (
              <div key={`question-${index}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {index + 1}
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900">Pytanie {index + 1}</h4>
                </div>
                {renderQuestion(question)}
              </div>
            ))}
          </div>
        </div>
        <div className="text-center">
          <button
            onClick={() => router.back()}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 font-medium shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2 mx-auto"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Wróć do kursu
          </button>
        </div>
      </div>
    );
  }

  // Block interactions if time expired
  const isBlocked = timeExpired && !quizSubmitted;

  return (
    <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Top Navigation Bar */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="text-xl font-bold text-blue-600">Cogito</div>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <button className="px-4 py-2 text-gray-600 hover:text-gray-900">
                Panel Nauczyciela
              </button>
              <button className="px-4 py-2 bg-black text-white rounded-lg">
                Widok Ucznia
              </button>
            </div>
          </div>
        </div>
      </div>

    <div className={`max-w-4xl mx-auto p-6 ${isBlocked ? 'pointer-events-none opacity-50' : ''}`}>
        {/* Quiz Header Card */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{quiz.title}</h1>
          
          {/* Attempts and Error Info */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}
          
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg">
            <div className="text-sm">
              Próba: {attemptsCount + 1} / {quiz.max_attempts}
              {attemptsCount >= quiz.max_attempts - 1 && (
                <span className="ml-2 text-orange-600 font-medium">
                  To jest Twoja ostatnia próba!
                </span>
              )}
            </div>
          </div>
          
          {/* Quiz Info Bar */}
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-6">
              <div className="text-sm text-gray-600">
          Pytanie {currentQuestionIndex + 1} / {quiz.questions.length}
        </div>
              {timeLeft !== null && (
                <div className={`flex items-center space-x-2 text-sm font-medium ${
                  isTimeRunningLow ? 'text-red-600 animate-pulse' : 'text-gray-600'
                }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-mono">{formatTime(timeLeft)}</span>
                  {isTimeRunningLow && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Czas się kończy!</span>
                  )}
              </div>
              )}
              <div className="text-sm text-gray-600">
                {getAnsweredCount()} / {quiz.questions.length} odpowiedzi
              </div>
            </div>
          </div>
        </div>

        {/* Main Question Card */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          {/* Question Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-semibold text-gray-900">
              Pytanie {currentQuestionIndex + 1}
            </div>
            <div className="text-sm text-gray-500 bg-blue-100 px-3 py-1 rounded-full">
              {currentQuestion.points || 1} pkt
        </div>
      </div>

          {/* Question Content */}
          <div className="mb-6">
            <p className="text-gray-900 text-lg leading-relaxed">
              {currentQuestion.content || 'Brak treści pytania'}
            </p>
          </div>

          {/* Answer Options */}
          {isBlocked ? (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4">
              <p className="font-semibold">Czas minął! Quiz zostanie automatycznie zakończony...</p>
            </div>
          ) : (
            renderQuestion(currentQuestion)
          )}
        </div>

        {/* Progress and Navigation */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          {/* Progress Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{getAnsweredCount()}</div>
              <div className="text-sm text-gray-600">Odpowiedzi</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{quiz.questions.length - getAnsweredCount()}</div>
              <div className="text-sm text-gray-600">Pozostało</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{getCompletionPercentage()}%</div>
              <div className="text-sm text-gray-600">Ukończono</div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
        <button
              onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
          disabled={currentQuestionIndex === 0}
              className="px-6 py-3 text-blue-600 disabled:text-gray-400 font-medium flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Poprzednie</span>
            </button>

            {/* Question Paginator */}
            <div className="flex space-x-2">
              {quiz.questions.map((_, index) => {
                const isAnswered = quiz.questions[index].type === 'open' || !quiz.questions[index].answers?.length
                  ? openAnswers[quiz.questions[index].id]?.content?.trim()
                  : selectedAnswers[quiz.questions[index].id];
                
                return (
                  <button
                    key={index}
                    onClick={() => setCurrentQuestionIndex(index)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      index === currentQuestionIndex
                        ? 'bg-blue-600 text-white'
                        : isAnswered
                        ? 'bg-green-100 text-green-800 border-2 border-green-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {index + 1}
        </button>
                );
              })}
            </div>

        {currentQuestionIndex === quiz.questions.length - 1 ? (
          <button
            onClick={handleSubmit}
                disabled={!isCurrentQuestionAnswered()}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Zakończ quiz
          </button>
        ) : (
          <button
                onClick={() => setCurrentQuestionIndex(prev => Math.min(quiz.questions.length - 1, prev + 1))}
                disabled={!isCurrentQuestionAnswered()}
                className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center space-x-2"
              >
                <span>Następne</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
          </button>
        )}
          </div>
          </div>
        </div>
        
        {/* Przyciski akcji */}
        <div className="flex justify-center gap-4 mt-8">
          <button
            onClick={() => router.push(`/courses/${slug}`)}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Powrót do kursu
          </button>
          
          {attemptsCount < quiz.max_attempts && (
            <button
              onClick={() => {
                // Resetuj stan quizu i rozpocznij nową próbę
                setQuizSubmitted(false);
                setCurrentQuestionIndex(0);
                setSelectedAnswers({});
                setOpenAnswers({});
                setScore(0);
                setGrade(0);
                setGradeDescription('');
                setTimeLeft(quiz.time_limit ? quiz.time_limit * 60 : null);
                setQuizStarted(false);
                setTimeExpired(false);
                // Odśwież liczbę prób
                fetchAttempts(quizId).then(count => {
                  setAttemptsCount(count);
                  if (count >= quiz.max_attempts) {
                    setMaxAttemptsReached(true);
                  }
                });
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Rozpocznij nową próbę ({attemptsCount + 1} / {quiz.max_attempts})
            </button>
          )}
        </div>
      </div>
  );
}

export default function QuizTaking() {
  return (
    <Providers>
      <QuizTakingContent />
    </Providers>
  );
}
