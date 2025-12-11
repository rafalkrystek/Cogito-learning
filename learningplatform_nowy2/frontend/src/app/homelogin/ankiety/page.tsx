'use client';
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Star, Users, TrendingUp, Send, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, addDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';

interface Teacher {
  uid: string;
  displayName: string;
  email: string;
  subject: string;
  role: string;
  photoURL?: string;
}

interface TeacherAverage {
  teacherId: string;
  teacherName: string;
  subject: string;
  averageScore: number;
  totalResponses: number;
}

const surveyQuestions = [
  {
    id: 'q1',
    question: 'Jak oceniasz jakość materiałów dydaktycznych udostępnianych przez nauczyciela?',
    category: 'Materiały'
  },
  {
    id: 'q2',
    question: 'Jak oceniasz sposób tłumaczenia i wyjaśniania zagadnień?',
    category: 'Komunikacja'
  },
  {
    id: 'q3',
    question: 'Jak oceniasz umiejętność przekazywania wiedzy w prosty i zrozumiały sposób?',
    category: 'Przekazywanie wiedzy'
  },
  {
    id: 'q4',
    question: 'Jak oceniasz zaangażowanie nauczyciela w prowadzenie zajęć online?',
    category: 'Zaangażowanie'
  },
  {
    id: 'q5',
    question: 'Jak oceniasz dostosowanie tempa zajęć do możliwości uczniów?',
    category: 'Dostosowanie'
  },
  {
    id: 'q6',
    question: 'Jak oceniasz komunikację i dostępność nauczyciela (np. odpowiadanie na pytania, pomoc poza zajęciami)?',
    category: 'Dostępność'
  },
  {
    id: 'q7',
    question: 'Jak oceniasz różnorodność metod i narzędzi wykorzystywanych podczas zajęć?',
    category: 'Metody'
  },
  {
    id: 'q8',
    question: 'Jak oceniasz umiejętność motywowania uczniów do nauki?',
    category: 'Motywacja'
  },
  {
    id: 'q9',
    question: 'Jak oceniasz przydatność wiedzy i umiejętności zdobywanych na zajęciach?',
    category: 'Przydatność'
  },
  {
    id: 'q10',
    question: 'Jak oceniasz ogólne wrażenie ze współpracy z tym nauczycielem?',
    category: 'Ogólne wrażenie'
  }
];

export default function AnkietyPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherAverages, setTeacherAverages] = useState<TeacherAverage[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [responses, setResponses] = useState<{ [key: string]: number | string }>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedSurveys, setSubmittedSurveys] = useState<string[]>([]);
  const [currentSurveyTemplate, setCurrentSurveyTemplate] = useState<any>(null);
  const [availableSurveys, setAvailableSurveys] = useState<any[]>([]);

  // Inicjalizacja odpowiedzi - używamy pytań z szablonu ankiety
  useEffect(() => {
    const questionsToUse = currentSurveyTemplate?.questions || surveyQuestions;
    const initialResponses: { [key: string]: number } = {};
    questionsToUse.forEach((q: any) => {
      initialResponses[q.id] = 5; // Domyślnie 5
    });
    setResponses(initialResponses);
  }, [currentSurveyTemplate]);

  // Pobieranie nauczycieli i dostępnych ankiet
  useEffect(() => {
    const fetchTeachersAndSurveys = async () => {
      try {
        console.log('Pobieranie nauczycieli z Firebase...');
        const teachersQuery = query(collection(db, 'users'), where('role', '==', 'teacher'));
        const teachersSnapshot = await getDocs(teachersQuery);
        const teachersList = teachersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Teacher));
        
        console.log('Znalezieni nauczyciele:', teachersList.map(t => ({
          uid: t.uid,
          name: t.displayName || t.email,
          subject: t.subject,
          email: t.email
        })));
        
        setTeachers(teachersList);

        // 🆕 NOWE - Pobierz dostępne ankiety
        console.log('Pobieranie dostępnych ankiet...');
        const surveysQuery = query(
          collection(db, 'surveyTemplates'),
          where('isActive', '==', true)
        );
        const surveysSnapshot = await getDocs(surveysQuery);
        const availableSurveysData = surveysSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as any));

        console.log(`Znaleziono ${availableSurveysData.length} dostępnych ankiet`);
        setAvailableSurveys(availableSurveysData);
        
        // Filtruj nauczycieli tylko do tych, którzy mają aktywne ankiety
        const teachersWithSurveys = teachersList.filter(teacher => 
          availableSurveysData.some(survey => survey.created_by === teacher.uid)
        );
        
        console.log(`Nauczyciele z aktywnymi ankietami: ${teachersWithSurveys.length}`);
        setTeachers(teachersWithSurveys);
        
      } catch (error) {
        console.error('Błąd podczas pobierania nauczycieli i ankiet:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeachersAndSurveys();
  }, []);

  // Pobieranie średnich ocen nauczycieli
  useEffect(() => {
    const fetchTeacherAverages = async () => {
      try {
        console.log('Pobieranie ankiet nauczycieli z Firebase...');
        const surveysQuery = query(collection(db, 'teacherSurveys'));
        const surveysSnapshot = await getDocs(surveysQuery);
        
        console.log(`Znaleziono ${surveysSnapshot.docs.length} ankiet w Firebase`);
        
        const teacherScores: { [key: string]: { total: number; count: number; name: string; subject: string } } = {};
        
        surveysSnapshot.docs.forEach((doc, index) => {
          const data = doc.data();
          console.log(`Ankieta ${index + 1}:`, {
            id: doc.id,
            teacherId: data.teacherId,
            teacherName: data.teacherName,
            subject: data.subject,
            studentId: data.studentId,
            totalScore: data.totalScore,
            averageScore: data.averageScore,
            responsesCount: data.responses ? Object.keys(data.responses).length : 0
          });
          
          if (data.teacherId && data.responses) {
            const scores = Object.values(data.responses).filter(score => typeof score === 'number');
            const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
            
            if (!teacherScores[data.teacherId]) {
              teacherScores[data.teacherId] = { total: 0, count: 0, name: data.teacherName, subject: data.subject || '' };
            }
            teacherScores[data.teacherId].total += average;
            teacherScores[data.teacherId].count += 1;
          }
        });

        const averages = Object.entries(teacherScores).map(([teacherId, data]) => ({
          teacherId,
          teacherName: data.name,
          subject: data.subject,
          averageScore: data.count > 0 ? data.total / data.count : 0,
          totalResponses: data.count
        }));

        console.log('Obliczone średnie oceny nauczycieli:', averages);
        setTeacherAverages(averages);
      } catch (error) {
        console.error('Błąd podczas pobierania średnich ocen:', error);
      }
    };

    fetchTeacherAverages();
  }, []);

  // Sprawdzanie już wypełnionych ankiet
  useEffect(() => {
    const checkSubmittedSurveys = async () => {
      if (!user) return;
      
      try {
        console.log('Sprawdzanie już wypełnionych ankiet dla użytkownika:', user.uid);
        const surveysQuery = query(
          collection(db, 'teacherSurveys'),
          where('studentId', '==', user.uid)
        );
        const surveysSnapshot = await getDocs(surveysQuery);
        const submittedIds = surveysSnapshot.docs.map(doc => doc.data().teacherId);
        
        console.log('Znalezione wypełnione ankiety:', {
          userId: user.uid,
          submittedCount: submittedIds.length,
          teacherIds: submittedIds
        });
        
        setSubmittedSurveys(submittedIds);
      } catch (error) {
        console.error('Błąd podczas sprawdzania wypełnionych ankiet:', error);
      }
    };

    checkSubmittedSurveys();
  }, [user]);

  // Ładowanie szablonu ankiety dla wybranego nauczyciela
  const loadSurveyTemplate = (teacherId: string) => {
    const surveyTemplate = availableSurveys.find(survey => survey.created_by === teacherId);
    if (surveyTemplate) {
      console.log('Ładowanie szablonu ankiety:', surveyTemplate);
      setCurrentSurveyTemplate(surveyTemplate);
    } else {
      console.log('Brak szablonu ankiety dla nauczyciela, używam domyślnego');
      setCurrentSurveyTemplate(null);
    }
  };

  const handleSliderChange = (questionId: string, value: number | string) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleSubmit = async () => {
    if (!selectedTeacher || !user) {
      console.error('Brak wybranego nauczyciela lub użytkownika');
      return;
    }

    // Walidacja odpowiedzi - używamy pytań z szablonu ankiety
    const questionsToUse = currentSurveyTemplate?.questions || surveyQuestions;
    const allQuestionsAnswered = questionsToUse.every((q: any) => {
      if (!q.required) return true; // Pytania opcjonalne są zawsze OK
      
      const response = responses[q.id];
      if (q.type === 'text') {
        return response && typeof response === 'string' && response.trim().length > 0;
      } else if (q.type === 'multiple_choice') {
        return response && typeof response === 'number' && response >= 1;
      } else {
        // Domyślny typ rating
        return response && typeof response === 'number' && response >= 1 && response <= 10;
      }
    });
    
    if (!allQuestionsAnswered) {
      console.error('Nie wszystkie wymagane pytania zostały odpowiedziane');
      alert('Proszę odpowiedzieć na wszystkie wymagane pytania');
      return;
    }

    setSubmitting(true);
    try {
      const selectedTeacherData = teachers.find(t => t.uid === selectedTeacher);
      if (!selectedTeacherData) {
        console.error('Nie znaleziono danych nauczyciela');
        return;
      }

      // 🆕 NOWE - Pobierz szablon ankiety dla tego nauczyciela
      const surveysQuery = query(
        collection(db, 'surveyTemplates'),
        where('created_by', '==', selectedTeacher),
        where('isActive', '==', true)
      );
      const surveysSnapshot = await getDocs(surveysQuery);
      
      let surveyTemplate: any = null;
      if (!surveysSnapshot.empty) {
        surveyTemplate = { id: surveysSnapshot.docs[0].id, ...surveysSnapshot.docs[0].data() };
      }

      // Przygotowanie danych do zapisu
      const surveyData = {
        teacherId: selectedTeacher,
        teacherName: selectedTeacherData.displayName || selectedTeacherData.email,
        subject: selectedTeacherData.subject || '',
        studentId: user.uid, // Do sprawdzania czy już wypełniona
        studentEmail: user.email || '', // Dodatkowa identyfikacja
        responses: responses,
        submittedAt: serverTimestamp(),
        isAnonymous: true, // Zapewnienie anonimowości
        totalScore: Object.values(responses).reduce((sum: number, score) => {
          if (typeof score === 'number') return sum + score;
          return sum;
        }, 0),
        averageScore: (() => {
          const numericResponses = Object.values(responses).filter(score => typeof score === 'number');
          return numericResponses.length > 0 ? numericResponses.reduce((sum, score) => sum + score, 0) / numericResponses.length : 0;
        })(),
        surveyTemplateId: surveyTemplate?.id || null, // 🆕 NOWE - ID szablonu ankiety
        surveyTitle: surveyTemplate?.title || 'Ankieta nauczyciela' // 🆕 NOWE - Tytuł ankiety
      };

      // Logowanie danych przed zapisem
      console.log('Zapisywanie ankiety do Firebase:', {
        teacherId: surveyData.teacherId,
        teacherName: surveyData.teacherName,
        subject: surveyData.subject,
        studentId: surveyData.studentId,
        totalScore: surveyData.totalScore,
        averageScore: surveyData.averageScore,
        responsesCount: Object.keys(surveyData.responses).length,
        responses: surveyData.responses
      });

      // Sprawdzenie czy ankieta już istnieje
      const existingSurveyQuery = query(
        collection(db, 'teacherSurveys'),
        where('teacherId', '==', selectedTeacher),
        where('studentId', '==', user.uid)
      );
      const existingSurveySnapshot = await getDocs(existingSurveyQuery);
      
      if (!existingSurveySnapshot.empty) {
        console.error('Ankieta dla tego nauczyciela już została wypełniona');
        alert('Już wypełniłeś ankietę dla tego nauczyciela');
        return;
      }

      // Zapisywanie do Firebase
      const docRef = await addDoc(collection(db, 'teacherSurveys'), surveyData);
      
      console.log('Ankieta została pomyślnie zapisana z ID:', docRef.id);

      // Aktualizacja UI
      setSubmittedSurveys(prev => [...prev, selectedTeacher]);
      setSubmitted(true);
      setSelectedTeacher('');
      setResponses(surveyQuestions.reduce((acc, q) => ({ ...acc, [q.id]: 5 }), {}));
      
      // Odświeżenie średnich po 2 sekundach
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('Błąd podczas wysyłania ankiety:', error);
      alert('Wystąpił błąd podczas wysyłania ankiety. Spróbuj ponownie.');
    } finally {
      setSubmitting(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBackground = (score: number) => {
    if (score >= 8) return 'bg-green-100';
    if (score >= 6) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Header - pełna szerokość */}
      <div className="w-full bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/homelogin')}
              className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Powrót</span>
            </button>
            
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Ankiety nauczycieli
            </h1>
            
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Główny kontener - pełna szerokość */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full grid grid-cols-1 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {/* Lewa strona - Ankiety - skalowalne */}
          <div className="xl:col-span-3">
            <div className="w-full bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Star className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800">Oceń nauczyciela</h2>
                  <p className="text-xs sm:text-sm text-gray-600">Twoja opinia jest w pełni anonimowa</p>
                </div>
              </div>

              {submitted && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                    <span className="text-green-800 font-medium text-sm sm:text-base">Ankieta została wysłana! Dziękujemy za opinię.</span>
                  </div>
                  <p className="text-green-700 text-xs mt-2">Dane zostały zapisane w Firebase. Średnie oceny zostaną zaktualizowane za chwilę.</p>
                </div>
              )}

              <div className="mb-4 sm:mb-6">
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                  Wybierz nauczyciela do oceny:
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 sm:px-4 py-2 sm:py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                  value={selectedTeacher}
                  onChange={(e) => {
                    setSelectedTeacher(e.target.value);
                    if (e.target.value) {
                      loadSurveyTemplate(e.target.value);
                    } else {
                      setCurrentSurveyTemplate(null);
                    }
                  }}
                >
                  <option value="">-- Wybierz nauczyciela --</option>
                  {teachers.map(teacher => (
                    <option 
                      key={teacher.uid} 
                      value={teacher.uid}
                      disabled={submittedSurveys.includes(teacher.uid)}
                    >
                      {teacher.displayName || teacher.email} - {teacher.subject || 'Przedmiot'}
                      {submittedSurveys.includes(teacher.uid) ? ' (Już oceniony)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTeacher && !submittedSurveys.includes(selectedTeacher) && (
                <div className="space-y-4 sm:space-y-6">
                  {/* Wyświetl tytuł i opis ankiety jeśli dostępne */}
                  {currentSurveyTemplate && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="text-lg font-semibold text-blue-800 mb-2">
                        {currentSurveyTemplate.title || 'Ankieta nauczyciela'}
                      </h3>
                      {currentSurveyTemplate.description && (
                        <p className="text-sm text-blue-700">
                          {currentSurveyTemplate.description}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {(currentSurveyTemplate?.questions || surveyQuestions).map((question: any, index: number) => (
                    <div key={question.id} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                      <div className="mb-3 sm:mb-4">
                        <h3 className="text-xs sm:text-sm font-semibold text-gray-800 mb-1">
                          Pytanie {index + 1}: {question.category || 'Ogólne'}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600">{question.question}</p>
                        {question.required && (
                          <span className="text-xs text-red-500 font-medium">* Wymagane</span>
                        )}
                      </div>
                      
                      <div className="space-y-2 sm:space-y-3">
                        {question.type === 'rating' || !question.type ? (
                          // Domyślny typ - rating (skala 1-10)
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">1</span>
                              <span className="text-xs sm:text-sm font-medium text-gray-700">
                                Ocena: {responses[question.id] || 5}
                              </span>
                              <span className="text-xs text-gray-500">10</span>
                            </div>
                            
                            <input
                              type="range"
                              min="1"
                              max="10"
                              value={responses[question.id] || 5}
                              onChange={(e) => handleSliderChange(question.id, parseInt(e.target.value))}
                              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                            />
                            
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>Bardzo źle</span>
                              <span>Średnio</span>
                              <span>Bardzo dobrze</span>
                            </div>
                          </>
                        ) : question.type === 'multiple_choice' && question.options ? (
                          // Typ multiple choice
                          <div className="space-y-2">
                            {question.options.map((option: string, optionIndex: number) => (
                              <label key={optionIndex} className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={question.id}
                                  value={optionIndex + 1}
                                  checked={responses[question.id] === optionIndex + 1}
                                  onChange={(e) => handleSliderChange(question.id, parseInt(e.target.value))}
                                  className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-sm text-gray-700">{option}</span>
                              </label>
                            ))}
                          </div>
                        ) : question.type === 'text' ? (
                          // Typ tekstowy
                          <textarea
                            value={responses[question.id] || ''}
                            onChange={(e) => handleSliderChange(question.id, e.target.value)}
                            placeholder="Wpisz swoją odpowiedź..."
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            rows={3}
                          />
                        ) : (
                          // Fallback do rating
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">1</span>
                              <span className="text-xs sm:text-sm font-medium text-gray-700">
                                Ocena: {responses[question.id] || 5}
                              </span>
                              <span className="text-xs text-gray-500">10</span>
                            </div>
                            
                            <input
                              type="range"
                              min="1"
                              max="10"
                              value={responses[question.id] || 5}
                              onChange={(e) => handleSliderChange(question.id, parseInt(e.target.value))}
                              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                            />
                            
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>Bardzo źle</span>
                              <span>Średnio</span>
                              <span>Bardzo dobrze</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full bg-blue-600 text-white py-2 sm:py-3 px-4 sm:px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-3 h-4 border-b-2 border-white"></div>
                        Wysyłanie...
                      </>
                    ) : (
                      <>
                        <Send className="w-3 h-3 sm:w-4 sm:h-4" />
                        Wyślij ankietę
                      </>
                    )}
                  </button>
                </div>
              )}

              {selectedTeacher && submittedSurveys.includes(selectedTeacher) && (
                <div className="text-center py-6 sm:py-8">
                  <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-green-500 mx-auto mb-3 sm:mb-4" />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">Już oceniłeś tego nauczyciela</h3>
                  <p className="text-sm sm:text-base text-gray-600">Dziękujemy za Twoją opinię!</p>
                </div>
              )}
            </div>
          </div>

          {/* Prawa strona - Średnie oceny - skalowalne */}
          <div className="xl:col-span-1">
            <div className="w-full bg-white rounded-2xl shadow-lg p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800">Średnie oceny</h2>
                  <p className="text-xs sm:text-sm text-gray-600">Wszystkich uczniów</p>
                </div>
              </div>

              {teacherAverages.length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <Users className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                  <p className="text-sm sm:text-base text-gray-500">Brak ocen nauczycieli</p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {teacherAverages
                    .sort((a, b) => b.averageScore - a.averageScore)
                    .map((teacher) => (
                      <div key={teacher.teacherId} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-gray-800 text-xs sm:text-sm truncate flex-1 mr-2">
                            {teacher.teacherName}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getScoreBackground(teacher.averageScore)} ${getScoreColor(teacher.averageScore)}`}>
                            {teacher.averageScore.toFixed(1)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-2 truncate">{teacher.subject}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Users className="w-3 h-3" />
                          <span>{teacher.totalResponses} ocen</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #2563eb;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #2563eb;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        @media (min-width: 640px) {
          .slider::-webkit-slider-thumb {
            height: 20px;
            width: 20px;
          }
          
          .slider::-moz-range-thumb {
            height: 20px;
            width: 20px;
          }
        }
      `}</style>
    </div>
  );
} 
