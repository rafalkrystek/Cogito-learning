'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Award, TrendingUp, Users, Star, BarChart3, Clock, Plus, Edit, Trash2 } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import { useAuth } from '../../../../context/AuthContext';
import { SurveyEditor } from '../../../../components/SurveyEditor';
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
    // Ignore storage errors
  }
}

// Helper to chunk array for Firestore 'in' queries (max 10 items)
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

interface SurveyResponse {
  id: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  studentId: string;
  studentEmail: string;
  responses: {
    [key: string]: number;
  };
  submittedAt: any;
  totalScore: number;
  averageScore: number;
}

interface QuestionStats {
  questionId: string;
  question: string;
  category: string;
  averageScore: number;
  totalResponses: number;
  scoreDistribution: { [key: number]: number };
}

interface Survey {
  id: string;
  title: string;
  description: string;
  questions: {
    id: string;
    question: string;
    category: string;
    type: 'rating' | 'text' | 'multiple_choice';
    options?: string[];
    required: boolean;
  }[];
  isActive: boolean;
  created_at: string;
  updated_at?: string;
  created_by: string;
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

// Pytania do oceny uczniów przez nauczycieli
const studentEvaluationQuestions = [
  {
    id: 'sq1',
    question: 'Jak oceniasz zaangażowanie ucznia w lekcje?',
    category: 'Zaangażowanie',
    description: 'Aktywność, uwaga, uczestnictwo podczas lekcji'
  },
  {
    id: 'sq2',
    question: 'Jak oceniasz aktywność ucznia podczas zajęć?',
    category: 'Aktywność',
    description: 'Zadawanie pytań, zgłaszanie się, interakcja z nauczycielem'
  },
  {
    id: 'sq3',
    question: 'Jak oceniasz przygotowanie ucznia do lekcji?',
    category: 'Przygotowanie',
    description: 'Wykonywanie zadań domowych, posiadanie materiałów'
  },
  {
    id: 'sq4',
    question: 'Jak oceniasz samodzielność ucznia w pracy?',
    category: 'Samodzielność',
    description: 'Umiejętność radzenia sobie z zadaniami bez pomocy'
  },
  {
    id: 'sq5',
    question: 'Jak oceniasz współpracę ucznia z innymi?',
    category: 'Współpraca',
    description: 'Praca zespołowa, pomaganie kolegom, kulturalna komunikacja'
  },
  {
    id: 'sq6',
    question: 'Jak oceniasz komunikację ucznia z nauczycielem?',
    category: 'Komunikacja',
    description: 'Jasność wypowiedzi, zadawanie pytań, odpowiedzi na pytania'
  },
  {
    id: 'sq7',
    question: 'Jak oceniasz regularność ucznia w wykonywaniu zadań?',
    category: 'Regularność',
    description: 'Terminowość, systematyczność, wywiązywanie się z obowiązków'
  },
  {
    id: 'sq8',
    question: 'Jak oceniasz postępy ucznia w nauce?',
    category: 'Postępy',
    description: 'Widoczny rozwój, przyswajanie wiedzy, poprawa wyników'
  },
  {
    id: 'sq9',
    question: 'Jak oceniasz radzenie sobie ucznia z trudnościami?',
    category: 'Trudności',
    description: 'Wytrwałość, prośba o pomoc, praca nad poprawą'
  },
  {
    id: 'sq10',
    question: 'Jak oceniasz motywację ucznia do nauki?',
    category: 'Motywacja',
    description: 'Chęć do nauki, inicjatywa, zainteresowanie przedmiotem'
  }
];

export default function TeacherSurveysPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>([]);
  const [questionStats, setQuestionStats] = useState<QuestionStats[]>([]);
  const [overallStats, setOverallStats] = useState({
    totalResponses: 0,
    averageScore: 0,
    totalStudents: 0
  });
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [showSurveyEditor, setShowSurveyEditor] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [activeTab, setActiveTab] = useState<'responses' | 'manage' | 'evaluate' | 'compare'>('responses');
  
  // Student evaluation states
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [evaluationResponses, setEvaluationResponses] = useState<{ [key: string]: number }>({});
  const [evaluationComment, setEvaluationComment] = useState('');
  const [submittingEvaluation, setSubmittingEvaluation] = useState(false);
  const [studentEvaluations, setStudentEvaluations] = useState<any[]>([]);
  const [selectedCompareStudent, setSelectedCompareStudent] = useState<string>('');
  const [comparisonData, setComparisonData] = useState<any>(null);

  const fetchSurveyData = useCallback(async () => {
    if (!user?.uid) return;

    try {
      await measureAsync('TeacherSurveys:fetchSurveyData', async () => {
        // Check cache
        const cacheKey = `teacher_surveys_${user.uid}`;
        const cached = getSessionCache<{
          responses: SurveyResponse[];
          surveys: Survey[];
          stats: typeof overallStats;
          questionStats: QuestionStats[];
        }>(cacheKey);
        
        if (cached) {
          setSurveyResponses(cached.responses);
          setSurveys(cached.surveys);
          setOverallStats(cached.stats);
          setQuestionStats(cached.questionStats);
          setLoading(false);
          return;
        }
        
        // Fetch surveys and templates in parallel
        const [surveysSnapshot, surveyTemplatesSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'teacherSurveys'), where('teacherId', '==', user.uid), limit(200))),
          getDocs(query(collection(db, 'surveyTemplates'), where('created_by', '==', user.uid), limit(50)))
        ]);
        
        const responses: SurveyResponse[] = surveysSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as SurveyResponse));

        const surveyTemplates: Survey[] = surveyTemplatesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Survey));

        setSurveyResponses(responses);
        setSurveys(surveyTemplates);

        // Calculate overall stats
        const totalResponses = responses.length;
        const totalScore = responses.reduce((sum, response) => sum + response.averageScore, 0);
        const averageScore = totalResponses > 0 ? totalScore / totalResponses : 0;
        const uniqueStudents = new Set(responses.map(r => r.studentId)).size;

        const stats = {
          totalResponses,
          averageScore,
          totalStudents: uniqueStudents
        };
        setOverallStats(stats);

        // Calculate question stats
        const questionStats: QuestionStats[] = surveyQuestions.map(question => {
          const questionResponses = responses
            .filter(r => r.responses && r.responses[question.id] !== undefined)
            .map(r => r.responses[question.id]);

          const totalResponses = questionResponses.length;
          const averageScore = totalResponses > 0 
            ? questionResponses.reduce((sum, score) => sum + score, 0) / totalResponses 
            : 0;

          // Score distribution (1-10)
          const scoreDistribution: { [key: number]: number } = {};
          for (let i = 1; i <= 10; i++) {
            scoreDistribution[i] = questionResponses.filter(score => score === i).length;
          }

          return {
            questionId: question.id,
            question: question.question,
            category: question.category,
            averageScore,
            totalResponses,
            scoreDistribution
          };
        });

        setQuestionStats(questionStats);
        
        // Cache the data
        setSessionCache(cacheKey, {
          responses,
          surveys: surveyTemplates,
          stats,
          questionStats
        });
      });
    } catch (error) {
      console.error('Błąd podczas pobierania ankiet:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchSurveyData();
  }, [fetchSurveyData]);

  // Fetch students with caching and optimization
  const fetchStudents = useCallback(async () => {
    if (!user?.uid) return;

    try {
      await measureAsync('TeacherSurveys:fetchStudents', async () => {
        // Check cache
        const cacheKey = `teacher_surveys_students_${user.uid}`;
        const cached = getSessionCache<any[]>(cacheKey);
        
        if (cached) {
          setStudents(cached);
          return;
        }
        
        // Fetch classes
        const classesQuery = query(
          collection(db, 'classes'),
          where('teacher_id', '==', user.uid),
          limit(50)
        );
        const classesSnapshot = await getDocs(classesQuery);
        
        // Collect all student IDs from classes
        const allStudentIds = new Set<string>();
        classesSnapshot.docs.forEach(doc => {
          const classData = doc.data();
          if (classData.students && Array.isArray(classData.students)) {
            classData.students.forEach((studentId: string) => allStudentIds.add(studentId));
          }
        });

        // Fetch students in parallel using chunks (Firestore 'in' query limit is 10)
        const studentIdsArray = Array.from(allStudentIds);
        const chunks = chunkArray(studentIdsArray, 10);
        
        const studentPromises = chunks.map(chunk => 
          getDocs(query(collection(db, 'users'), where('uid', 'in', chunk), where('role', '==', 'student')))
        );
        
        const studentSnapshots = await Promise.all(studentPromises);
        
        const studentsData = studentSnapshots
          .flatMap(snapshot => snapshot.docs.map(doc => ({
            id: doc.id,
            email: doc.data().email,
            displayName: doc.data().displayName || doc.data().email,
            ...doc.data()
          })));

        setStudents(studentsData);
        setSessionCache(cacheKey, studentsData);
      });
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Pobierz oceny uczniów
  const fetchStudentEvaluations = useCallback(async () => {
    if (!user?.uid) return;

    try {
      await measureAsync('TeacherSurveys:fetchStudentEvaluations', async () => {
        // Check cache
        const cacheKey = `teacher_surveys_evaluations_${user.uid}`;
        const cached = getSessionCache<any[]>(cacheKey);
        
        if (cached) {
          setStudentEvaluations(cached);
          return;
        }
        
        const evaluationsQuery = query(
          collection(db, 'studentEvaluations'),
          where('teacherId', '==', user.uid),
          limit(200)
        );
        const evaluationsSnapshot = await getDocs(evaluationsQuery);
        
        const evaluations = evaluationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setStudentEvaluations(evaluations);
        setSessionCache(cacheKey, evaluations);
      });
    } catch (error) {
      console.error('Error fetching evaluations:', error);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchStudentEvaluations();
  }, [fetchStudentEvaluations]);

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-700 dark:text-green-300';
    if (score >= 6) return 'text-yellow-700 dark:text-yellow-300';
    return 'text-red-700 dark:text-red-300';
  };

  const getScoreBackground = (score: number) => {
    if (score >= 8) return 'bg-green-100 dark:bg-green-900/40';
    if (score >= 6) return 'bg-yellow-100 dark:bg-yellow-900/40';
    return 'bg-red-100 dark:bg-red-900/40';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 8) return 'bg-green-500 dark:bg-green-400';
    if (score >= 6) return 'bg-yellow-500 dark:bg-yellow-400';
    return 'bg-red-500 dark:bg-red-400';
  };

  const handleCreateSurvey = () => {
    setEditingSurvey(null);
    setShowSurveyEditor(true);
  };

  const handleEditSurvey = (survey: Survey) => {
    setEditingSurvey(survey);
    setShowSurveyEditor(true);
  };

  const handleSaveSurvey = async (survey: Omit<Survey, 'id' | 'created_at'>) => {
    try {
      if (editingSurvey) {
        // Edytuj istniejącą ankietę
        await updateDoc(doc(db, 'surveyTemplates', editingSurvey.id), {
          ...survey,
          updated_at: serverTimestamp()
        });
        console.log('Ankieta zaktualizowana');
      } else {
        // Utwórz nową ankietę
        await addDoc(collection(db, 'surveyTemplates'), {
          ...survey,
          created_by: user?.uid,
          created_at: serverTimestamp()
        });
        console.log('Nowa ankieta utworzona');
      }
      
      setShowSurveyEditor(false);
      setEditingSurvey(null);
      // Odśwież dane
      window.location.reload();
    } catch (error) {
      console.error('Błąd podczas zapisywania ankiety:', error);
      alert('Wystąpił błąd podczas zapisywania ankiety');
    }
  };

  const handleDeleteSurvey = async (surveyId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tę ankietę?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'surveyTemplates', surveyId));
      
      // Invalidate cache
      if (user?.uid) {
        sessionStorage.removeItem(`teacher_surveys_${user.uid}`);
      }
      
      // Refresh data
      fetchSurveyData();
    } catch (error) {
      console.error('Błąd podczas usuwania ankiety:', error);
      alert('Wystąpił błąd podczas usuwania ankiety');
    }
  };

  // Obsługa oceny ucznia
  const handleStudentEvaluationSubmit = async () => {
    if (!selectedStudent) {
      alert('Proszę wybrać ucznia do oceny');
      return;
    }

    // Sprawdź czy wszystkie pytania zostały ocenione
    const unansweredQuestions = studentEvaluationQuestions.filter(
      q => !evaluationResponses[q.id]
    );

    if (unansweredQuestions.length > 0) {
      alert(`Proszę odpowiedzieć na wszystkie pytania (brakuje ${unansweredQuestions.length} odpowiedzi)`);
      return;
    }

    try {
      setSubmittingEvaluation(true);
      console.log('📝 [Student Evaluation] Submitting evaluation for student:', selectedStudent);

      const selectedStudentData = students.find(s => s.id === selectedStudent);
      
      // Oblicz średnią
      const scores = Object.values(evaluationResponses);
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

      const evaluationData = {
        teacherId: user?.uid,
        teacherEmail: user?.email,
        teacherName: user?.email || 'Nauczyciel',
        studentId: selectedStudent,
        studentEmail: selectedStudentData?.email || '',
        studentName: (selectedStudentData as any)?.displayName || selectedStudentData?.email || 'Uczeń',
        responses: evaluationResponses,
        comment: evaluationComment.trim() || null,
        averageScore,
        submittedAt: serverTimestamp(),
        createdAt: new Date().toISOString()
      };

      console.log('💾 [Student Evaluation] Saving evaluation data:', evaluationData);

      const docRef = await addDoc(collection(db, 'studentEvaluations'), evaluationData);
      
      console.log('✅ [Student Evaluation] Evaluation saved successfully with ID:', docRef.id);
      
      alert('Ocena ucznia została zapisana pomyślnie!');
      
      // Reset formularza
      setSelectedStudent('');
      setEvaluationResponses({});
      setEvaluationComment('');
      
      // Invalidate cache and refresh
      if (user?.uid) {
        sessionStorage.removeItem(`teacher_surveys_evaluations_${user.uid}`);
        sessionStorage.removeItem(`teacher_surveys_${user.uid}`);
      }
      fetchStudentEvaluations();

    } catch (error) {
      console.error('❌ [Student Evaluation] Error submitting evaluation:', error);
      alert('Wystąpił błąd podczas zapisywania oceny');
    } finally {
      setSubmittingEvaluation(false);
    }
  };

  // Obsługa porównania ocen ucznia
  const handleCompareStudent = async (studentId: string) => {
    if (!studentId) {
      setComparisonData(null);
      return;
    }

    try {
      console.log('🔍 [Student Comparison] Fetching comparison data for student:', studentId);

      // Sprawdź czy nauczyciel już ocenił tego ucznia
      const teacherEvaluation = studentEvaluations.find(
        evaluation => evaluation.studentId === studentId
      );

      if (!teacherEvaluation) {
        console.log('⚠️ [Student Comparison] Teacher has not evaluated this student yet');
        setComparisonData({
          error: 'Musisz najpierw ocenić tego ucznia, aby zobaczyć oceny innych nauczycieli.'
        });
        return;
      }

      console.log('✅ [Student Comparison] Teacher has evaluated this student, fetching all evaluations');

      // Pobierz wszystkie oceny tego ucznia
      const allEvaluationsQuery = query(
        collection(db, 'studentEvaluations'),
        where('studentId', '==', studentId)
      );
      const allEvaluationsSnapshot = await getDocs(allEvaluationsQuery);
      
      const allEvaluations: any[] = allEvaluationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`✅ [Student Comparison] Found ${allEvaluations.length} total evaluations for this student`);

      // Oblicz statystyki
      const teacherEvaluations = allEvaluations.filter(e => e.teacherId !== user?.uid);
      const questionStats: any = {};

      studentEvaluationQuestions.forEach(question => {
        const scores = allEvaluations
          .map(e => e.responses[question.id])
          .filter(score => score !== undefined);

        const myScore = teacherEvaluation.responses[question.id];
        const otherScores = teacherEvaluations
          .map(e => e.responses[question.id])
          .filter(score => score !== undefined);

        const avgOthers = otherScores.length > 0
          ? otherScores.reduce((sum, score) => sum + score, 0) / otherScores.length
          : null;

        questionStats[question.id] = {
          myScore,
          avgOthers,
          allScores: scores,
          otherTeachersCount: otherScores.length
        };
      });

      const avgMyScore = teacherEvaluation.averageScore;
      const avgOthersScore = teacherEvaluations.length > 0
        ? teacherEvaluations.reduce((sum, e) => sum + e.averageScore, 0) / teacherEvaluations.length
        : null;

      setComparisonData({
        studentId,
        studentName: teacherEvaluation.studentName,
        myEvaluation: teacherEvaluation,
        totalEvaluations: allEvaluations.length,
        otherEvaluationsCount: teacherEvaluations.length,
        questionStats,
        avgMyScore,
        avgOthersScore
      });

      console.log('✅ [Student Comparison] Comparison data prepared:', {
        totalEvaluations: allEvaluations.length,
        otherTeachers: teacherEvaluations.length
      });

    } catch (error) {
      console.error('❌ [Student Comparison] Error fetching comparison data:', error);
      setComparisonData({
        error: 'Wystąpił błąd podczas pobierania danych porównawczych'
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (showSurveyEditor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
        <SurveyEditor
          survey={editingSurvey || undefined}
          onSave={(survey) => {
            handleSaveSurvey({...survey, created_by: user?.uid || ''});
          }}
          onCancel={() => {
            setShowSurveyEditor(false);
            setEditingSurvey(null);
          }}
          mode={editingSurvey ? 'edit' : 'create'}
        />
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full max-w-full overflow-hidden flex flex-col" style={{ maxWidth: '100vw' }}>
      {/* Header - Fixed */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-sm flex-shrink-0">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => window.location.href = '/homelogin'}
              className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Powrót</span>
            </button>
            
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Ankiety uczniów
            </h1>
            
            <div className="w-20"></div>
          </div>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-hidden flex flex-col px-4 sm:px-6 lg:px-8 py-4">
        {/* Tabs - Fixed */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 bg-white/60 backdrop-blur-sm rounded-lg p-1 border border-white/20 mb-4 flex-shrink-0">
          <button
            onClick={() => setActiveTab('responses')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'responses'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📊 Wyniki ankiet
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'manage'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            ⚙️ Zarządzaj ankietami
          </button>
          <button
            onClick={() => setActiveTab('evaluate')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'evaluate'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            ✏️ Oceń ucznia
          </button>
          <button
            onClick={() => setActiveTab('compare')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'compare'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📈 Porównaj oceny
          </button>
        </div>

        {/* Tab Content - Scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'responses' ? (
          <>
            {/* Ogólne statystyki */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 border border-white/20 dark:border-gray-700">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Award className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Średnia ocena</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white">{overallStats.averageScore.toFixed(1)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 border border-white/20 dark:border-gray-700">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Uczniowie</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white">{overallStats.totalStudents}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 border border-white/20 dark:border-gray-700">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Wszystkie ankiety</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white">{overallStats.totalResponses}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Szczegółowe statystyki pytań */}
        <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6 border border-white/20 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Szczegółowe oceny pytań</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">Zobacz jak uczniowie oceniają poszczególne aspekty</p>
            </div>
          </div>

          {questionStats.length === 0 ? (
            <div className="text-center py-8">
              <Award className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Brak ankiet</h3>
              <p className="text-gray-600 dark:text-gray-400">Uczniowie jeszcze nie wypełnili ankiet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {questionStats.map((stat, index) => (
                <div key={stat.questionId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6 bg-gray-50/50 dark:bg-gray-900/50">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-white">
                        Pytanie {index + 1}: {stat.category}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreBackground(stat.averageScore)} ${getScoreColor(stat.averageScore)}`}>
                          {stat.averageScore.toFixed(1)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">({stat.totalResponses} ocen)</span>
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-4">{stat.question}</p>
                  </div>

                  {/* Pasek średniej oceny */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span>Średnia ocena</span>
                      <span>{stat.averageScore.toFixed(1)}/10</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${getScoreBarColor(stat.averageScore)}`}
                        style={{ width: `${(stat.averageScore / 10) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Rozkład ocen */}
                  <div>
                    <h4 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Rozkład ocen:</h4>
                    <div className="grid grid-cols-10 gap-1">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map(score => (
                        <div key={score} className="text-center">
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">{score}</div>
                          <div className="bg-gray-200 dark:bg-gray-700 rounded h-16 flex items-end justify-center">
                            {stat.scoreDistribution[score] > 0 && (
                              <div 
                                className="bg-blue-500 dark:bg-blue-400 rounded-t w-full"
                                style={{ 
                                  height: `${(stat.scoreDistribution[score] / Math.max(...Object.values(stat.scoreDistribution))) * 100}%`,
                                  minHeight: '4px'
                                }}
                              ></div>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {stat.scoreDistribution[score] || 0}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rekomendacje */}
                  <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h4 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Rekomendacje:</h4>
                    {stat.averageScore >= 8 ? (
                      <p className="text-xs sm:text-sm text-green-700 dark:text-green-400">
                        🎉 Doskonałe wyniki! Utrzymuj obecny poziom.
                      </p>
                    ) : stat.averageScore >= 6 ? (
                      <p className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-400">
                        📈 Dobry wynik, ale jest miejsce na poprawę. Skup się na obszarach z niższymi ocenami.
                      </p>
                    ) : (
                      <p className="text-xs sm:text-sm text-red-700 dark:text-red-400">
                        ⚠️ Wymaga uwagi. Rozważ wprowadzenie zmian w sposobie prowadzenia zajęć.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lista ostatnich ankiet */}
        {surveyResponses.length > 0 && (
          <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6 border border-white/20 dark:border-gray-700 mt-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Ostatnie ankiety</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">Lista ostatnio wypełnionych ankiet</p>
              </div>
            </div>

            <div className="space-y-3">
              {surveyResponses
                .sort((a, b) => new Date(b.submittedAt?.toDate?.() || b.submittedAt).getTime() - new Date(a.submittedAt?.toDate?.() || a.submittedAt).getTime())
                .slice(0, 5)
                .map((response) => (
                  <div key={response.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-900/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Star className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-white">
                          Ankieta od ucznia
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {response.submittedAt?.toDate?.() ? 
                            response.submittedAt.toDate().toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '/') : 
                            new Date(response.submittedAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '/')
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreBackground(response.averageScore)} ${getScoreColor(response.averageScore)}`}>
                        {response.averageScore.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
          </>
        ) : activeTab === 'manage' ? (
          /* Zakładka zarządzania ankietami */
          <div className="space-y-6">
            {/* Header z przyciskiem utworzenia */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Zarządzaj ankietami</h2>
                <p className="text-gray-600 mt-1">Twórz i edytuj szablony ankiet dla uczniów</p>
              </div>
              <button
                onClick={handleCreateSurvey}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Utwórz ankietę
              </button>
            </div>

            {/* Lista ankiet */}
            {surveys.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Brak ankiet</h3>
                <p className="text-gray-600 mb-4">Nie masz jeszcze żadnych szablonów ankiet.</p>
                <button
                  onClick={handleCreateSurvey}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Utwórz pierwszą ankietę
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {surveys.map((survey) => (
                  <div key={survey.id} className="bg-white rounded-xl shadow-lg p-6 border border-white/20">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{survey.title}</h3>
                        <p className="text-gray-600 text-sm mb-3">{survey.description}</p>
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            survey.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {survey.isActive ? 'Aktywna' : 'Nieaktywna'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {survey.questions.length} pytań
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500 mb-4">
                      Utworzono: {new Date(survey.created_at).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '/')}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditSurvey(survey)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        <Edit className="w-4 h-4" />
                        Edytuj
                      </button>
                      <button
                        onClick={() => handleDeleteSurvey(survey.id)}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'evaluate' ? (
          /* Zakładka oceny ucznia */
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-white/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Oceń ucznia</h2>
                  <p className="text-gray-600">Wypełnij ankietę oceny ucznia (10 pytań, skala 1-10)</p>
                </div>
              </div>

              {/* Wybór ucznia */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Wybierz ucznia do oceny:
                </label>
                <select
                  value={selectedStudent}
                  onChange={(e) => {
                    console.log('👤 [Student Evaluation] Selected student:', e.target.value);
                    setSelectedStudent(e.target.value);
                    setEvaluationResponses({});
                    setEvaluationComment('');
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
                >
                  <option value="">-- Wybierz ucznia --</option>
                  {students.map(student => (
                    <option key={student.id} value={student.id}>
                      {(student as any).displayName || student.email}
                    </option>
                  ))}
                </select>
                {students.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    Brak uczniów w Twoich klasach
                  </p>
        )}
      </div>

              {selectedStudent && (
                <div className="space-y-6">
                  {/* Informacja o uczniu */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-800">
                      📝 Oceniasz: <span className="font-bold">
                        {(students.find(s => s.id === selectedStudent) as any)?.displayName || 
                         students.find(s => s.id === selectedStudent)?.email}
                      </span>
                    </p>
    </div>

                  {/* Pytania oceny */}
                  <div className="space-y-6">
                    {studentEvaluationQuestions.map((question, index) => (
                      <div key={question.id} className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
                        <div className="mb-4">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            Pytanie {index + 1}: {question.category}
                          </h3>
                          <p className="text-gray-700">{question.question}</p>
                          <p className="text-sm text-gray-500 mt-1">{question.description}</p>
                        </div>

                        {/* Suwak oceny */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Wybierz ocenę (1-10):</span>
                            <span className={`text-2xl font-bold px-4 py-1 rounded-lg ${
                              evaluationResponses[question.id] >= 8 ? 'bg-green-100 text-green-700' :
                              evaluationResponses[question.id] >= 6 ? 'bg-yellow-100 text-yellow-700' :
                              evaluationResponses[question.id] ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-400'
                            }`}>
                              {evaluationResponses[question.id] || '-'}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={evaluationResponses[question.id] || 5}
                            onChange={(e) => {
                              const value = parseInt(e.target.value);
                              console.log(`📊 [Student Evaluation] Question ${question.id} rated:`, value);
                              setEvaluationResponses({
                                ...evaluationResponses,
                                [question.id]: value
                              });
                            }}
                            className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>1 (Bardzo słabo)</span>
                            <span>5 (Średnio)</span>
                            <span>10 (Doskonale)</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Dodatkowy komentarz (opcjonalny) */}
                  <div className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      Pytanie 11 (opcjonalne): Dodatkowe uwagi
                    </h3>
                    <p className="text-gray-600 mb-3">
                      Możesz dodać swoje obserwacje, uwagi lub rekomendacje dotyczące ucznia
                    </p>
                    <textarea
                      value={evaluationComment}
                      onChange={(e) => setEvaluationComment(e.target.value)}
                      placeholder="Wpisz swoje uwagi..."
                      className="w-full h-32 px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all resize-none"
                    />
                  </div>

                  {/* Podsumowanie */}
                  {Object.keys(evaluationResponses).length > 0 && (
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border-2 border-blue-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">📊 Podsumowanie oceny</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Odpowiedzi:</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {Object.keys(evaluationResponses).length} / 10
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Średnia ocena:</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {(Object.values(evaluationResponses).reduce((sum, val) => sum + val, 0) / 
                             Object.values(evaluationResponses).length).toFixed(1)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Przycisk wysyłania */}
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setSelectedStudent('');
                        setEvaluationResponses({});
                        setEvaluationComment('');
                      }}
                      className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                    >
                      Anuluj
                    </button>
                    <button
                      onClick={handleStudentEvaluationSubmit}
                      disabled={submittingEvaluation || Object.keys(evaluationResponses).length < 10}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {submittingEvaluation ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Zapisywanie...
                        </>
                      ) : (
                        <>
                          <Award className="w-5 h-5" />
                          Zapisz ocenę
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'compare' ? (
          /* Zakładka porównania ocen */
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-white/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Porównaj oceny ucznia</h2>
                  <p className="text-gray-600">Zobacz jak Ty i inni nauczyciele oceniają uczniów</p>
                </div>
              </div>

              {/* Wybór ucznia */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Wybierz ucznia do porównania:
                </label>
                <select
                  value={selectedCompareStudent}
                  onChange={(e) => {
                    const studentId = e.target.value;
                    console.log('📊 [Student Comparison] Selected student for comparison:', studentId);
                    setSelectedCompareStudent(studentId);
                    handleCompareStudent(studentId);
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
                >
                  <option value="">-- Wybierz ucznia --</option>
                  {students.map(student => {
                    const hasEvaluated = studentEvaluations.some(e => e.studentId === student.id);
                    return (
                      <option key={student.id} value={student.id}>
                        {(student as any).displayName || student.email} 
                        {hasEvaluated ? ' ✅ (oceniony)' : ' ⚠️ (nieoceniony)'}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Wyświetlanie danych porównawczych */}
              {comparisonData && comparisonData.error ? (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                      <Star className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-yellow-800 mb-1">Brak dostępu</h3>
                      <p className="text-yellow-700">{comparisonData.error}</p>
                    </div>
                  </div>
                </div>
              ) : comparisonData ? (
                <div className="space-y-6">
                  {/* Nagłówek z info o uczniu */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border-2 border-blue-200">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">
                      📊 Porównanie ocen: {comparisonData.studentName}
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-1">Twoja średnia</p>
                        <p className="text-3xl font-bold text-blue-600">
                          {comparisonData.avgMyScore.toFixed(1)}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-1">Średnia innych</p>
                        <p className="text-3xl font-bold text-purple-600">
                          {comparisonData.avgOthersScore !== null 
                            ? comparisonData.avgOthersScore.toFixed(1)
                            : 'N/A'}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-1">Liczba nauczycieli</p>
                        <p className="text-3xl font-bold text-green-600">
                          {comparisonData.totalEvaluations}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Porównanie pytań */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Porównanie odpowiedzi na pytania:</h3>
                    
                    {studentEvaluationQuestions.map((question, index) => {
                      const stats = comparisonData.questionStats[question.id];
                      const difference = stats.avgOthers !== null 
                        ? stats.myScore - stats.avgOthers 
                        : null;

                      return (
                        <div key={question.id} className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
                          <h4 className="font-semibold text-gray-900 mb-2">
                            Pytanie {index + 1}: {question.category}
                          </h4>
                          <p className="text-sm text-gray-600 mb-4">{question.question}</p>

                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-white rounded-lg p-3">
                              <p className="text-xs text-gray-500 mb-1">Twoja ocena</p>
                              <p className="text-2xl font-bold text-blue-600">{stats.myScore}</p>
                            </div>
                            <div className="bg-white rounded-lg p-3">
                              <p className="text-xs text-gray-500 mb-1">
                                Średnia innych ({stats.otherTeachersCount} nauczycieli)
                              </p>
                              <p className="text-2xl font-bold text-purple-600">
                                {stats.avgOthers !== null ? stats.avgOthers.toFixed(1) : 'Brak'}
                              </p>
                            </div>
                          </div>

                          {difference !== null && (
                            <div className={`p-3 rounded-lg ${
                              Math.abs(difference) < 1 ? 'bg-gray-100' :
                              difference > 0 ? 'bg-green-100' : 'bg-red-100'
                            }`}>
                              <p className={`text-sm font-medium ${
                                Math.abs(difference) < 1 ? 'text-gray-700' :
                                difference > 0 ? 'text-green-700' : 'text-red-700'
                              }`}>
                                {Math.abs(difference) < 1 
                                  ? '➡️ Ocena zbliżona do średniej' 
                                  : difference > 0 
                                    ? `⬆️ Twoja ocena wyższa o ${difference.toFixed(1)} pkt`
                                    : `⬇️ Twoja ocena niższa o ${Math.abs(difference).toFixed(1)} pkt`
                                }
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Komentarz nauczyciela */}
                  {comparisonData.myEvaluation.comment && (
                    <div className="bg-blue-50 rounded-lg p-6 border-2 border-blue-200">
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">📝 Twój komentarz:</h3>
                      <p className="text-blue-800">{comparisonData.myEvaluation.comment}</p>
                    </div>
                  )}
                </div>
              ) : selectedCompareStudent ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-4">Ładowanie danych porównawczych...</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}
