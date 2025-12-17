"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import Providers from '@/components/Providers';
import { db } from '@/config/firebase';
import { collection, getDocs, doc, updateDoc, getDoc, query, where, limit } from 'firebase/firestore';
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
    // Ignore storage errors
  }
}

interface Course {
  id: string;
  title: string;
  teacherEmail?: string;
}

interface Student {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role?: string;
}

function StudentAssignmentsWrapper() {
  return (
    <ProtectedRoute>
      <StudentAssignmentsContent />
    </ProtectedRoute>
  );
}

export default function StudentAssignments() {
  return (
    <Providers>
      <StudentAssignmentsWrapper />
    </Providers>
  );
}

function StudentAssignmentsContent() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [assignSuccess, setAssignSuccess] = useState("");
  const [assignError, setAssignError] = useState("");
  const [loading, setLoading] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");

  // Fetch data with caching and optimization
  const fetchData = useCallback(async () => {
    if (!user?.email) return;

    try {
      await measureAsync('TeacherAssignments:fetchData', async () => {
        // Check cache for courses
        const coursesCacheKey = `teacher_assignments_courses_${user.email}`;
        const cachedCourses = getSessionCache<Course[]>(coursesCacheKey);
        
        if (cachedCourses) {
          setCourses(cachedCourses);
        } else {
          // Fetch courses with where clause (optimized)
          const coursesQuery = query(
            collection(db, 'courses'),
            where('teacherEmail', '==', user.email),
            limit(100)
          );
          const coursesSnapshot = await getDocs(coursesQuery);
          const coursesData = coursesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Course));
          setCourses(coursesData);
          setSessionCache(coursesCacheKey, coursesData);
        }

        // Check cache for students
        const studentsCacheKey = 'teacher_assignments_students';
        const cachedStudents = getSessionCache<Student[]>(studentsCacheKey);
        
        if (cachedStudents) {
          setStudents(cachedStudents);
        } else {
          // Fetch students with where clause (optimized)
          const studentsQuery = query(
            collection(db, 'users'),
            where('role', '==', 'student'),
            limit(500) // Limit to prevent huge queries
          );
          const studentsSnapshot = await getDocs(studentsQuery);
          const studentsData = studentsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Student));
          setStudents(studentsData);
          setSessionCache(studentsCacheKey, studentsData);
        }
      });
    } catch (err) {
      console.error('Error fetching data:', err);
      setAssignError('Failed to load data');
    }
  }, [user?.email]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Memoized filtered students for select (lazy loading - max 100 visible)
  const filteredStudents = useMemo(() => {
    let filtered = students;
    
    if (studentSearchTerm) {
      const searchLower = studentSearchTerm.toLowerCase();
      filtered = students.filter(s => 
        s.email.toLowerCase().includes(searchLower) ||
        (s.firstName && s.firstName.toLowerCase().includes(searchLower)) ||
        (s.lastName && s.lastName.toLowerCase().includes(searchLower))
      );
    }
    
    // Limit to 100 for select performance
    return filtered.slice(0, 100);
  }, [students, studentSearchTerm]);

  const handleAssign = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignSuccess("");
    setAssignError("");
    setLoading(true);

    try {
      if (!selectedCourse || !selectedStudent) {
        throw new Error("Nie wybrano kursu lub studenta");
      }

      await measureAsync('TeacherAssignments:handleAssign', async () => {
        // Pobierz kurs z Firestore
        const courseDoc = await getDoc(doc(db, "courses", selectedCourse));
        
        if (!courseDoc.exists()) {
          throw new Error("Kurs nie został znaleziony");
        }
        
        const courseData = courseDoc.data();
        const assignedUsers = courseData.assignedUsers || [];
        
        // Znajdź studenta po ID
        const student = students.find(s => s.id === selectedStudent);
        if (!student) {
          throw new Error("Student nie został znaleziony");
        }
        
        // Sprawdź czy student już jest przypisany
        if (assignedUsers.includes(student.email)) {
          throw new Error("Student jest już przypisany do tego kursu");
        }
        
        // Dodaj studenta do listy przypisanych użytkowników
        assignedUsers.push(student.email);
        
        // Zaktualizuj kurs w Firestore
        await updateDoc(doc(db, "courses", selectedCourse), {
          assignedUsers: assignedUsers
        });
        
        // Invalidate cache
        if (user?.email) {
          sessionStorage.removeItem(`teacher_assignments_courses_${user.email}`);
        }
      });
      
      setAssignSuccess("Student successfully assigned to course!");
      setSelectedCourse("");
      setSelectedStudent("");
      // Refresh courses
      fetchData();
    } catch (err) {
      if (err instanceof Error) {
        setAssignError(err.message);
      } else {
        setAssignError("Network or server error.");
      }
    }
    setLoading(false);
  }, [selectedCourse, selectedStudent, students, user?.email, fetchData]);

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full max-w-full overflow-hidden flex flex-col" style={{ maxWidth: '100vw' }}>
      {/* Header z przyciskiem powrotu - Fixed */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <button
            onClick={() => window.location.href = '/homelogin'}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Powrót</span>
          </button>

          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Przypisz kurs uczniowi
          </h1>

          <div className="w-20"></div>
        </div>
      </div>

      {/* Content - Scrollable */}
      <main className="flex-1 overflow-y-auto px-4 py-8 min-h-0">
        <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-[#4067EC] mb-4">Przypisz kurs uczniowi</h2>
        <p className="mb-6 text-gray-700">Wybierz kurs i ucznia, aby przypisać ucznia do wybranego kursu.</p>
        <form onSubmit={handleAssign} className="bg-white rounded-lg shadow p-8 space-y-6">
          {assignSuccess && (
            <div className="bg-green-100 text-green-700 px-4 py-2 rounded">
              {assignSuccess}
            </div>
          )}
          {assignError && (
            <div className="bg-red-100 text-red-700 px-4 py-2 rounded">
              {assignError}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wybierz kurs
            </label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#4067EC]"
              value={selectedCourse}
              onChange={e => setSelectedCourse(e.target.value)}
              required
            >
              <option value="">-- wybierz kurs --</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wybierz ucznia {students.length > 100 && `(${filteredStudents.length} z ${students.length} widocznych)`}
            </label>
            {students.length > 100 && (
              <input
                type="text"
                placeholder="Szukaj ucznia..."
                value={studentSearchTerm}
                onChange={e => setStudentSearchTerm(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-[#4067EC]"
              />
            )}
            <select
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#4067EC]"
              value={selectedStudent}
              onChange={e => setSelectedStudent(e.target.value)}
              required
            >
              <option value="">-- wybierz ucznia --</option>
              {filteredStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.firstName && student.lastName ? `${student.firstName} ${student.lastName}` : student.email} ({student.email})
                </option>
              ))}
            </select>
            {students.length > 100 && filteredStudents.length === 100 && (
              <p className="text-xs text-gray-500 mt-1">
                Użyj wyszukiwania, aby znaleźć więcej studentów
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-[#4067EC] text-white py-2 rounded hover:bg-[#3155d4] transition focus:outline-none focus:ring-2 focus:ring-[#4067EC] focus:ring-offset-2"
            disabled={loading}
          >
            {loading ? "Przypisywanie..." : "Przypisz ucznia"}
          </button>
        </form>
        </div>
      </main>
    </div>
  );
} 