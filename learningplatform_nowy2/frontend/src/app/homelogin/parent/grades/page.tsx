'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';
import { BookOpen, Award, Calendar, User } from 'lucide-react';

interface Grade {
  id: string;
  subject: string;
  grade?: string;
  value?: string | number;
  value_grade?: string | number;
  description?: string;
  comment?: string;
  date?: string;
  graded_at?: string;
  teacherId?: string;
  gradeType?: string;
  grade_type?: string;
  quiz_title?: string;
  percentage?: number;
  quiz_id?: string;
  course_id?: string;
}

interface GroupedGrades {
  [subject: string]: Grade[];
}

interface Course {
  id: string;
  title?: string;
  name?: string;
  [key: string]: any;
}

export default function ParentGrades() {
  const { user } = useAuth();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string>('');
  const [userCourses, setUserCourses] = useState<any[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentEmail, setStudentEmail] = useState<string | null>(null);
  const [attendanceData, setAttendanceData] = useState<{[subject: string]: {present: number, total: number, percentage: number}}>({});
  const [globalAttendance, setGlobalAttendance] = useState<{present: number, total: number, percentage: number}>({present: 0, total: 0, percentage: 0});

  useEffect(() => {
    if (!user) return;
    
    // Znajdź przypisanego ucznia
    const fetchStudent = async () => {
      try {
        const parentStudentsRef = collection(db, 'parent_students');
        const parentStudentsQuery = query(parentStudentsRef, where('parent', '==', user.uid));
        const parentStudentsSnapshot = await getDocs(parentStudentsQuery);

        if (parentStudentsSnapshot.empty) {
          setLoading(false);
          return;
        }

        const foundStudentId = parentStudentsSnapshot.docs[0].data().student;
        setStudentId(foundStudentId);

        // Pobierz dane ucznia
        const studentDoc = await getDoc(doc(db, 'users', foundStudentId));
        if (studentDoc.exists()) {
          const studentData = studentDoc.data();
          setStudentEmail(studentData.email);
          setDisplayName(studentData.displayName || `${studentData.firstName || ''} ${studentData.lastName || ''}`.trim() || studentData.email || '');
        }
      } catch (err) {
        console.error('Error fetching student:', err);
        setLoading(false);
      }
    };

    fetchStudent();
  }, [user]);

  // Pobierz kursy ucznia
  useEffect(() => {
    const fetchUserCourses = async () => {
      if (!studentId) return;
      
      try {
        // Pobierz kursy gdzie assignedUsers zawiera studentId
        const coursesByUidQuery = query(
          collection(db, 'courses'),
          where('assignedUsers', 'array-contains', studentId)
        );
        const coursesByUidSnapshot = await getDocs(coursesByUidQuery);
        const coursesByUidList = coursesByUidSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Pobierz kursy gdzie assignedUsers zawiera studentEmail
        let coursesByEmailList: any[] = [];
        if (studentEmail) {
          const coursesByEmailQuery = query(
            collection(db, 'courses'),
            where('assignedUsers', 'array-contains', studentEmail)
          );
          const coursesByEmailSnapshot = await getDocs(coursesByEmailQuery);
          coursesByEmailList = coursesByEmailSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        // DODATKOWO: Pobierz wszystkie kursy i sprawdź które mają oceny dla tego użytkownika
        const allCoursesSnapshot = await getDocs(collection(db, 'courses'));
        const allCoursesList: Course[] = allCoursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sprawdź które kursy mają oceny dla tego użytkownika
        const gradesQuery = query(
          collection(db, 'grades'),
          where('user_id', '==', studentId)
        );
        const gradesSnapshot = await getDocs(gradesQuery);
        const userGrades = gradesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade));

        // Znajdź kursy z ocenami
        const coursesWithGrades: Course[] = [];
        for (const grade of userGrades) {
          if (grade.course_id) {
            const courseWithGrade = allCoursesList.find(course => course.id === grade.course_id);
            if (courseWithGrade && !coursesWithGrades.find(c => c.id === courseWithGrade.id)) {
              coursesWithGrades.push(courseWithGrade);
            }
          }
        }

        // Połącz wszystkie kursy: assigned + z ocenami
        const allCourses = [...coursesByUidList, ...coursesByEmailList, ...coursesWithGrades];
        const uniqueCourses = allCourses.filter((course, index, self) =>
          index === self.findIndex(c => c.id === course.id)
        );
        
        setUserCourses(uniqueCourses);
      } catch (error) {
        console.error('❌ Error fetching user courses:', error);
        setUserCourses([]);
      }
    };

    fetchUserCourses();
  }, [studentId, studentEmail]);

  const fetchGrades = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);

    // Pobierz wszystkie oceny użytkownika
    const gradesQuery = query(collection(db, 'grades'), where('user_id', '==', studentId));
    const gradesSnapshot = await getDocs(gradesQuery);
    const gradesList = gradesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade));

    // Pobierz również oceny gdzie studentEmail jest równy email użytkownika
    let gradesByEmailList: Grade[] = [];
    if (studentEmail) {
      const gradesByEmailQuery = query(collection(db, 'grades'), where('studentEmail', '==', studentEmail));
      const gradesByEmailSnapshot = await getDocs(gradesByEmailQuery);
      gradesByEmailList = gradesByEmailSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade));
    }

    // Pobierz również oceny gdzie studentId jest równy studentId
    const gradesByStudentIdQuery = query(collection(db, 'grades'), where('studentId', '==', studentId));
    const gradesByStudentIdSnapshot = await getDocs(gradesByStudentIdQuery);
    const gradesByStudentIdList = gradesByStudentIdSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade));

    // Połącz obie listy i usuń duplikaty
    const allGrades = [...gradesList, ...gradesByEmailList, ...gradesByStudentIdList];
    const uniqueGrades = allGrades.filter((grade, index, self) =>
      index === self.findIndex(g => g.id === grade.id)
    );

    setGrades(uniqueGrades);
    setLoading(false);
  }, [studentId, studentEmail]);

  useEffect(() => {
    if (!studentId) return;
    fetchGrades();
  }, [studentId, studentEmail, fetchGrades]);

  // Grupowanie ocen po przedmiocie i sortowanie po dacie rosnąco
  const groupedGrades: GroupedGrades = grades.reduce((acc, grade) => {
    const subject = grade.subject || 'Inne';
    if (!acc[subject]) acc[subject] = [];
    acc[subject].push(grade);
    return acc;
  }, {} as GroupedGrades);

  // Funkcja do określania typu kursu (obowiązkowy/fakultatywny)
  const getCourseType = (subject: string): 'obowiązkowy' | 'fakultatywny' => {
    const course = userCourses.find(c => c.title === subject);
    return course?.courseType || 'obowiązkowy'; // domyślnie obowiązkowy
  };

  // Funkcja do obliczania frekwencji dla przedmiotu
  const calculateAttendanceForSubject = (subject: string, studentId: string | null): {present: number, total: number, percentage: number} => {
    if (!studentId || !attendanceData[subject]) {
      return {present: 0, total: 0, percentage: 0};
    }
    return attendanceData[subject];
  };

  // Pobierz frekwencję z events
  useEffect(() => {
    const fetchAttendance = async () => {
      if (!studentId) return;

      try {
        // Pobierz wszystkie wydarzenia (events) dla ucznia
        const eventsRef = collection(db, 'events');
        const eventsSnapshot = await getDocs(eventsRef);
        const allEvents = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filtruj wydarzenia dla ucznia
        const studentEvents = allEvents.filter((event: any) => {
          if (event.assignedTo && event.assignedTo.includes(studentId)) return true;
          if (event.students && event.students.includes(studentId)) return true;
          return false;
        });

        // Grupuj wydarzenia po przedmiocie/subject
        const eventsBySubject: {[subject: string]: any[]} = {};
        studentEvents.forEach((event: any) => {
          const subject = event.subject || event.title || 'Inne';
          if (!eventsBySubject[subject]) {
            eventsBySubject[subject] = [];
          }
          eventsBySubject[subject].push(event);
        });

        // Oblicz frekwencję per przedmiot
        const attendanceBySubject: {[subject: string]: {present: number, total: number, percentage: number}} = {};
        let globalPresent = 0;
        let globalTotal = 0;

        Object.keys(eventsBySubject).forEach(subject => {
          const subjectEvents = eventsBySubject[subject];
          let present = 0;
          const total = subjectEvents.length;

          // Sprawdź obecności w eventach (jeśli mają pole attendance)
          subjectEvents.forEach((event: any) => {
            if (event.attendance) {
              const studentAttendance = event.attendance[studentId] || event.attendance[studentEmail || ''];
              if (studentAttendance === 'present' || studentAttendance === true) {
                present++;
              }
            } else {
              // Jeśli nie ma danych o obecności, zakładamy że uczeń był obecny (dla wydarzeń przypisanych)
              present++;
            }
          });

          const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
          attendanceBySubject[subject] = {present, total, percentage};
          globalPresent += present;
          globalTotal += total;
        });

        setAttendanceData(attendanceBySubject);
        
        // Oblicz globalną frekwencję
        const globalPercentage = globalTotal > 0 ? Math.round((globalPresent / globalTotal) * 100) : 0;
        setGlobalAttendance({
          present: globalPresent,
          total: globalTotal,
          percentage: globalPercentage
        });
      } catch (error) {
        console.error('Error fetching attendance:', error);
        // Ustaw domyślne wartości jeśli nie ma danych
        setGlobalAttendance({present: 0, total: 0, percentage: 0});
      }
    };

    fetchAttendance();
  }, [studentId, studentEmail]);

  // Rozdzielenie kursów na obowiązkowe i fakultatywne (włączając kursy bez ocen)
  const allCourses = [...Object.entries(groupedGrades)];
  
  // Dodaj kursy bez ocen do listy
  userCourses.forEach(course => {
    const courseTitle = course.title || course.name || 'Nieznany kurs';
    if (!groupedGrades[courseTitle]) {
      allCourses.push([courseTitle, []]);
    }
  });

  const mandatoryCourses = allCourses.filter(([subject]) => 
    getCourseType(subject) === 'obowiązkowy'
  );
  const electiveCourses = allCourses.filter(([subject]) => 
    getCourseType(subject) === 'fakultatywny'
  );

  
  // Sortuj oceny w każdym przedmiocie po dacie rosnąco
  Object.keys(groupedGrades).forEach(subject => {
    groupedGrades[subject].sort((a, b) => {
      // Jeśli data nie istnieje, traktuj jako najstarszą
      if (!a.date) return -1;
      if (!b.date) return 1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  });

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
    // inne przypadki, np. opisowe
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

  // Oblicz ogólną średnią tylko z przedmiotów obowiązkowych, które mają oceny
  const mandatoryCoursesWithGrades = mandatoryCourses.filter(([, subjectGrades]) => 
    subjectGrades.length > 0
  );
  const overallAverage = mandatoryCoursesWithGrades.reduce((total, [, subjectGrades]) => {
    const avg = calculateAverage(subjectGrades);
    return avg !== '-' ? total + parseFloat(avg) : total;
  }, 0) / (mandatoryCoursesWithGrades.length || 1);

  // Oblicz statystyki
  const mandatorySubjectsCount = mandatoryCourses.length;
  const electiveSubjectsCount = electiveCourses.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Header - pełna szerokość */}
      <div className="w-full bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Dziennik ocen
            </h1>
            
            <button
              onClick={fetchGrades}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
            >
              {loading ? 'Ładowanie...' : 'Odśwież'}
            </button>
          </div>
        </div>
      </div>

      {/* Główny kontener - pełna szerokość */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* User Profile Section - pełna szerokość */}
        <div className="w-full bg-white rounded-2xl shadow-lg p-6 mb-8 border border-white/20">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
              {displayName ? displayName.split(' ').map(n => n[0]).join('').toUpperCase() : <User className="w-8 h-8" />}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-800 mb-1">{displayName || 'Uczeń'}</h2>
              <p className="text-gray-600">Dziennik ocen i postępów</p>
            </div>
          </div>
        </div>

        {/* Statistics Cards - skalowalne */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-white/20 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Przedmioty obowiązkowe</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-800">{mandatorySubjectsCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-white/20 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <Award className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Przedmioty fakultatywne</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-800">{electiveSubjectsCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-white/20 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Średnia ogólna</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-800">{overallAverage.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Grades Grid - widok kafelkowy */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
          {/* Przedmioty obowiązkowe - kafelki */}
          {mandatoryCourses.map(([subject, subjectGrades]) => {
            // Oblicz frekwencję dla tego przedmiotu
            const attendance = calculateAttendanceForSubject(subject, studentId);
            return (
              <div 
                key={`mandatory-${subject}`} 
                className="bg-white rounded-xl shadow-md border border-gray-100 hover:shadow-lg hover:scale-[1.01] transition-all duration-300 ease-in-out overflow-hidden"
              >
                <div className="px-3 py-2 bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 rounded-t-xl">
                  <h2 className="text-sm font-bold text-white truncate">{subject}</h2>
                </div>
                <div className="p-3">
                  {/* Średnia */}
                  <div className="mb-3">
                    <div className="text-[10px] text-gray-500 mb-1 font-medium">Średnia</div>
                    <div className="text-xl font-bold text-blue-600">
                      {subjectGrades.length > 0 ? calculateAverage(subjectGrades) : '-'}
                    </div>
                  </div>
                  
                  {/* Oceny */}
                  <div className="mb-3">
                    <div className="text-[10px] text-gray-500 mb-1.5 font-medium">Oceny</div>
                    <div className="flex flex-wrap gap-1">
                      {subjectGrades.length > 0 ? (
                        subjectGrades.slice(0, 6).map((grade) => {
                          const gradeValue = grade.grade || grade.value || grade.value_grade;
                          return (
                            <div key={grade.id} className={`px-2 py-0.5 rounded text-[10px] font-bold shadow-sm ${getGradeColor(gradeValue)}`}>
                              {gradeValue}
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">Brak ocen</span>
                      )}
                      {subjectGrades.length > 6 && (
                        <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 shadow-sm">
                          +{subjectGrades.length - 6}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Frekwencja per przedmiot */}
                  <div className="pt-2 border-t border-gray-100">
                    <div className="text-[10px] text-gray-500 mb-1 font-medium">Frekwencja</div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-bold text-gray-800">
                        {attendance.percentage}%
                      </div>
                      <div className={`w-1.5 h-1.5 rounded-full ${attendance.percentage >= 90 ? 'bg-green-500' : attendance.percentage >= 75 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {attendance.present}/{attendance.total} obecności
                    </div>
                    <div className="mt-1.5 w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          attendance.percentage >= 90 ? 'bg-green-500' : 
                          attendance.percentage >= 75 ? 'bg-yellow-500' : 
                          'bg-red-500'
                        }`}
                        style={{ width: `${attendance.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {/* Przedmioty fakultatywne - kafelki */}
          {electiveCourses.map(([subject, subjectGrades]) => {
            // Oblicz frekwencję dla tego przedmiotu
            const attendance = calculateAttendanceForSubject(subject, studentId);
            return (
              <div 
                key={`elective-${subject}`} 
                className="bg-white rounded-xl shadow-md border border-gray-100 hover:shadow-lg hover:scale-[1.01] transition-all duration-300 ease-in-out overflow-hidden"
              >
                <div className="px-3 py-2 bg-gradient-to-r from-green-600 via-green-600 to-green-700 rounded-t-xl">
                  <h2 className="text-sm font-bold text-white truncate">{subject}</h2>
                </div>
                <div className="p-3">
                  {/* Średnia */}
                  <div className="mb-3">
                    <div className="text-[10px] text-gray-500 mb-1 font-medium">Średnia</div>
                    <div className="text-xl font-bold text-green-600">
                      {subjectGrades.length > 0 ? calculateAverage(subjectGrades) : '-'}
                    </div>
                  </div>
                  
                  {/* Oceny */}
                  <div className="mb-3">
                    <div className="text-[10px] text-gray-500 mb-1.5 font-medium">Oceny</div>
                    <div className="flex flex-wrap gap-1">
                      {subjectGrades.length > 0 ? (
                        subjectGrades.slice(0, 6).map((grade) => {
                          const gradeValue = grade.grade || grade.value || grade.value_grade;
                          return (
                            <div key={grade.id} className={`px-2 py-0.5 rounded text-[10px] font-bold shadow-sm ${getGradeColor(gradeValue)}`}>
                              {gradeValue}
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">Brak ocen</span>
                      )}
                      {subjectGrades.length > 6 && (
                        <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 shadow-sm">
                          +{subjectGrades.length - 6}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Frekwencja per przedmiot */}
                  <div className="pt-2 border-t border-gray-100">
                    <div className="text-[10px] text-gray-500 mb-1 font-medium">Frekwencja</div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-bold text-gray-800">
                        {attendance.percentage}%
                      </div>
                      <div className={`w-1.5 h-1.5 rounded-full ${attendance.percentage >= 90 ? 'bg-green-500' : attendance.percentage >= 75 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {attendance.present}/{attendance.total} obecności
                    </div>
                    <div className="mt-1.5 w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          attendance.percentage >= 90 ? 'bg-green-500' : 
                          attendance.percentage >= 75 ? 'bg-yellow-500' : 
                          'bg-red-500'
                        }`}
                        style={{ width: `${attendance.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Frekwencja globalna */}
        <div className="w-full mt-6 bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">Frekwencja globalna</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="text-center p-5 sm:p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-3xl sm:text-4xl font-bold text-blue-600 mb-2">{globalAttendance.percentage}%</div>
              <div className="text-sm sm:text-base text-gray-700 font-medium">Ogólna frekwencja</div>
              <div className="mt-3 w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    globalAttendance.percentage >= 90 ? 'bg-green-500' : 
                    globalAttendance.percentage >= 75 ? 'bg-yellow-500' : 
                    'bg-red-500'
                  }`}
                  style={{ width: `${globalAttendance.percentage}%` }}
                ></div>
              </div>
            </div>
            <div className="text-center p-5 sm:p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl border border-green-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-3xl sm:text-4xl font-bold text-green-600 mb-2">{globalAttendance.present}</div>
              <div className="text-sm sm:text-base text-gray-700 font-medium">Obecności</div>
              <div className="mt-3 text-xs text-gray-600">z {globalAttendance.total} zajęć</div>
            </div>
            <div className="text-center p-5 sm:p-6 bg-gradient-to-br from-red-50 to-red-100 rounded-2xl border border-red-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-3xl sm:text-4xl font-bold text-red-600 mb-2">{globalAttendance.total - globalAttendance.present}</div>
              <div className="text-sm sm:text-base text-gray-700 font-medium">Nieobecności</div>
              <div className="mt-3 text-xs text-gray-600">z {globalAttendance.total} zajęć</div>
            </div>
          </div>
        </div>
        
        {/* Stary widok - ukryty dla kompatybilności */}
        <div className="hidden">
          {/* Przedmioty obowiązkowe */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-white/20">
            <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700">
              <h2 className="text-lg sm:text-xl font-bold text-white">Przedmioty obowiązkowe</h2>
            </div>
          
          {/* Dodatkowy odstęp aby tooltip nie był przykrywany */}
          <div className="h-8"></div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Ładowanie ocen...</p>
            </div>
          ) : mandatoryCourses.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <Award className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Brak przedmiotów obowiązkowych</h3>
              <p className="text-gray-600">Nie masz jeszcze żadnych przedmiotów obowiązkowych.</p>
            </div>
          ) : (
            <>
              {/* Desktop: Table */}
              <div className="hidden md:block w-full overflow-x-auto">
                <table className="w-full min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Przedmiot</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Oceny</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Średnia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {mandatoryCourses.map(([subject, subjectGrades]) => (
                      <tr key={subject} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                              <BookOpen className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="font-semibold text-gray-800 text-base">{subject}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {subjectGrades.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {subjectGrades.map((grade) => {
                                const gradeValue = grade.grade || grade.value || grade.value_grade;
                                const gradeDescription = grade.description || grade.comment || '';
                                const gradeDate = grade.date || grade.graded_at || '';
                                const gradeType = grade.gradeType || grade.grade_type || '';
                                
                                return (
                                  <div key={grade.id} className="relative group">
                                    <button
                                      className={`px-3 py-1.5 rounded-lg font-bold text-sm shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md ${getGradeColor(gradeValue)}`}
                                    >
                                      {gradeValue}
                                    </button>
                                    
                                    {/* Tooltip */}
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 min-w-[250px] max-w-[350px]">
                                      <div className="space-y-1">
                                        <div className="font-semibold">Ocena: {gradeValue}</div>
                                        {gradeType && (
                                          <div><span className="font-medium">Typ:</span> {gradeType}</div>
                                        )}
                                        {grade.quiz_title && (
                                          <div><span className="font-medium">Quiz:</span> {grade.quiz_title}</div>
                                        )}
                                        {grade.percentage !== undefined && (
                                          <div><span className="font-medium">Wynik:</span> {grade.percentage}%</div>
                                        )}
                                        {gradeDescription && (
                                          <div><span className="font-medium">Opis:</span> {gradeDescription}</div>
                                        )}
                                        {gradeDate && (
                                          <div><span className="font-medium">Data:</span> {new Date(gradeDate).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '/')}</div>
                                        )}
                                      </div>
                                      {/* Arrow */}
                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Brak ocen w tym przedmiocie</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                            {subjectGrades.length > 0 ? calculateAverage(subjectGrades) : 'Brak ocen'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: Cards */}
              <div className="md:hidden space-y-4 p-4">
                {mandatoryCourses.map(([subject, subjectGrades]) => (
                  <div key={`mandatory-mobile-${subject}`} className="bg-gray-50 rounded-xl p-4 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-800 text-base truncate">{subject}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Średnia: <span className="font-semibold text-blue-600">
                            {subjectGrades.length > 0 ? calculateAverage(subjectGrades) : 'Brak ocen'}
                          </span>
                        </p>
                      </div>
                    </div>
                    
                    {subjectGrades.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-600 mb-2">Oceny:</p>
                        <div className="flex flex-wrap gap-2">
                          {subjectGrades.map((grade) => {
                            const gradeValue = grade.grade || grade.value || grade.value_grade;
                            const gradeDate = grade.date || grade.graded_at || '';
                            const gradeType = grade.gradeType || grade.grade_type || '';
                            
                            return (
                              <div key={grade.id} className="flex flex-col">
                                <button
                                  className={`min-w-[48px] min-h-[48px] px-4 py-2 rounded-lg font-bold text-base shadow-sm ${getGradeColor(gradeValue)}`}
                                >
                                  {gradeValue}
                                </button>
                                {(gradeType || gradeDate) && (
                                  <div className="mt-1 text-[10px] text-gray-600 text-center">
                                    {gradeType && <div className="truncate">{gradeType}</div>}
                                    {gradeDate && <div>{new Date(gradeDate).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}</div>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">Brak ocen w tym przedmiocie</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          </div>

          {/* Przedmioty fakultatywne */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-white/20">
            <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-green-600 to-green-700">
              <h2 className="text-lg sm:text-xl font-bold text-white">Przedmioty fakultatywne</h2>
            </div>
          
          {/* Dodatkowy odstęp aby tooltip nie był przykrywany */}
          <div className="h-8"></div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Ładowanie ocen...</p>
            </div>
          ) : electiveCourses.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <Award className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Brak przedmiotów fakultatywnych</h3>
              <p className="text-gray-600">Nie masz jeszcze żadnych przedmiotów fakultatywnych.</p>
            </div>
          ) : (
            <>
              {/* Desktop: Table */}
              <div className="hidden md:block w-full overflow-x-auto">
                <table className="w-full min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Przedmiot</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Oceny</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Średnia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {electiveCourses.map(([subject, subjectGrades]) => (
                      <tr key={subject} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                              <BookOpen className="w-4 h-4 text-green-600" />
                            </div>
                            <span className="font-semibold text-gray-800 text-base">{subject}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {subjectGrades.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {subjectGrades.map((grade) => {
                                const gradeValue = grade.grade || grade.value || grade.value_grade;
                                const gradeDescription = grade.description || grade.comment || '';
                                const gradeDate = grade.date || grade.graded_at || '';
                                const gradeType = grade.gradeType || grade.grade_type || '';
                                
                                return (
                                  <div key={grade.id} className="relative group">
                                    <button
                                      className={`px-3 py-1.5 rounded-lg font-bold text-sm shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md ${getGradeColor(gradeValue)}`}
                                    >
                                      {gradeValue}
                                    </button>
                                    
                                    {/* Tooltip */}
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 min-w-[250px] max-w-[350px]">
                                      <div className="space-y-1">
                                        <div className="font-semibold">Ocena: {gradeValue}</div>
                                        {gradeType && (
                                          <div><span className="font-medium">Typ:</span> {gradeType}</div>
                                        )}
                                        {grade.quiz_title && (
                                          <div><span className="font-medium">Quiz:</span> {grade.quiz_title}</div>
                                        )}
                                        {grade.percentage !== undefined && (
                                          <div><span className="font-medium">Wynik:</span> {grade.percentage}%</div>
                                        )}
                                        {gradeDescription && (
                                          <div><span className="font-medium">Opis:</span> {gradeDescription}</div>
                                        )}
                                        {gradeDate && (
                                          <div><span className="font-medium">Data:</span> {new Date(gradeDate).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '/')}</div>
                                        )}
                                      </div>
                                      {/* Arrow */}
                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Brak ocen w tym przedmiocie</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                            {subjectGrades.length > 0 ? calculateAverage(subjectGrades) : 'Brak ocen'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: Cards */}
              <div className="md:hidden space-y-4 p-4">
                {electiveCourses.map(([subject, subjectGrades]) => (
                  <div key={`elective-mobile-${subject}`} className="bg-gray-50 rounded-xl p-4 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-800 text-base truncate">{subject}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Średnia: <span className="font-semibold text-green-600">
                            {subjectGrades.length > 0 ? calculateAverage(subjectGrades) : 'Brak ocen'}
                          </span>
                        </p>
                      </div>
                    </div>
                    
                    {subjectGrades.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-600 mb-2">Oceny:</p>
                        <div className="flex flex-wrap gap-2">
                          {subjectGrades.map((grade) => {
                            const gradeValue = grade.grade || grade.value || grade.value_grade;
                            const gradeDate = grade.date || grade.graded_at || '';
                            const gradeType = grade.gradeType || grade.grade_type || '';
                            
                            return (
                              <div key={grade.id} className="flex flex-col">
                                <button
                                  className={`min-w-[48px] min-h-[48px] px-4 py-2 rounded-lg font-bold text-base shadow-sm ${getGradeColor(gradeValue)}`}
                                >
                                  {gradeValue}
                                </button>
                                {(gradeType || gradeDate) && (
                                  <div className="mt-1 text-[10px] text-gray-600 text-center">
                                    {gradeType && <div className="truncate">{gradeType}</div>}
                                    {gradeDate && <div>{new Date(gradeDate).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}</div>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">Brak ocen w tym przedmiocie</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          </div>
        </div>
      </div>

    </div>
  );
}
