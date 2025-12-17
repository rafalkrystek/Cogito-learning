'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, doc, getDocs, addDoc, updateDoc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Quiz, QuizAttempt } from '../types/models';
import { calculateGradeFromPercentage, getGradeDescription, getGradeColor } from '../utils/gradeCalculator';

interface FirebaseQuizDisplayProps {
  quizId: string;
  onBack: () => void;
}

export const FirebaseQuizDisplay: React.FC<FirebaseQuizDisplayProps> = ({ quizId, onBack }) => {
  const { user } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [currentAttempt, setCurrentAttempt] = useState<QuizAttempt | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gradeAdded, setGradeAdded] = useState<{grade: number, description: string} | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Timer sprawdzający deadline podczas rozwiązywania quizu
  useEffect(() => {
    if (!currentAttempt || !quiz) return;
    
    const deadline = (quiz as any).submission_deadline ? new Date((quiz as any).submission_deadline) : null;
    const availableTimeMs = (currentAttempt as any).available_time_ms;
    
    if (!deadline && !availableTimeMs) return;
    
    const updateTimer = () => {
      const now = new Date();
      
      if (deadline) {
        const remaining = deadline.getTime() - now.getTime();
        if (remaining <= 0) {
          // Deadline minął - automatycznie zakończ quiz
          submitQuiz();
          return;
        }
        setTimeRemaining(remaining);
      } else if (availableTimeMs) {
        const startedAt = new Date(currentAttempt.started_at);
        const elapsed = now.getTime() - startedAt.getTime();
        const remaining = availableTimeMs - elapsed;
        if (remaining <= 0) {
          // Czas minął - automatycznie zakończ quiz
          submitQuiz();
          return;
        }
        setTimeRemaining(remaining);
      }
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000); // Aktualizuj co sekundę
    
    return () => clearInterval(interval);
  }, [currentAttempt, quiz]);

  useEffect(() => {
    if (!user || !quizId) return;
    
    const fetchQuizAndAttempts = async () => {
      try {
        setLoading(true);
        
        // Pobierz quiz
        const quizDoc = await getDocs(query(collection(db, 'quizzes'), where('id', '==', quizId)));
        if (quizDoc.empty) {
          setError('Quiz nie został znaleziony');
          return;
        }
        
        const quizData = { id: quizDoc.docs[0].id, ...quizDoc.docs[0].data() } as Quiz;
        setQuiz(quizData);
        
        // Pobierz próby użytkownika dla tego quizu
        const attemptsQuery = query(
          collection(db, 'quiz_attempts'),
          where('quiz_id', '==', quizId),
          where('user_id', '==', user.uid),
          orderBy('started_at', 'desc')
        );
        
        const attemptsSnapshot = await getDocs(attemptsQuery);
        const userAttempts = attemptsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as QuizAttempt[];
        
        setAttempts(userAttempts);
        
        console.log('Quiz:', quizData);
        console.log('User attempts:', userAttempts);
        console.log('Max attempts:', quizData.max_attempts);
        
      } catch (error) {
        console.error('Error fetching quiz and attempts:', error);
        setError('Błąd podczas ładowania quizu');
      } finally {
        setLoading(false);
      }
    };

    fetchQuizAndAttempts();
  }, [user, quizId]);

  const startNewAttempt = async () => {
    if (!user || !quiz) return;
    
    try {
      setIsSubmitting(true);
      
      const now = new Date();
      const deadline = (quiz as any).submission_deadline ? new Date((quiz as any).submission_deadline) : null;
      const startTime = (quiz as any).start_time ? new Date((quiz as any).start_time) : null;
      const timeLimit = (quiz as any).time_limit || 30; // w minutach
      
      // Sprawdź czy można rozpocząć
      if (startTime && now < startTime) {
        setError('Egzamin jeszcze nie jest dostępny');
        setIsSubmitting(false);
        return;
      }
      
      if (deadline && now > deadline) {
        setError('Czas na wykonanie egzaminu minął');
        setIsSubmitting(false);
        return;
      }
      
      // Oblicz rzeczywisty czas dostępny (deadline vs time_limit)
      let availableTimeMs = timeLimit * 60 * 1000; // czas w milisekundach
      if (deadline) {
        const timeUntilDeadline = deadline.getTime() - now.getTime();
        availableTimeMs = Math.min(availableTimeMs, timeUntilDeadline);
      }
      
      const attemptNumber = attempts.length + 1;
      
      const newAttempt: any = {
        user_id: user.uid,
        quiz_id: quizId,
        started_at: new Date().toISOString(),
        answers: {},
        time_spent: 0,
        attempt_number: attemptNumber,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        created_by: user.uid,
        available_time_ms: availableTimeMs, // Zapisz dostępny czas
        deadline: deadline ? deadline.toISOString() : null
      };
      
      const docRef = await addDoc(collection(db, 'quiz_attempts'), newAttempt);
      const attemptWithId = { id: docRef.id, ...newAttempt } as QuizAttempt;
      
      setCurrentAttempt(attemptWithId);
      setSelectedAnswers({});
      setCurrentQuestionIndex(0);
      
    } catch (error) {
      console.error('Error starting new attempt:', error);
      setError('Błąd podczas rozpoczynania próby');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addGradeToDiary = async (score: number, quiz: Quiz, teacherId: string) => {
    try {
      // Oblicz ocenę na podstawie procentów
      const gradeValue = calculateGradeFromPercentage(score);
      const gradeDescription = getGradeDescription(gradeValue);
      
      // Sprawdź czy już istnieje ocena z tego quizu
      const existingGradesQuery = query(
        collection(db, 'grades'),
        where('user_id', '==', user?.uid),
        where('quiz_id', '==', quiz.id)
      );
      
      const existingGradesSnapshot = await getDocs(existingGradesQuery);
      
      // Określ numer próby dla opisu
      const currentAttemptNumber = currentAttempt?.attempt_number || attempts.length + 1;
      
      // Jeśli już istnieje ocena z tego quizu, zaktualizuj ją
      if (!existingGradesSnapshot.empty) {
        // Zaktualizuj istniejącą ocenę
        for (const gradeDoc of existingGradesSnapshot.docs) {
          await updateDoc(doc(db, 'grades', gradeDoc.id), {
            value: gradeValue,
            comment: `Quiz: ${quiz.title} - ${score}% (${gradeDescription}) - Próba ${currentAttemptNumber}`,
            graded_at: new Date().toISOString(),
            quiz_title: quiz.title,
            subject: quiz.subject,
            grade_type: 'Quiz'
          });
        }
        console.log(`Zaktualizowano ocenę ${gradeValue} (${gradeDescription}) w dzienniku za quiz "${quiz.title}" - Próba ${currentAttemptNumber}`);
        setGradeAdded({grade: gradeValue, description: `Zaktualizowano ocenę w dzienniku - Próba ${currentAttemptNumber}`});
      } else {
        // Dodaj nową ocenę
        const newGrade: any = {
          user_id: user?.uid || '',
          course_id: quiz.course_id,
          value: gradeValue,
          comment: `Quiz: ${quiz.title} - ${score}% (${gradeDescription}) - Próba ${currentAttemptNumber}`,
          graded_by: teacherId,
          graded_at: new Date().toISOString(),
          quiz_id: quiz.id,
          quiz_title: quiz.title,
          subject: quiz.subject,
          grade_type: 'Quiz'
        };
        
        await addDoc(collection(db, 'grades'), newGrade);
        console.log(`Dodano ocenę ${gradeValue} (${gradeDescription}) do dziennika za quiz "${quiz.title}" - Próba ${currentAttemptNumber}`);
        setGradeAdded({grade: gradeValue, description: `Dodano ocenę do dziennika - Próba ${currentAttemptNumber}`});
      }
      
    } catch (error) {
      console.error('Error adding grade to diary:', error);
    }
  };

  const submitQuiz = async () => {
    if (!currentAttempt || !quiz || !user) return;
    
    try {
      setIsSubmitting(true);
      
      // Sprawdź deadline
      const deadline = (quiz as any).submission_deadline ? new Date((quiz as any).submission_deadline) : null;
      const now = new Date();
      if (deadline && now > deadline) {
        setError('Czas na wykonanie egzaminu minął. Quiz został automatycznie zakończony.');
        // Automatycznie zapisz odpowiedzi, które uczeń zdążył udzielić
      }
      
      // Oblicz wynik
      let correctAnswers = 0;
      const totalQuestions = quiz.questions.length;
      
      quiz.questions.forEach(question => {
        const userAnswer = selectedAnswers[question.id];
        if (userAnswer) {
          const correctAnswer = question.answers.find(answer => answer.is_correct);
          if (correctAnswer && userAnswer === correctAnswer.id) {
            correctAnswers++;
          }
        }
      });
      
      const score = Math.round((correctAnswers / totalQuestions) * 100);
      const timeSpent = Math.floor((Date.now() - new Date(currentAttempt.started_at).getTime()) / 1000);
      
      // Zaktualizuj próbę
      await updateDoc(doc(db, 'quiz_attempts', currentAttempt.id), {
        completed_at: new Date().toISOString(),
        score: score,
        answers: selectedAnswers,
        time_spent: timeSpent
      });
      
      // 🆕 NOWE - Dodaj ocenę do dziennika
      // Pobierz ID nauczyciela z kursu
      const courseDoc = await getDocs(query(collection(db, 'courses'), where('id', '==', quiz.course_id)));
      if (!courseDoc.empty) {
        const courseData = courseDoc.docs[0].data();
        const teacherId = courseData.created_by || courseData.teacherEmail || user.uid;
        
        // 🆕 NOWE - Zawsze dodaj/aktualizuj ocenę po każdej próbie
        // Jeśli max_attempts = 1, dodaj ocenę po pierwszej próbie
        // Jeśli max_attempts > 1, dodaj/aktualizuj ocenę po każdej próbie (ostatnia się liczy)
        await addGradeToDiary(score, quiz, teacherId);
      }
      
      // Odśwież listę prób
      const updatedAttempts = [...attempts];
      const attemptIndex = updatedAttempts.findIndex(a => a.id === currentAttempt.id);
      if (attemptIndex >= 0) {
        updatedAttempts[attemptIndex] = {
          ...currentAttempt,
          completed_at: new Date().toISOString(),
          score: score,
          answers: selectedAnswers,
          time_spent: timeSpent
        };
      } else {
        updatedAttempts.unshift({
          ...currentAttempt,
          completed_at: new Date().toISOString(),
          score: score,
          answers: selectedAnswers,
          time_spent: timeSpent
        });
      }
      
      setAttempts(updatedAttempts);
      setCurrentAttempt(null);
      setSelectedAnswers({});
      setCurrentQuestionIndex(0);
      
    } catch (error) {
      console.error('Error submitting quiz:', error);
      setError('Błąd podczas zapisywania wyników');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAnswerSelect = (questionId: string, answerId: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answerId
    }));
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < (quiz?.questions.length || 0) - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6FB] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#4067EC] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Ładowanie quizu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F4F6FB] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h3 className="text-xl font-semibold text-gray-600 mb-2">Błąd</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-[#4067EC] text-white rounded-lg hover:bg-[#3050b3] transition"
          >
            Powrót do listy quizów
          </button>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-[#F4F6FB] flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">📝</div>
          <h3 className="text-xl font-semibold text-gray-600 mb-2">Quiz nie znaleziony</h3>
          <p className="text-gray-500 mb-4">Quiz o podanym ID nie istnieje.</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-[#4067EC] text-white rounded-lg hover:bg-[#3050b3] transition"
          >
            Powrót do listy quizów
          </button>
        </div>
      </div>
    );
  }

  const completedAttempts = attempts.filter(attempt => attempt.completed_at);
  const canStartNewAttempt = completedAttempts.length < quiz.max_attempts;
  const currentQuestion = quiz.questions[currentQuestionIndex];
  const allQuestionsAnswered = quiz.questions.every(q => selectedAnswers[q.id]);

  // Logika czasowa
  const getQuizTimeStatus = () => {
    const now = new Date();
    const startTime = (quiz as any).start_time ? new Date((quiz as any).start_time) : null;
    const deadline = (quiz as any).submission_deadline ? new Date((quiz as any).submission_deadline) : null;

    // Jeśli nie ma deadline, quiz jest zawsze dostępny
    if (!deadline) {
      return { status: 'available', message: null };
    }

    // Jeśli jest start_time i jeszcze nie minął
    if (startTime && now < startTime) {
      return {
        status: 'before',
        message: `Egzamin dostępny od: ${startTime.toLocaleString('pl-PL', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`
      };
    }

    // Jeśli deadline minął
    if (now > deadline) {
      return {
        status: 'after',
        message: 'Czas na wykonanie egzaminu minął'
      };
    }

    // W trakcie okna czasowego
    return { status: 'available', message: null };
  };

  const timeStatus = getQuizTimeStatus();
  const isTimeBlocked = timeStatus.status === 'before' || timeStatus.status === 'after';

  // Jeśli użytkownik nie może rozpocząć nowej próby
  if (!canStartNewAttempt && !currentAttempt) {
    return (
      <div className="min-h-screen bg-[#F4F6FB] p-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={onBack}
            className="mb-4 px-4 py-2 bg-[#4067EC] text-white rounded-lg hover:bg-[#3050b3] transition flex items-center gap-2"
          >
            ← Powrót do listy quizów
          </button>
          
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6">
            <div className="text-center">
              <div className="text-orange-500 text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Limit prób przekroczony</h2>
              <p className="text-gray-600 mb-4">
                Wykorzystałeś wszystkie dostępne próby dla tego quizu.
              </p>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-800 mb-2">Twoje próby:</h3>
                <div className="space-y-2">
                  {attempts.map((attempt, index) => (
                    <div key={attempt.id} className="flex justify-between items-center p-2 bg-white rounded border">
                      <span className="text-sm text-gray-600">
                        Próba {attempt.attempt_number || index + 1}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">
                          {new Date(attempt.started_at).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '/')}
                        </span>
                        {attempt.completed_at ? (
                          <span className={`px-2 py-1 rounded text-sm font-medium ${
                            (attempt.score || 0) >= 50 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {attempt.score}%
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
                            Nieukończona
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <p className="text-sm text-gray-500">
                Maksymalna liczba prób: <strong>{quiz.max_attempts}</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Jeśli nie ma aktywnej próby, pokaż informacje o quizie i przycisk start
  if (!currentAttempt) {
    return (
      <div className="min-h-screen bg-[#F4F6FB] p-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={onBack}
            className="mb-4 px-4 py-2 bg-[#4067EC] text-white rounded-lg hover:bg-[#3050b3] transition flex items-center gap-2"
          >
            ← Powrót do listy quizów
          </button>
          
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">{quiz.title}</h2>
            {/* Opis zawsze widoczny */}
            {quiz.description && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-gray-700 whitespace-pre-wrap">{quiz.description}</p>
              </div>
            )}
            
            {/* Komunikaty czasowe */}
            {timeStatus.message && (
              <div className={`mb-6 p-4 rounded-lg border ${
                timeStatus.status === 'before' 
                  ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <p className="font-semibold flex items-center gap-2">
                  {timeStatus.status === 'before' ? '⏰' : '❌'}
                  {timeStatus.message}
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-1">Liczba pytań</h3>
                <p className="text-2xl font-bold text-blue-600">{quiz.questions.length}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-1">Maksymalne próby</h3>
                <p className="text-2xl font-bold text-green-600">{quiz.max_attempts}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <h3 className="font-semibold text-orange-800 mb-1">Wykorzystane próby</h3>
                <p className="text-2xl font-bold text-orange-600">{completedAttempts.length}</p>
              </div>
            </div>
            
            {completedAttempts.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">Twoje poprzednie próby:</h3>
                <div className="space-y-2">
                  {attempts.map((attempt, index) => (
                    <div key={attempt.id} className="flex justify-between items-center p-2 bg-white rounded border">
                      <span className="text-sm text-gray-600">
                        Próba {attempt.attempt_number || index + 1} - {new Date(attempt.started_at).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '/')}
                      </span>
                      {attempt.completed_at ? (
                        <span className={`px-2 py-1 rounded text-sm font-medium ${
                          (attempt.score || 0) >= 50 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {attempt.score}%
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
                          Nieukończona
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="text-center">
              <button
                onClick={startNewAttempt}
                disabled={isSubmitting || !canStartNewAttempt || isTimeBlocked}
                className="px-8 py-3 bg-[#4067EC] text-white rounded-lg font-semibold hover:bg-[#3050b3] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Rozpoczynanie...' : 'Rozpocznij Quiz'}
              </button>
              {!canStartNewAttempt && (
                <p className="mt-2 text-sm text-gray-500">Wykorzystałeś wszystkie dostępne próby</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Aktywny quiz
  const formatTimeRemaining = (ms: number | null) => {
    if (ms === null) return null;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#F4F6FB] p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{quiz.title}</h2>
              <p className="text-gray-600">Pytanie {currentQuestionIndex + 1} z {quiz.questions.length}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Próba {currentAttempt.attempt_number || completedAttempts.length + 1} z {quiz.max_attempts}</div>
              <div className="text-sm text-gray-500">
                Rozpoczęto: {new Date(currentAttempt.started_at).toLocaleTimeString('pl-PL')}
              </div>
              {timeRemaining !== null && (
                <div className={`text-sm font-semibold mt-1 ${
                  timeRemaining < 60000 ? 'text-red-600' : timeRemaining < 300000 ? 'text-orange-600' : 'text-green-600'
                }`}>
                  ⏱️ Pozostało: {formatTimeRemaining(timeRemaining)}
                </div>
              )}
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-[#4067EC] h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }}
              ></div>
            </div>
          </div>
          
          {/* Question */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {currentQuestion.content}
            </h3>
            
            <div className="space-y-3">
              {currentQuestion.answers.map((answer) => (
                <label key={answer.id} className="flex items-center space-x-3 p-3 bg-white rounded-lg border hover:border-[#4067EC] cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    checked={selectedAnswers[currentQuestion.id] === answer.id}
                    onChange={() => handleAnswerSelect(currentQuestion.id, answer.id)}
                    className="form-radio text-[#4067EC]"
                  />
                  <span className="text-gray-700">{answer.content}</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* Navigation */}
          <div className="flex justify-between items-center">
            <button
              onClick={prevQuestion}
              disabled={currentQuestionIndex === 0}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Poprzednie
            </button>
            
            <div className="flex gap-2">
              {currentQuestionIndex === quiz.questions.length - 1 ? (
                <button
                  onClick={submitQuiz}
                  disabled={!allQuestionsAnswered || isSubmitting}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Zapisywanie...' : 'Zakończ quiz'}
                </button>
              ) : (
                <button
                  onClick={nextQuestion}
                  disabled={!selectedAnswers[currentQuestion.id]}
                  className="px-4 py-2 bg-[#4067EC] text-white rounded-lg hover:bg-[#3050b3] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Następne →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Komunikat o dodanej ocenie */}
      {gradeAdded && (
        <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm z-50">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${getGradeColor(gradeAdded.grade)}`}>
              {gradeAdded.grade}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-800 mb-1">Ocena w dzienniku</h4>
              <p className="text-sm text-gray-600 mb-2">{gradeAdded.description}</p>
              <p className="text-xs text-gray-500">Sprawdź swój dziennik ocen</p>
            </div>
            <button 
              onClick={() => setGradeAdded(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
