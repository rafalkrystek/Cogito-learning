'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/config/firebase';
import { collection, getDocs, doc, query, where } from 'firebase/firestore';
import ThemeToggle from '@/components/ThemeToggle';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { measureAsync } from '@/utils/perf';

interface ParentStudent {
  id: string;
  parent: string;
  student: string;
  student_name: string;
  student_email: string;
  created_at: string;
}

interface User {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  role: string;
}

export default function ParentStudentManagement() {
  const [parentStudents, setParentStudents] = useState<ParentStudent[]>([]);
  const [parents, setParents] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [selectedParent, setSelectedParent] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [parentSearch, setParentSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [assignmentsPage, setAssignmentsPage] = useState(1);
  const assignmentsPerPage = 20;

  // Cache helpers - memoized to avoid recreating on every render
  const CACHE_TTL_MS = 60 * 1000; // 60s
  const getSessionCache = useCallback(<T,>(key: string): T | null => {
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
  }, [CACHE_TTL_MS]);

  const setSessionCache = useCallback(<T,>(key: string, data: T) => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
    } catch {
      // Ignore cache errors
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Sprawdź cache dla rodziców i uczniów
      const cacheKeyParents = 'superadmin_parents';
      const cacheKeyStudents = 'superadmin_students';
      const cachedParents = getSessionCache<User[]>(cacheKeyParents);
      const cachedStudents = getSessionCache<User[]>(cacheKeyStudents);

      let parentsData: User[];
      let studentsData: User[];

      if (cachedParents && cachedStudents) {
        parentsData = cachedParents;
        studentsData = cachedStudents;
      } else {
        // Pobierz tylko rodziców i tylko uczniów – bez ciągnięcia całej kolekcji users
        const usersRef = collection(db, 'users');

        const [parentsSnapshot, studentsSnapshot] = await Promise.all([
          getDocs(query(usersRef, where('role', '==', 'parent'))),
          getDocs(query(usersRef, where('role', '==', 'student'))),
        ]);

        parentsData = parentsSnapshot.docs.map(
          (snap) => {
            const data = snap.data();
            return { 
              id: snap.id, 
              ...data,
              // Upewnij się, że mamy username jako fallback
              username: data.username || data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email || 'Nieznany użytkownik'
            } as User;
          }
        );
        studentsData = studentsSnapshot.docs.map(
          (snap) => {
            const data = snap.data();
            return { 
              id: snap.id, 
              ...data,
              // Upewnij się, że mamy username jako fallback
              username: data.username || data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email || 'Nieznany użytkownik'
            } as User;
          }
        );

        setSessionCache(cacheKeyParents, parentsData);
        setSessionCache(cacheKeyStudents, studentsData);
      }

      setParents(parentsData);
      setStudents(studentsData);

      // Relacje rodzic–uczeń (nie cache'ujemy, bo mogą się często zmieniać)
      const relationshipsCollection = collection(db, 'parent_students');
      const relationshipsSnapshot = await getDocs(relationshipsCollection);
      const relationshipsData = relationshipsSnapshot.docs.map((snap) => {
        const data = snap.data();
        const timestamp = data.created_at as { toDate?: () => Date } | undefined;
        return {
          id: snap.id,
          ...data,
          created_at: timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
        } as ParentStudent;
      });

      setParentStudents(relationshipsData);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Błąd podczas pobierania danych');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  }, [getSessionCache, setSessionCache]);

  useEffect(() => {
    measureAsync('SuperadminParentStudent:fetchData', fetchData).catch(() => {
      // błędy już zalogowane w fetchData
    });
  }, [fetchData]);

  // Helper function to get display name
  const getDisplayName = useCallback((user: User | undefined): string => {
    if (!user) return '';
    return user.username || user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Nieznany użytkownik';
  }, []);

  // Memoized filter functions for search
  const filteredParents = useMemo(() => {
    if (!parentSearch.trim()) return parents;
    const searchLower = parentSearch.toLowerCase();
    return parents.filter(parent => {
      const displayName = getDisplayName(parent);
      return displayName.toLowerCase().includes(searchLower) ||
        parent.email?.toLowerCase().includes(searchLower) ||
        parent.firstName?.toLowerCase().includes(searchLower) ||
        parent.lastName?.toLowerCase().includes(searchLower);
    });
  }, [parents, parentSearch, getDisplayName]);

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const searchLower = studentSearch.toLowerCase();
    return students.filter(student => {
      const displayName = getDisplayName(student);
      return displayName.toLowerCase().includes(searchLower) ||
        student.email?.toLowerCase().includes(searchLower) ||
        student.firstName?.toLowerCase().includes(searchLower) ||
        student.lastName?.toLowerCase().includes(searchLower);
    });
  }, [students, studentSearch, getDisplayName]);

  // Memoized helper functions with Map for O(1) lookup
  // Używamy zarówno ID dokumentu jak i UID z danych (jeśli istnieje)
  const parentsMap = useMemo(() => {
    const map = new Map<string, User>();
    parents.forEach(p => {
      map.set(p.id, p);
      // Jeśli dokument ma pole uid, dodaj również pod tym kluczem
      const uid = (p as any).uid;
      if (uid && uid !== p.id) {
        map.set(uid, p);
      }
    });
    return map;
  }, [parents]);

  const studentsMap = useMemo(() => {
    const map = new Map<string, User>();
    students.forEach(s => {
      map.set(s.id, s);
      // Jeśli dokument ma pole uid, dodaj również pod tym kluczem
      const uid = (s as any).uid;
      if (uid && uid !== s.id) {
        map.set(uid, s);
      }
    });
    return map;
  }, [students]);

  const getParentById = useCallback((parentId: string) => {
    // Najpierw spróbuj znaleźć po ID/UID
    let parent = parentsMap.get(parentId);
    if (parent) return parent;
    
    // Jeśli nie znaleziono, spróbuj znaleźć po emailu (jeśli parentId to email)
    if (parentId.includes('@')) {
      parent = parents.find(p => p.email === parentId);
      if (parent) return parent;
    }
    
    return undefined;
  }, [parentsMap, parents]);

  const getStudentById = useCallback((studentId: string) => {
    // Najpierw spróbuj znaleźć po ID/UID
    let student = studentsMap.get(studentId);
    if (student) return student;
    
    // Jeśli nie znaleziono, spróbuj znaleźć po emailu (jeśli studentId to email)
    if (studentId.includes('@')) {
      student = students.find(s => s.email === studentId);
      if (student) return student;
    }
    
    return undefined;
  }, [studentsMap, students]);

  // Paginated assignments for lazy loading
  const paginatedAssignments = useMemo(() => {
    const startIndex = (assignmentsPage - 1) * assignmentsPerPage;
    const endIndex = startIndex + assignmentsPerPage;
    return parentStudents.slice(startIndex, endIndex);
  }, [parentStudents, assignmentsPage]);

  const totalAssignmentsPages = Math.ceil(parentStudents.length / assignmentsPerPage);

  const handleAssign = async () => {
    if (!selectedParent || !selectedStudent) {
      setError('Wybierz rodzica i ucznia');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      // Check if relationship already exists
      const relationshipsCollection = collection(db, 'parent_students');
      const q = query(
        relationshipsCollection,
        where('parent', '==', selectedParent),
        where('student', '==', selectedStudent)
      );
      const existingSnapshot = await getDocs(q);

      if (!existingSnapshot.empty) {
        setError('Ta relacja już istnieje');
        setTimeout(() => setError(''), 3000);
        return;
      }

      // Create new relationship
      const { addDoc } = await import('firebase/firestore');
      await addDoc(relationshipsCollection, {
        parent: selectedParent,
        student: selectedStudent,
        created_at: new Date()
      });

      setSuccess('Pomyślnie przypisano ucznia do rodzica');
      setTimeout(() => setSuccess(''), 3000);
      // Invalidate cache and refetch
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('superadmin_parents');
        sessionStorage.removeItem('superadmin_students');
      }
      fetchData();
      setSelectedParent(null);
      setSelectedStudent(null);
      setParentSearch('');
      setStudentSearch('');
    } catch (err) {
      console.error('Error assigning student to parent:', err);
      setError('Błąd podczas przypisywania ucznia do rodzica');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'parent_students', id));

      setSuccess('Pomyślnie usunięto przypisanie');
      setTimeout(() => setSuccess(''), 3000);
      // Invalidate cache and refetch
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('superadmin_parents');
        sessionStorage.removeItem('superadmin_students');
      }
      fetchData();
    } catch (err) {
      console.error('Error removing parent-student relationship:', err);
      setError('Błąd podczas usuwania przypisania');
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Header z przyciskiem powrotu - Responsywny */}
      <div className="bg-white/90 backdrop-blur-lg border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Lewa strona - Logo i przycisk powrotu */}
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <Link
                href="/homelogin/superadmin"
                className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium flex-shrink-0"
                aria-label="Powrót do panelu superadministratora"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Powrót</span>
              </Link>
              
              <div className="flex items-center gap-2 min-w-0">
                <Image src="/puzzleicon.png" alt="Logo" width={28} height={28} className="flex-shrink-0 brightness-0 dark:brightness-100" />
                <span className="text-lg sm:text-xl font-bold text-[#4067EC] truncate">COGITO</span>
              </div>
            </div>

            {/* Prawa strona - Theme toggle */}
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <div className="relative">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-[1920px] mx-auto p-4 sm:p-6 lg:p-8 box-border">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 sm:mb-4 text-gray-900">Zarządzanie Przypisaniami Rodzic-Uczeń</h1>
          <p className="text-sm sm:text-base text-gray-600">Przypisuj uczniów do rodziców i zarządzaj istniejącymi relacjami</p>
        </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
              <span className="text-white font-bold text-sm">👨‍🎓</span>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-600">Uczniowie</p>
              <p className="text-2xl font-bold text-blue-900">{students.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
              <span className="text-white font-bold text-sm">👨‍👩‍👧‍👦</span>
            </div>
            <div>
              <p className="text-sm font-medium text-green-600">Rodzice</p>
              <p className="text-2xl font-bold text-green-900">{parents.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center mr-3">
              <span className="text-white font-bold text-sm">🔗</span>
            </div>
            <div>
              <p className="text-sm font-medium text-purple-600">Przypisania</p>
              <p className="text-2xl font-bold text-purple-900">{parentStudents.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center mr-3">
              <span className="text-white font-bold text-sm">📊</span>
            </div>
            <div>
              <p className="text-sm font-medium text-orange-600">Pokrycie</p>
              <p className="text-2xl font-bold text-orange-900">
                {students.length > 0 ? Math.round((parentStudents.length / students.length) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      {/* Assignment Form */}
      <div className="bg-white shadow-lg rounded-lg px-8 pt-6 pb-8 mb-6">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Przypisz Ucznia do Rodzica</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Parent Selection */}
          <div className="space-y-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Wybierz Rodzica
            </label>
            
            {/* Parent Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Wyszukaj rodzica po nazwie lub emailu..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={parentSearch}
                onChange={(e) => setParentSearch(e.target.value)}
              />
              {parentSearch && (
                <button
                  onClick={() => setParentSearch('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              )}
            </div>

            {/* Parent Select - Lazy loaded options (max 100 visible) */}
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={selectedParent || ''}
              onChange={(e) => setSelectedParent(e.target.value || null)}
            >
              <option value="">Wybierz rodzica...</option>
              {filteredParents.slice(0, 100).map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {getDisplayName(parent)} ({parent.email})
                </option>
              ))}
              {filteredParents.length > 100 && (
                <option disabled>... i {filteredParents.length - 100} więcej (użyj wyszukiwarki)</option>
              )}
            </select>
            
            {parentSearch && filteredParents.length === 0 && (
              <p className="text-sm text-gray-500">Nie znaleziono rodziców pasujących do wyszukiwania</p>
            )}
          </div>

          {/* Student Selection */}
          <div className="space-y-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Wybierz Ucznia
            </label>
            
            {/* Student Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Wyszukaj ucznia po nazwie lub emailu..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
              {studentSearch && (
                <button
                  onClick={() => setStudentSearch('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              )}
            </div>

            {/* Student Select - Lazy loaded options (max 100 visible) */}
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={selectedStudent || ''}
              onChange={(e) => setSelectedStudent(e.target.value || null)}
            >
              <option value="">Wybierz ucznia...</option>
              {filteredStudents.slice(0, 100).map((student) => (
                <option key={student.id} value={student.id}>
                  {getDisplayName(student)} ({student.email})
                </option>
              ))}
              {filteredStudents.length > 100 && (
                <option disabled>... i {filteredStudents.length - 100} więcej (użyj wyszukiwarki)</option>
              )}
            </select>
            
            {studentSearch && filteredStudents.length === 0 && (
              <p className="text-sm text-gray-500">Nie znaleziono uczniów pasujących do wyszukiwania</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-4">
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
            onClick={handleAssign}
            disabled={!selectedParent || !selectedStudent}
          >
            Przypisz Ucznia do Rodzica
          </button>
          
          <button
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
            onClick={() => {
              setSelectedParent(null);
              setSelectedStudent(null);
              setParentSearch('');
              setStudentSearch('');
            }}
          >
            Wyczyść Formularz
          </button>
        </div>
      </div>

      {/* Existing Assignments Table */}
      <div className="bg-white shadow-lg rounded-lg px-8 pt-6 pb-8">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Istniejące Przypisania Rodzic-Uczeń</h2>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-3 text-gray-600">Ładowanie przypisań...</p>
          </div>
        ) : parentStudents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-lg">Brak przypisanych relacji rodzic-uczeń</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full leading-normal">
                <thead>
                  <tr>
                    <th className="px-6 py-4 border-b-2 border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Uczeń
                    </th>
                    <th className="px-6 py-4 border-b-2 border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Email Ucznia
                    </th>
                    <th className="px-6 py-4 border-b-2 border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Przypisany Rodzic
                    </th>
                    <th className="px-6 py-4 border-b-2 border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Email Rodzica
                    </th>
                    <th className="px-6 py-4 border-b-2 border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Data Utworzenia
                    </th>
                    <th className="px-6 py-4 border-b-2 border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Akcje
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAssignments.map((ps) => {
                    const student = getStudentById(ps.student);
                    const parent = getParentById(ps.parent);
                    const studentName = getDisplayName(student);
                    const parentName = getDisplayName(parent);
                    return (
                      <tr key={ps.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 border-b border-gray-200 bg-white text-sm">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                              <span className="text-blue-600 font-semibold text-xs">
                                {studentName.charAt(0)?.toUpperCase() || '?'}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{studentName || 'Nieznany uczeń'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200 bg-white text-sm text-gray-600">
                          {student?.email || ps.student_email || 'Brak emaila'}
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200 bg-white text-sm">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                              <span className="text-green-600 font-semibold text-xs">
                                {parentName.charAt(0)?.toUpperCase() || '?'}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{parentName || 'Nieznany rodzic'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200 bg-white text-sm text-gray-600">
                          {parent?.email || 'Brak emaila'}
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200 bg-white text-sm text-gray-600">
                          {new Date(ps.created_at).toLocaleDateString('pl-PL', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200 bg-white text-sm">
                          <button
                            onClick={() => handleRemove(ps.id)}
                            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                          >
                            Usuń Przypisanie
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Pagination for assignments */}
            {totalAssignmentsPages > 1 && (
              <div className="mt-6 flex justify-center items-center gap-2">
                <button
                  onClick={() => setAssignmentsPage(p => Math.max(1, p - 1))}
                  disabled={assignmentsPage <= 1}
                  className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Poprzednia
                </button>
                
                <span className="px-4 py-2 text-sm text-gray-700">
                  Strona {assignmentsPage} z {totalAssignmentsPages} ({parentStudents.length} przypisań)
                </span>
                
                <button
                  onClick={() => setAssignmentsPage(p => Math.min(totalAssignmentsPages, p + 1))}
                  disabled={assignmentsPage >= totalAssignmentsPages}
                  className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Następna
                </button>
              </div>
            )}
          </>
        )}
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Łącznie {parentStudents.length} przypisań rodzic-uczeń
          </p>
        </div>
      </div>
    </div>
    </div>
  );
}

