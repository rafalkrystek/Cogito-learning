'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/config/firebase';
import { collection, getDocs, query, where, doc, getDoc, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  MapPin, 
  Star, 
  User,
  BookOpen,
  Plus,
  GraduationCap,
  TrendingUp,
  Activity,
  Target,
  Zap,
  CheckCircle,
  Trophy
} from 'lucide-react';

interface StudentProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  class: string;
  averageGrade: number;
  frequency: number;
  courses: string[];
  lastActivity: string;
  parentName?: string;
  parentPhone?: string;
  parentRole?: string;
  parentEmail?: string;
  achievements?: string[];
}

interface TeacherNote {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  note: string;
  createdAt: any;
}

export default function StudentProfilePage() {
  const params = useParams();
  const { user } = useAuth();
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [teacherNotes, setTeacherNotes] = useState<TeacherNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setEditData] = useState<Partial<StudentProfile>>({});
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [learningData, setLearningData] = useState<any>(null);
  const [grades, setGrades] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);

  const studentId = params?.id as string;

  const fetchStudentProfile = useCallback(async () => {
    try {
      setLoading(true);
      
      // Pobierz dane ucznia
      const studentDoc = await getDoc(doc(db, 'users', studentId));
      if (!studentDoc.exists()) {
        setError('Uczeń nie został znaleziony');
        return;
      }

      const studentData = studentDoc.data();
      
      // Pobierz kursy ucznia
      const coursesRef = collection(db, 'courses');
      const coursesSnapshot = await getDocs(coursesRef);
      const studentCourses: string[] = [];
      
      coursesSnapshot.docs.forEach(doc => {
        const courseData = doc.data();
        const assignedUsers = courseData.assignedUsers || [];
        if (assignedUsers.includes(studentData.email) || assignedUsers.includes(studentId)) {
          studentCourses.push(courseData.title);
        }
      });

      // Sprawdź czy uczeń jest bezpośrednio przypisany
      if (studentData.assignedToTeacher === user?.uid) {
        studentCourses.push('Przypisany bezpośrednio');
      }

      // Pobierz oceny
      const gradesRef = collection(db, 'grades');
      const gradesSnapshot = await getDocs(gradesRef);
      const studentGrades = gradesSnapshot.docs
        .filter(doc => {
          const gradeData = doc.data();
          return (gradeData.studentId === studentId || gradeData.user_id === studentId);
        })
        .map(doc => {
          const gradeData = doc.data();
          return {
            subject: gradeData.subject || 'Nieznany przedmiot',
            date: gradeData.date || new Date().toISOString().split('T')[0],
            grade: parseFloat(gradeData.value || gradeData.grade || '0'),
            type: gradeData.gradeType || 'Ocena'
          };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 4);

             // Pobierz dane rodzica z kolekcji parent_students
       let parentInfo = {};
       const parentStudentsRef = collection(db, 'parent_students');
       const parentStudentsQuery = query(parentStudentsRef, where('student', '==', studentId));
       const parentStudentsSnapshot = await getDocs(parentStudentsQuery);
       
       console.log('🔍 Szukam rodzica dla ucznia:', studentId);
       console.log('📋 Znalezione relacje parent-student:', parentStudentsSnapshot.docs.length);
       
       if (!parentStudentsSnapshot.empty) {
         const parentStudentData = parentStudentsSnapshot.docs[0].data();
         const parentId = parentStudentData.parent;
         
         console.log('👨‍👩‍👧‍👦 Znaleziony parent ID:', parentId);
         
         // Pobierz dane rodzica
         const parentDoc = await getDoc(doc(db, 'users', parentId));
         if (parentDoc.exists()) {
           const parentData = parentDoc.data();
           console.log('📱 Dane rodzica:', parentData);
           parentInfo = {
             parentName: parentData.displayName || parentData.email,
             parentPhone: parentData.phone || '',
             parentEmail: parentData.email,
             parentRole: 'Rodzic/Opiekun'
           };
         }
       } else {
         console.log('❌ Brak przypisanego rodzica dla ucznia:', studentId);
       }

             const studentProfile: StudentProfile = {
         id: studentId,
         name: studentData.displayName || studentData.email || 'Nieznany uczeń',
         email: studentData.email || '',
         phone: studentData.phone || '',
         address: studentData.address || '',
         dateOfBirth: studentData.dateOfBirth || '',
         class: `Klasa ${studentCourses[0] || 'Nieznana'}`,
         averageGrade: studentGrades.length > 0 
           ? studentGrades.reduce((acc, g) => acc + g.grade, 0) / studentGrades.length 
           : 0,
         frequency: 0, // Usunięte
         courses: studentCourses,
         lastActivity: `${Math.floor(Math.random() * 24) + 1} godz. temu`,
         ...parentInfo
       };
       
       console.log('🎓 Utworzony profil ucznia:', studentProfile);
       console.log('👨‍👩‍👧‍👦 Informacje o rodzicu:', parentInfo);

      setStudent(studentProfile);
      setEditData(studentProfile);
      setGrades(studentGrades);

    } catch (error) {
      console.error('Error fetching student profile:', error);
      setError('Wystąpił błąd podczas pobierania profilu ucznia');
    } finally {
      setLoading(false);
    }
  }, [studentId, user]);

  // Pobierz dane do obliczenia odznak
  useEffect(() => {
    const fetchBadgeData = async () => {
      if (!studentId) return;

      try {
        // Pobierz dane nauki
        const userTimeDoc = await getDoc(doc(db, 'userLearningTime', studentId));
        if (userTimeDoc.exists()) {
          setLearningData(userTimeDoc.data());
        }

        // Pobierz oceny
        const studentDoc = await getDoc(doc(db, 'users', studentId));
        const studentData = studentDoc.data();
        const studentEmail = studentData?.email;

        const [gradesByUid, gradesByEmail, gradesByStudentId] = await Promise.all([
          getDocs(query(collection(db, 'grades'), where('user_id', '==', studentId), limit(100))),
          studentEmail ? getDocs(query(collection(db, 'grades'), where('studentEmail', '==', studentEmail), limit(100))) : Promise.resolve({ docs: [] } as any),
          getDocs(query(collection(db, 'grades'), where('studentId', '==', studentId), limit(100)))
        ]);

        const allGrades = [
          ...gradesByUid.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })),
          ...gradesByEmail.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })),
          ...gradesByStudentId.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))
        ];
        const uniqueGrades = allGrades.filter((grade, index, self) =>
          index === self.findIndex(g => g.id === grade.id)
        );
        setGrades(uniqueGrades);
      } catch (error) {
        console.error('Error fetching badge data:', error);
      }
    };

    fetchBadgeData();
  }, [studentId]);

  // Oblicz odznaki
  useEffect(() => {
    if (!learningData && grades.length === 0) {
      setBadges([]);
      return;
    }

    const calculateBadges = () => {
      const totalMinutes = learningData?.totalMinutes || 0;
      const totalHours = totalMinutes / 60;
      const daysActive = learningData ? Object.keys(learningData.dailyStats || {}).length : 0;
      
      // Oblicz średnią ocen
      const normalizedGrades = grades.map(grade => {
        let value = 0;
        if (typeof grade.value === 'number') {
          value = grade.value;
        } else if (typeof grade.value_grade === 'number') {
          value = grade.value_grade;
        } else if (typeof grade.grade === 'number') {
          value = grade.grade;
        } else if (typeof grade.grade === 'string') {
          value = parseFloat(grade.grade);
        }
        
        if (value === 0 && grade.percentage) {
          const percentage = typeof grade.percentage === 'number' ? grade.percentage : parseFloat(String(grade.percentage));
          if (percentage >= 90) value = 5;
          else if (percentage >= 75) value = 4;
          else if (percentage >= 60) value = 3;
          else if (percentage >= 45) value = 2;
          else value = 1;
        }
        
        value = Math.max(1, Math.min(5, Math.round(value)));
        return { ...grade, normalizedValue: value };
      });
      const averageGrade = normalizedGrades.length > 0 
        ? normalizedGrades.reduce((acc, g) => acc + g.normalizedValue, 0) / normalizedGrades.length 
        : 0;
      const totalGrades = normalizedGrades.length;

      // Oblicz streak
      const calculateStreak = () => {
        if (!learningData?.dailyStats) return 0;
        const sortedDates = Object.keys(learningData.dailyStats)
          .map(date => new Date(date))
          .sort((a, b) => b.getTime() - a.getTime());
        if (sortedDates.length === 0) return 0;
        let streak = 1;
        for (let i = 0; i < sortedDates.length - 1; i++) {
          const current = new Date(sortedDates[i]);
          current.setHours(0, 0, 0, 0);
          const next = new Date(sortedDates[i + 1]);
          next.setHours(0, 0, 0, 0);
          const diffDays = Math.floor((current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) streak++;
          else break;
        }
        return streak;
      };

      const streak = calculateStreak();
      const calculateLevel = (value: number, thresholds: number[]): number => {
        for (let i = thresholds.length - 1; i >= 0; i--) {
          if (value >= thresholds[i]) return i;
        }
        return 0;
      };

      const calculatedBadges = [
        {
          id: 'time-master',
          name: 'Mistrz Czasu',
          description: 'Za całkowity czas spędzony na nauce',
          icon: '⏰',
          currentLevel: calculateLevel(totalHours, [0, 10, 50, 100, 200]),
          currentProgress: Math.round(totalHours),
          nextLevelThreshold: [10, 50, 100, 200, 500][Math.min(calculateLevel(totalHours, [0, 10, 50, 100, 200]) + 1, 4)] || 500,
          levels: [
            { name: 'Brąz', threshold: 0, color: 'bg-amber-700', gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 10, color: 'bg-gray-400', gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 50, color: 'bg-yellow-500', gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 100, color: 'bg-cyan-400', gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 200, color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' }
          ]
        },
        {
          id: 'discipline',
          name: 'Dyscyplina',
          description: 'Za ciągłą aktywność - dni z rzędu',
          icon: '🔥',
          currentLevel: calculateLevel(streak, [0, 3, 7, 14, 30]),
          currentProgress: streak,
          nextLevelThreshold: [3, 7, 14, 30, 60][Math.min(calculateLevel(streak, [0, 3, 7, 14, 30]) + 1, 4)] || 60,
          levels: [
            { name: 'Brąz', threshold: 0, color: 'bg-amber-700', gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 3, color: 'bg-gray-400', gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 7, color: 'bg-yellow-500', gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 14, color: 'bg-cyan-400', gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 30, color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' }
          ]
        },
        {
          id: 'perfectionist',
          name: 'Perfekcjonista',
          description: 'Za wysoką średnią ocen',
          icon: '⭐',
          currentLevel: calculateLevel(averageGrade, [0, 3, 3.5, 4, 4.5]),
          currentProgress: Math.round(averageGrade * 10) / 10,
          nextLevelThreshold: [3, 3.5, 4, 4.5, 5][Math.min(calculateLevel(averageGrade, [0, 3, 3.5, 4, 4.5]) + 1, 4)] || 5,
          levels: [
            { name: 'Brąz', threshold: 0, color: 'bg-amber-700', gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 3, color: 'bg-gray-400', gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 3.5, color: 'bg-yellow-500', gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 4, color: 'bg-cyan-400', gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 4.5, color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' }
          ]
        },
        {
          id: 'explorer',
          name: 'Eksplorator',
          description: 'Za liczbę dni aktywności',
          icon: '🗺️',
          currentLevel: calculateLevel(daysActive, [0, 5, 15, 30, 60]),
          currentProgress: daysActive,
          nextLevelThreshold: [5, 15, 30, 60, 100][Math.min(calculateLevel(daysActive, [0, 5, 15, 30, 60]) + 1, 4)] || 100,
          levels: [
            { name: 'Brąz', threshold: 0, color: 'bg-amber-700', gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 5, color: 'bg-gray-400', gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 15, color: 'bg-yellow-500', gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 30, color: 'bg-cyan-400', gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 60, color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' }
          ]
        },
        {
          id: 'scholar',
          name: 'Uczony',
          description: 'Za liczbę otrzymanych ocen',
          icon: '📚',
          currentLevel: calculateLevel(totalGrades, [0, 5, 15, 30, 50]),
          currentProgress: totalGrades,
          nextLevelThreshold: [5, 15, 30, 50, 100][Math.min(calculateLevel(totalGrades, [0, 5, 15, 30, 50]) + 1, 4)] || 100,
          levels: [
            { name: 'Brąz', threshold: 0, color: 'bg-amber-700', gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 5, color: 'bg-gray-400', gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 15, color: 'bg-yellow-500', gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 30, color: 'bg-cyan-400', gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 50, color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' }
          ]
        },
        {
          id: 'daily-learner',
          name: 'Dzień po Dniu',
          description: 'Za regularność nauki - średni czas dziennie',
          icon: '📅',
          currentLevel: calculateLevel(
            daysActive > 0 ? Math.round(totalMinutes / daysActive) : 0,
            [0, 30, 60, 120, 180]
          ),
          currentProgress: daysActive > 0 ? Math.round(totalMinutes / daysActive) : 0,
          nextLevelThreshold: [30, 60, 120, 180, 240][Math.min(
            calculateLevel(daysActive > 0 ? Math.round(totalMinutes / daysActive) : 0, [0, 30, 60, 120, 180]) + 1,
            4
          )] || 240,
          levels: [
            { name: 'Brąz', threshold: 0, color: 'bg-amber-700', gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 30, color: 'bg-gray-400', gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 60, color: 'bg-yellow-500', gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 120, color: 'bg-cyan-400', gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 180, color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' }
          ]
        }
      ];

      // Posortuj według poziomu (najwyższe pierwsze)
      const sorted = calculatedBadges
        .sort((a, b) => b.currentLevel - a.currentLevel || b.currentProgress - a.currentProgress);
      
      setBadges(sorted);
    };

    calculateBadges();
  }, [learningData, grades]);

  const fetchTeacherNotes = useCallback(async () => {
    try {
      const notesRef = collection(db, 'teacherNotes');
      const notesSnapshot = await getDocs(query(notesRef, where('studentId', '==', studentId)));
      
      const notes: TeacherNote[] = [];
      notesSnapshot.docs.forEach(doc => {
        const noteData = doc.data();
        notes.push({
          id: doc.id,
          teacherId: noteData.teacherId,
          teacherName: noteData.teacherName,
          teacherEmail: noteData.teacherEmail,
          note: noteData.note,
          createdAt: noteData.createdAt
        });
      });

      // Sortuj od najnowszych
      notes.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());
      setTeacherNotes(notes);
    } catch (error) {
      console.error('Error fetching teacher notes:', error);
    }
  }, [studentId]);

  useEffect(() => {
    if (studentId && user) {
      fetchStudentProfile();
      fetchTeacherNotes();
    }
  }, [studentId, user, fetchStudentProfile, fetchTeacherNotes]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !user || !student) return;

    try {
      setAddingNote(true);
      
      const noteData = {
        studentId,
        teacherId: user.uid,
        teacherName: user.email,
        teacherEmail: user.email,
        note: newNote.trim(),
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'teacherNotes'), noteData);
      
      setNewNote('');
      await fetchTeacherNotes();
    } catch (error) {
      console.error('Error adding note:', error);
      setError('Nie udało się dodać notatki');
    } finally {
      setAddingNote(false);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col items-center justify-center">
        <div className="text-red-600 mb-4">{error || 'Nie udało się załadować profilu ucznia'}</div>
        <button 
          onClick={() => window.location.href = '/homelogin'}
          className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
        >
          <ArrowLeft className="w-5 h-5" />
          Powrót
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full">
      {/* Header z przyciskiem powrotu */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => window.location.href = '/homelogin'}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Powrót
          </button>

          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
            Profil ucznia
          </h1>

          <div className="w-20"></div>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-none">
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-6 lg:gap-8">
            {/* Left Section - Profile and Navigation */}
            <div className="xl:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                {/* User Profile */}
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🧩</span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">{student.name}</h2>
                  <p className="text-gray-600">{student.email}</p>
                  <div className="mt-4">
                    <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                      Status: Aktywny
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="space-y-3">
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Kursy</span>
                    </div>
                    <div className="text-lg font-bold text-blue-900">{student.courses.length}</div>
                  </div>
                  
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Średnia</span>
                    </div>
                    <div className="text-lg font-bold text-green-900">{student.averageGrade.toFixed(1)}</div>
                  </div>
                  
                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-800">Aktywność</span>
                    </div>
                    <div className="text-lg font-bold text-purple-900">
                      {learningData ? Object.keys(learningData.dailyStats || {}).length : 0} dni
                    </div>
                  </div>
                </div>

                {/* Lista kursów */}
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Kursy ucznia</h3>
                  </div>
                  
                  <div className="space-y-2">
                    {student.courses.length > 0 ? (
                      student.courses.map((course, index) => (
                        <div key={index} className="group flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 hover:from-blue-100 hover:to-indigo-100 transition-all duration-300 hover:shadow-md">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                            <BookOpen className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                              {course}
                            </p>
                            <p className="text-xs text-gray-500">Aktywny kurs</p>
                          </div>
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-gray-500">
                        <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">Brak przypisanych kursów</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Section - Personal Information */}
            <div className="xl:col-span-3">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Informacje osobiste</h2>
                
                {/* Information Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {/* Imię i nazwisko */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Imię i nazwisko</p>
                        <p className="text-lg font-semibold text-gray-900">{student.name}</p>
                      </div>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <Mail className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Email</p>
                        <p className="text-lg font-semibold text-gray-900">{student.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Klasa/Grupa */}
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                        <GraduationCap className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Klasa/Grupa</p>
                        <p className="text-lg font-semibold text-gray-900">{student.class || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Telefon */}
                  <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                        <Phone className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Telefon</p>
                        <p className="text-lg font-semibold text-gray-900">{student.phone || 'Nie podano'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Lokalizacja */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Lokalizacja</p>
                        <p className="text-lg font-semibold text-gray-900">{student.address || 'Nie podano'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Status konta */}
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Status konta</p>
                        <p className="text-lg font-semibold text-gray-900">Aktywne</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Odznaki */}
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <Trophy className="w-6 h-6 text-yellow-500" />
                    <h3 className="text-xl font-semibold text-gray-900">Odznaki ({badges.length})</h3>
                  </div>
                  
                  {badges.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {badges.map((badge) => {
                        const currentLevelData = badge.levels[badge.currentLevel];
                        const progressPercentage = badge.nextLevelThreshold > 0 
                          ? Math.min(100, (badge.currentProgress / badge.nextLevelThreshold) * 100)
                          : 100;
                        return (
                          <div
                            key={badge.id}
                            className={`relative bg-gradient-to-br ${currentLevelData.gradient} rounded-xl p-4 border-2 border-white/30 hover:border-white/50 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl`}
                          >
                            {/* Poziom odznaki */}
                            <div className="absolute top-2 right-2">
                              <div className="px-2 py-1 rounded-full text-xs font-bold text-white bg-white/20 backdrop-blur-sm">
                                {currentLevelData.name}
                              </div>
                            </div>

                            {/* Ikona */}
                            <div className="flex justify-center mb-3">
                              <div className="text-4xl">
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
                                <div className="w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500 bg-white/40"
                                    style={{ width: `${progressPercentage}%` }}
                                  />
                                </div>
                                <p className="text-xs text-white/80 text-center">
                                  {Math.round(badge.currentProgress)} / {badge.nextLevelThreshold}
                                </p>
                              </div>
                            ) : (
                              <div className="text-center">
                                <div className="inline-flex items-center gap-1 px-2 py-1 bg-white/20 rounded-full">
                                  <Trophy className="w-3 h-3 text-yellow-300" />
                                  <span className="text-xs font-semibold text-white">Maksymalny poziom!</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm">Brak odznak - uczeń jeszcze nie ma wystarczających danych</p>
                    </div>
                  )}
                </div>

                {/* Statystyki ucznia */}
                <div className="mb-8">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Statystyki ucznia</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="group bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm border border-blue-200 p-6 text-center hover:shadow-lg transition-all duration-300 hover:scale-105">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:animate-bounce">
                        <BookOpen className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-3xl font-bold text-blue-600 mb-1">{student.courses.length}</div>
                      <div className="text-sm text-gray-600 mb-1">Kursy</div>
                      <div className="flex items-center justify-center gap-1 text-xs text-blue-600">
                        <TrendingUp className="w-3 h-3" />
                        <span>Aktywne</span>
                      </div>
                    </div>

                    <div className="group bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm border border-green-200 p-6 text-center hover:shadow-lg transition-all duration-300 hover:scale-105">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:animate-bounce">
                        <CheckCircle className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-3xl font-bold text-green-600 mb-1">
                        {learningData ? Math.round(learningData.totalMinutes / 60) : 0}
                      </div>
                      <div className="text-sm text-gray-600 mb-1">Godziny nauki</div>
                      <div className="flex items-center justify-center gap-1 text-xs text-green-600">
                        <Activity className="w-3 h-3" />
                        <span>Łącznie</span>
                      </div>
                    </div>

                    <div className="group bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-sm border border-purple-200 p-6 text-center hover:shadow-lg transition-all duration-300 hover:scale-105">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:animate-bounce">
                        <Star className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-3xl font-bold text-purple-600 mb-1">{student.averageGrade.toFixed(1)}</div>
                      <div className="text-sm text-gray-600 mb-1">Średnia</div>
                      <div className="flex items-center justify-center gap-1 text-xs text-purple-600">
                        <Target className="w-3 h-3" />
                        <span>Oceny</span>
                      </div>
                    </div>

                    <div className="group bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl shadow-sm border border-yellow-200 p-6 text-center hover:shadow-lg transition-all duration-300 hover:scale-105">
                      <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:animate-bounce">
                        <Zap className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-3xl font-bold text-yellow-600 mb-1">
                        {learningData ? Object.keys(learningData.dailyStats || {}).length : 0}
                      </div>
                      <div className="text-sm text-gray-600 mb-1">Dni aktywności</div>
                      <div className="flex items-center justify-center gap-1 text-xs text-yellow-600">
                        <Activity className="w-3 h-3" />
                        <span>Aktywność</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notatki nauczycieli */}
          <div className="mt-4 sm:mt-6 lg:mt-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Notatki nauczycieli</h2>
              
              {/* Dodawanie nowej notatki */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex flex-col sm:flex-row gap-3">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Dodaj notatkę o uczniu..."
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={3}
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || addingNote}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 sm:w-auto w-full"
                  >
                    {addingNote ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Dodaj
                  </button>
                </div>
              </div>

              {/* Lista notatek */}
              <div className="space-y-4">
                {teacherNotes.map((note) => (
                  <div key={note.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-medium text-gray-900">{note.teacherName}</span>
                        <span className="text-sm text-gray-500 ml-2">
                          {note.createdAt?.toDate?.() ? 
                            note.createdAt.toDate().toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '/') : 
                            'Data nieznana'
                          }
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{note.teacherEmail}</span>
                    </div>
                    <p className="text-gray-700">{note.note}</p>
                  </div>
                ))}
                
                {teacherNotes.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>Brak notatek nauczycieli</p>
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
