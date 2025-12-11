'use client';

// Force dynamic rendering to prevent SSR issues with client-side hooks
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Plus, ArrowLeft, User, Award, Users, Pencil, Trash2, X } from 'lucide-react';
import { db } from '@/config/firebase';
import { collection, getDocs, addDoc, query, where, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Class } from '@/types/models';

interface Grade {
  id: string;
  studentName: string;
  studentEmail: string;
  studentId: string;
  date: string;
  type: string;
  grade: string;
  comments: string;
  course?: string;
  subject?: string;
  courseId?: string;
  gradeType?: string;
  description?: string;
  graded_at?: string;
  value?: string | number;
  value_grade?: string | number;
  quiz_title?: string;
  percentage?: number;
}

interface UserData {
  id: string;
  uid?: string;
  email?: string;
  displayName?: string;
  role?: string;
  [key: string]: any;
}

interface Student {
  uid: string;
  displayName: string;
  email: string;
  role?: string;
  assignedToTeacher?: string;
}

interface GroupedGrades {
  [className: string]: {
    students: {
      [studentId: string]: {
        student: Student;
        grades: Grade[];
      };
    };
  };
}

export default function TeacherGradesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [showAddGradeModal, setShowAddGradeModal] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [gradeData, setGradeData] = useState({
    classId: '',
    grade: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    gradeType: ''
  });
  const [addGradeLoading, setAddGradeLoading] = useState(false);
  const [addGradeSuccess, setAddGradeSuccess] = useState('');
  const [addGradeError, setAddGradeError] = useState('');
  
  // Edycja i usuwanie ocen
  const [showEditGradeModal, setShowEditGradeModal] = useState(false);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [editGradeData, setEditGradeData] = useState({
    grade: '',
    description: '',
    date: '',
    gradeType: ''
  });
  const [editGradeLoading, setEditGradeLoading] = useState(false);
  const [deleteConfirmGrade, setDeleteConfirmGrade] = useState<Grade | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedGradeDetails, setSelectedGradeDetails] = useState<Grade | null>(null);
  

  const GRADE_TYPES = [
    { value: 'kartkówka', label: 'Kartkówka' },
    { value: 'sprawdzian', label: 'Sprawdzian' },
    { value: 'inne', label: 'Inne' },
  ];

  // Dostępne oceny od 0 do 6 (z plusami i minusami)
  const AVAILABLE_GRADES = [
    { value: '0', label: '0' },
    { value: '1', label: '1' },
    { value: '1+', label: '1+' },
    { value: '2-', label: '2-' },
    { value: '2', label: '2' },
    { value: '2+', label: '2+' },
    { value: '3-', label: '3-' },
    { value: '3', label: '3' },
    { value: '3+', label: '3+' },
    { value: '4-', label: '4-' },
    { value: '4', label: '4' },
    { value: '4+', label: '4+' },
    { value: '5-', label: '5-' },
    { value: '5', label: '5' },
    { value: '5+', label: '5+' },
    { value: '6-', label: '6-' },
    { value: '6', label: '6' },
  ];

  const fetchClasses = useCallback(async () => {
    if (!user) return;
    
    try {
      console.log('📚 fetchClasses - Fetching classes for teacher:', user.uid);
      
      const classesQuery = query(
        collection(db, 'classes'),
        where('teacher_id', '==', user.uid)
      );
      const classesSnapshot = await getDocs(classesQuery);
      
      const classesList = classesSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Class))
        .filter(cls => cls.is_active);
      
      setClasses(classesList);
      console.log('📚 fetchClasses - Teacher classes:', classesList.length);
      
    } catch (error) {
      console.error('❌ Error fetching classes:', error);
    }
  }, [user]);

  const fetchStudents = useCallback(async () => {
    if (!user) return;
    
    try {
      console.log('👥 fetchStudents - Fetching students for teacher:', user.email);
      
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      
      const allUsers = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserData));
      
      // Filtruj tylko studentów przypisanych do tego nauczyciela
      const teacherStudents = allUsers.filter(userData => 
        userData.role === 'student' && 
        userData.uid && // Upewnij się, że uid istnieje
        (userData.assignedToTeacher === user.uid || 
         userData.assignedToTeacher === user.email)
      ).map(userData => ({
        uid: userData.uid!,
        displayName: userData.displayName || '',
        email: userData.email || '',
        role: userData.role,
        assignedToTeacher: userData.assignedToTeacher
      } as Student));
      
      console.log('👥 fetchStudents - All users:', allUsers.length);
      console.log('👥 fetchStudents - Teacher students:', teacherStudents.length);
      
      setStudents(teacherStudents);
      
    } catch (error) {
      console.error('❌ Error fetching students:', error);
    }
  }, [user]);

  const fetchGrades = useCallback(async () => {
    if (!user) return;
    
    try {
      console.log('📊 fetchGrades - Fetching grades for teacher:', user.email);
      
      const gradesRef = collection(db, 'grades');
      const gradesSnapshot = await getDocs(gradesRef);
      
      const allGrades = gradesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade));
      
      // Filtruj oceny tylko dla uczniów przypisanych do tego nauczyciela
      const teacherStudentIds = students.map(student => student.uid);
      const teacherGrades = allGrades.filter(grade => 
        teacherStudentIds.includes(grade.studentId) ||
        students.some(student => student.email === grade.studentEmail)
      );
      
      console.log('📊 fetchGrades - All grades:', allGrades.length);
      console.log('📊 fetchGrades - Teacher grades:', teacherGrades.length);
      
      setGrades(teacherGrades);
      
    } catch (error) {
      console.error('❌ Error fetching grades:', error);
    }
  }, [user, students]);

  useEffect(() => {
    if (!user) return;
    
    const loadData = async () => {
      setLoading(true);
      try {
        await fetchClasses();
        await fetchStudents();
    } catch (error) {
        console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

    loadData();
  }, [user, fetchClasses, fetchStudents]);

  useEffect(() => {
    if (students.length > 0) {
      fetchGrades();
    }
  }, [students, user, fetchGrades]);

  // Grupowanie ocen po klasach i uczniach
  const groupedGrades: GroupedGrades = classes.reduce((acc, classItem) => {
    acc[classItem.name] = {
      students: {}
    };
    
    // Znajdź wszystkich studentów z tej klasy
    const classStudents = students.filter(student => 
      classItem.students?.includes(student.uid)
    );
    
    // Dla każdego ucznia z klasy, znajdź jego oceny
    classStudents.forEach(student => {
      const studentGrades = grades.filter(grade => 
        grade.studentId === student.uid || grade.studentEmail === student.email
      );
      
      if (studentGrades.length > 0 || classStudents.length > 0) {
        acc[classItem.name].students[student.uid] = {
          student,
          grades: studentGrades.sort((a, b) => {
            const dateA = a.date || a.graded_at || '';
            const dateB = b.date || b.graded_at || '';
            if (!dateA) return 1;
            if (!dateB) return -1;
            return new Date(dateA).getTime() - new Date(dateB).getTime();
          })
        };
      }
    });
    
    return acc;
  }, {} as GroupedGrades);

  // Funkcja do określania koloru badge na podstawie oceny
  function getGradeColor(grade: string | number | undefined) {
    const gradeStr = String(grade || '');
    if (gradeStr === '5' || gradeStr === '6') return 'bg-green-500 text-white shadow-green-200';
    if (gradeStr === '4') return 'bg-emerald-500 text-white shadow-emerald-200';
    if (gradeStr === '3') return 'bg-yellow-500 text-white shadow-yellow-200';
    if (gradeStr === '2') return 'bg-orange-500 text-white shadow-orange-200';
    if (gradeStr === '1') return 'bg-red-500 text-white shadow-red-200';
    if (gradeStr === '+') return 'bg-blue-500 text-white shadow-blue-200';
    if (gradeStr === '-') return 'bg-gray-500 text-white shadow-gray-200';
    return 'bg-gray-400 text-white shadow-gray-200';
  }

  // Funkcja do liczenia średniej ocen (tylko liczbowych)
  function calculateAverage(grades: Grade[]): string {
    const numericGrades = grades
      .map(g => {
        const gradeValue = g.grade || g.value || g.value_grade;
        if (!gradeValue) return NaN;
        return parseFloat(String(gradeValue).replace(',', '.'));
      })
      .filter(n => !isNaN(n));
    if (numericGrades.length === 0) return '-';
    const avg = numericGrades.reduce((a, b) => a + b, 0) / numericGrades.length;
    return avg.toFixed(2);
  }

  // Oblicz statystyki
  const classesCount = classes.length;
  const totalStudents = students.length;
  
  // Oblicz ogólną średnią wszystkich ocen
  const allGradesForAverage = grades.filter(g => {
    const gradeValue = g.grade || g.value || g.value_grade;
    return gradeValue && !isNaN(parseFloat(String(gradeValue).replace(',', '.')));
  });
  const overallAverage = allGradesForAverage.length > 0
    ? allGradesForAverage.reduce((total, g) => {
        const gradeValue = parseFloat(String(g.grade || g.value || g.value_grade).replace(',', '.'));
        return total + gradeValue;
      }, 0) / allGradesForAverage.length
    : 0;

  const handleAddGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedStudent || !selectedClass) return;
    
    setAddGradeLoading(true);
    setAddGradeError('');
    setAddGradeSuccess('');

    try {
      const student = students.find(s => s.uid === selectedStudent);
      if (!student) {
        throw new Error('Nie znaleziono ucznia');
      }

      const selectedClassData = classes.find(c => c.id === selectedClass);
      if (!selectedClassData) {
        throw new Error('Nie znaleziono klasy');
      }

      const gradeDoc = {
        studentId: selectedStudent,
        studentName: student.displayName,
        studentEmail: student.email,
        teacherId: user.uid,
        teacherEmail: user.email,
        classId: selectedClass,
        className: selectedClassData.name,
        grade: gradeData.grade,
        description: gradeData.description,
        date: gradeData.date,
        gradeType: gradeData.gradeType,
        graded_at: new Date().toISOString(),
        created_at: new Date(),
        updated_at: new Date()
      };

      await addDoc(collection(db, 'grades'), gradeDoc);
      
      setAddGradeSuccess('Ocena została dodana pomyślnie!');
      setGradeData({
        classId: '',
        grade: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        gradeType: ''
      });
      setSelectedStudent('');
      setSelectedClass('');
      setShowAddGradeModal(false);
      
      // Odśwież listę ocen
      await fetchGrades();

    } catch (error) {
      console.error('Error adding grade:', error);
      setAddGradeError('Błąd podczas dodawania oceny');
    } finally {
      setAddGradeLoading(false);
    }
  };

  // Funkcja do usuwania oceny
  const handleDeleteGrade = async (grade: Grade) => {
    if (!grade.id) return;
    
    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, 'grades', grade.id));
      console.log('✅ Ocena usunięta:', grade.id);
      setDeleteConfirmGrade(null);
      await fetchGrades();
    } catch (error) {
      console.error('❌ Błąd podczas usuwania oceny:', error);
      alert('Błąd podczas usuwania oceny');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Funkcja do otwierania modalu edycji
  const openEditModal = (grade: Grade) => {
    setEditingGrade(grade);
    setEditGradeData({
      grade: String(grade.grade || grade.value || grade.value_grade || ''),
      description: grade.description || grade.comments || '',
      date: grade.date || grade.graded_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      gradeType: grade.gradeType || grade.type || ''
    });
    setShowEditGradeModal(true);
  };

  // Funkcja do zapisywania edytowanej oceny
  const handleEditGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGrade?.id) return;
    
    setEditGradeLoading(true);
    try {
      await updateDoc(doc(db, 'grades', editingGrade.id), {
        grade: editGradeData.grade,
        value: editGradeData.grade,
        description: editGradeData.description,
        date: editGradeData.date,
        gradeType: editGradeData.gradeType,
        updated_at: new Date()
      });
      
      console.log('✅ Ocena zaktualizowana:', editingGrade.id);
      setShowEditGradeModal(false);
      setEditingGrade(null);
      await fetchGrades();
    } catch (error) {
      console.error('❌ Błąd podczas edycji oceny:', error);
      alert('Błąd podczas edycji oceny');
    } finally {
      setEditGradeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Ładowanie dziennika ocen...</p>
        </div>
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
              onClick={() => router.push('/homelogin/teacher')}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Powrót</span>
          </button>

          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Dziennik ocen - Nauczyciel
          </h1>

            <div className="flex gap-2">
        <button 
          onClick={() => setShowAddGradeModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
        >
                <Plus className="w-4 h-4" />
                Dodaj ocenę
        </button>
            </div>
          </div>
        </div>
      </div>

      {/* Główny kontener - pełna szerokość */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* User Profile Section - pełna szerokość */}
        <div className="w-full bg-white rounded-2xl shadow-lg p-6 mb-8 border border-white/20">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
              {user?.email ? user.email.split('@')[0].split('.').map(n => n[0]).join('').toUpperCase() : <User className="w-8 h-8" />}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-800 mb-1">{user?.email?.split('@')[0] || 'Nauczyciel'}</h2>
              <p className="text-gray-600">Dziennik ocen i zarządzanie ocenami uczniów</p>
            </div>
            </div>
            </div>

        {/* Statistics Cards - skalowalne */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-white/20 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Klasy</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-800">{classesCount}</p>
            </div>
          </div>
                  </div>

          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-white/20 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <User className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Uczniowie</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-800">{totalStudents}</p>
            </div>
        </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-white/20 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                <Award className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
        </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Średnia ogólna</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-800">{overallAverage.toFixed(2)}</p>
              </div>
            </div>
          </div>
      </div>

        {/* Grades Table - klasy z uczniami */}
        <div className="w-full space-y-6">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Ładowanie ocen...</p>
            </div>
          ) : classes.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center border border-white/20">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Brak klas</h3>
              <p className="text-gray-600">Nie masz jeszcze żadnych klas. Utwórz klasę, aby móc dodawać oceny.</p>
            </div>
          ) : (
            classes.map((classItem) => {
              const classData = groupedGrades[classItem.name];
              const classStudents = classData?.students ? Object.values(classData.students) : [];
              
              return (
                <div key={classItem.id} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-white/20">
                  <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700">
                    <h2 className="text-lg sm:text-xl font-bold text-white">{classItem.name}</h2>
                    {classItem.description && (
                      <p className="text-blue-100 text-sm mt-1">{classItem.description}</p>
                    )}
                  </div>
                  
                  <div className="h-8"></div>
                  
                  {classStudents.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-gray-600">Brak uczniów w tej klasie</p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop: Table */}
                      <div className="hidden md:block w-full overflow-x-auto">
                        <table className="w-full min-w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Uczeń</th>
                              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Oceny</th>
                              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Średnia</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {classStudents.map(({ student, grades: studentGrades }) => (
                              <tr key={student.uid} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                      <User className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <span className="font-semibold text-gray-800 text-base">{student.displayName}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  {studentGrades.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {studentGrades.map((grade) => {
                                        const gradeValue = grade.grade || grade.value || grade.value_grade;
                                        
                                        return (
                                          <button
                                            key={grade.id}
                                            onClick={() => setSelectedGradeDetails(grade)}
                                            className={`px-3 py-1.5 rounded-lg font-bold text-sm shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md cursor-pointer ${getGradeColor(gradeValue)}`}
                                            title="Kliknij aby zobaczyć szczegóły"
                                          >
                                            {gradeValue}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-sm text-gray-500">Brak ocen</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                                    {studentGrades.length > 0 ? calculateAverage(studentGrades) : 'Brak ocen'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile: Cards */}
                      <div className="md:hidden space-y-4 p-4">
                        {classStudents.map(({ student, grades: studentGrades }) => (
                          <div key={`mobile-${student.uid}`} className="bg-gray-50 rounded-xl p-4 border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <User className="w-5 h-5 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-800 text-base truncate">{student.displayName}</h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Średnia: <span className="font-semibold text-blue-600">
                                    {studentGrades.length > 0 ? calculateAverage(studentGrades) : 'Brak ocen'}
                                  </span>
                                </p>
                              </div>
                            </div>
                            
                            {studentGrades.length > 0 ? (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-gray-600 mb-2">Oceny:</p>
                                <div className="flex flex-wrap gap-2">
                                  {studentGrades.map((grade) => {
                                    const gradeValue = grade.grade || grade.value || grade.value_grade;
                                    
                                    return (
                                      <button
                                        key={grade.id}
                                        onClick={() => setSelectedGradeDetails(grade)}
                                        className={`min-w-[48px] min-h-[48px] px-4 py-2 rounded-lg font-bold text-base shadow-sm ${getGradeColor(gradeValue)}`}
                                      >
                                        {gradeValue}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 text-center py-4">Brak ocen</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal dodawania oceny */}
      {showAddGradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto my-auto">
            <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">Dodaj nową ocenę</h2>
              <button 
                onClick={() => setShowAddGradeModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
              </button>
            </div>
            
            <form onSubmit={handleAddGrade} className="space-y-4">
                {/* Wybór ucznia */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Uczeń *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={selectedClass ? "Wyszukaj ucznia z wybranej klasy..." : "Najpierw wybierz klasę"}
                      value={studentSearchTerm}
                      onChange={(e) => {
                        setStudentSearchTerm(e.target.value);
                        setShowStudentDropdown(true);
                      }}
                      onFocus={() => {
                        if (selectedClass) {
                          setShowStudentDropdown(true);
                        }
                      }}
                      disabled={!selectedClass}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                    {showStudentDropdown && selectedClass && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                        {students
                          .filter(student => {
                            // Filtruj tylko uczniów z wybranej klasy
                            const selectedClassData = classes.find(c => c.id === selectedClass);
                            if (!selectedClassData || !selectedClassData.students?.includes(student.uid)) {
                              return false;
                            }
                            // Filtruj po wyszukiwaniu
                            return student.displayName.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
                                   student.email.toLowerCase().includes(studentSearchTerm.toLowerCase());
                          })
                          .map(student => (
                                <button
                              key={student.uid}
                                  type="button"
                              onClick={() => {
                                setSelectedStudent(student.uid);
                                setStudentSearchTerm(student.displayName);
                                setShowStudentDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-100 transition-colors"
                            >
                              <div className="font-medium">{student.displayName}</div>
                              <div className="text-sm text-gray-500">{student.email}</div>
                                </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Wybór klasy */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Klasa *
                  </label>
                  <select
                    value={selectedClass}
                    onChange={(e) => {
                      setSelectedClass(e.target.value);
                      setGradeData(prev => ({ ...prev, classId: e.target.value }));
                      // Resetuj wybór ucznia gdy zmieniamy klasę
                      setSelectedStudent('');
                      setStudentSearchTerm('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Wybierz klasę</option>
                    {classes.map(classItem => (
                      <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
                    ))}
                  </select>
              </div>

                {/* Ocena */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ocena *
                  </label>
                  <select
                    value={gradeData.grade}
                    onChange={(e) => setGradeData(prev => ({ ...prev, grade: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Wybierz ocenę (0-6)</option>
                    {AVAILABLE_GRADES.map(grade => (
                      <option key={grade.value} value={grade.value}>{grade.label}</option>
                    ))}
                  </select>
                </div>
                
                {/* Typ oceny */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Typ oceny
                  </label>
                  <select
                    value={gradeData.gradeType}
                    onChange={(e) => setGradeData(prev => ({ ...prev, gradeType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Wybierz typ</option>
                    {GRADE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                
                {/* Data */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data *
                  </label>
                  <input
                    type="date"
                    value={gradeData.date}
                    onChange={(e) => setGradeData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
              </div>

                {/* Opis */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Opis
                </label>
                <textarea
                  value={gradeData.description}
                  onChange={(e) => setGradeData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Dodatkowe informacje o ocenie..."
                  rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

                {/* Komunikaty */}
                {addGradeError && (
                  <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                    {addGradeError}
                  </div>
                )}
              {addGradeSuccess && (
                  <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                  {addGradeSuccess}
                </div>
              )}
              
                {/* Przyciski */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddGradeModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                    disabled={addGradeLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {addGradeLoading ? 'Dodawanie...' : 'Dodaj ocenę'}
                </button>
              </div>
            </form>
          </div>
        </div>
                        </div>
                      )}

      {/* Modal edycji oceny */}
      {showEditGradeModal && editingGrade && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">Edytuj ocenę</h2>
                <button
                  onClick={() => { setShowEditGradeModal(false); setEditingGrade(null); }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Uczeń:</span> {editingGrade.studentName}
                </p>
              </div>

              <form onSubmit={handleEditGrade} className="space-y-4">
                {/* Ocena */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ocena *
                  </label>
                  <select
                    value={editGradeData.grade}
                    onChange={(e) => setEditGradeData(prev => ({ ...prev, grade: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Wybierz ocenę (0-6)</option>
                    {AVAILABLE_GRADES.map(grade => (
                      <option key={grade.value} value={grade.value}>{grade.label}</option>
                    ))}
                  </select>
                </div>

                {/* Typ oceny */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Typ oceny
                  </label>
                  <select
                    value={editGradeData.gradeType}
                    onChange={(e) => setEditGradeData(prev => ({ ...prev, gradeType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Wybierz typ</option>
                    {GRADE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                {/* Data */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data *
                  </label>
                  <input
                    type="date"
                    value={editGradeData.date}
                    onChange={(e) => setEditGradeData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Opis */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Opis
                  </label>
                  <textarea
                    value={editGradeData.description}
                    onChange={(e) => setEditGradeData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Dodatkowe informacje o ocenie..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Przyciski */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowEditGradeModal(false); setEditingGrade(null); }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={editGradeLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {editGradeLoading ? 'Zapisywanie...' : 'Zapisz zmiany'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal szczegółów oceny */}
      {selectedGradeDetails && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Szczegóły oceny</h3>
              <button
                onClick={() => setSelectedGradeDetails(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Ocena - duża */}
            <div className="text-center mb-6">
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl text-3xl font-bold shadow-lg ${getGradeColor(selectedGradeDetails.grade || selectedGradeDetails.value || selectedGradeDetails.value_grade)}`}>
                {selectedGradeDetails.grade || selectedGradeDetails.value || selectedGradeDetails.value_grade}
              </div>
            </div>

            {/* Szczegóły */}
            <div className="space-y-3 mb-6">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Uczeń:</span>
                <span className="font-medium text-gray-800">{selectedGradeDetails.studentName}</span>
              </div>
              
              {(selectedGradeDetails.gradeType || selectedGradeDetails.type) && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Typ:</span>
                  <span className="font-medium text-gray-800">{selectedGradeDetails.gradeType || selectedGradeDetails.type}</span>
                </div>
              )}
              
              {selectedGradeDetails.quiz_title && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Quiz:</span>
                  <span className="font-medium text-gray-800">{selectedGradeDetails.quiz_title}</span>
                </div>
              )}
              
              {selectedGradeDetails.percentage !== undefined && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Wynik:</span>
                  <span className="font-medium text-gray-800">{selectedGradeDetails.percentage}%</span>
                </div>
              )}
              
              {(selectedGradeDetails.description || selectedGradeDetails.comments) && (
                <div className="py-2 border-b border-gray-100">
                  <span className="text-gray-600 block mb-1">Opis:</span>
                  <span className="text-gray-800">{selectedGradeDetails.description || selectedGradeDetails.comments}</span>
                </div>
              )}
              
              {(selectedGradeDetails.date || selectedGradeDetails.graded_at) && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Data:</span>
                  <span className="font-medium text-gray-800">
                    {new Date(selectedGradeDetails.date || selectedGradeDetails.graded_at || '').toLocaleDateString('pl-PL', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      year: 'numeric' 
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Przyciski akcji */}
            {!selectedGradeDetails.quiz_title ? (
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedGradeDetails(null);
                    openEditModal(selectedGradeDetails);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium"
                >
                  <Pencil className="w-4 h-4" />
                  Edytuj
                </button>
                <button
                  onClick={() => {
                    setSelectedGradeDetails(null);
                    setDeleteConfirmGrade(selectedGradeDetails);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Usuń
                </button>
              </div>
            ) : (
              <div className="text-center text-sm text-gray-500 py-2 bg-gray-50 rounded-lg">
                Ocena z quizu - nie można edytować ani usunąć
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal potwierdzenia usunięcia */}
      {deleteConfirmGrade && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Usuń ocenę?</h3>
              <p className="text-gray-600 mb-2">
                Czy na pewno chcesz usunąć ocenę <span className="font-bold">{deleteConfirmGrade.grade || deleteConfirmGrade.value}</span>?
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Uczeń: {deleteConfirmGrade.studentName}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmGrade(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={deleteLoading}
                >
                  Anuluj
                </button>
                <button
                  onClick={() => handleDeleteGrade(deleteConfirmGrade)}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors"
                >
                  {deleteLoading ? 'Usuwanie...' : 'Usuń'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 