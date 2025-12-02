'use client';

import { useState, useEffect } from 'react';
import { db } from '@/config/firebase';
import { collection, getDocs, doc, query, where } from 'firebase/firestore';
import ThemeToggle from '@/components/ThemeToggle';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';

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
  username: string;
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch all users from Firestore
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];

      // Filter parents and students
      setParents(usersData.filter(u => u.role === 'parent'));
      setStudents(usersData.filter(u => u.role === 'student'));

      // Fetch parent-student relationships
      const relationshipsCollection = collection(db, 'parent_students');
      const relationshipsSnapshot = await getDocs(relationshipsCollection);
      const relationshipsData = relationshipsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate().toISOString() || new Date().toISOString()
      })) as ParentStudent[];

      setParentStudents(relationshipsData);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Błąd podczas pobierania danych');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Filter functions for search
  const filteredParents = parents.filter(parent => 
    parent.username?.toLowerCase().includes(parentSearch.toLowerCase()) ||
    parent.email?.toLowerCase().includes(parentSearch.toLowerCase())
  );

  const filteredStudents = students.filter(student => 
    student.username?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    student.email?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  // Helper function to get parent info by ID
  const getParentById = (parentId: string) => {
    return parents.find(p => p.id === parentId);
  };

  // Helper function to get student info by ID
  const getStudentById = (studentId: string) => {
    return students.find(s => s.id === studentId);
  };

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
      fetchData();
    } catch (err) {
      console.error('Error removing parent-student relationship:', err);
      setError('Błąd podczas usuwania przypisania');
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full overflow-x-hidden">
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
                Powrót
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

            {/* Parent Select */}
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={selectedParent || ''}
              onChange={(e) => setSelectedParent(e.target.value || null)}
            >
              <option value="">Wybierz rodzica...</option>
              {filteredParents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.username} ({parent.email})
                </option>
              ))}
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

            {/* Student Select */}
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={selectedStudent || ''}
              onChange={(e) => setSelectedStudent(e.target.value || null)}
            >
              <option value="">Wybierz ucznia...</option>
              {filteredStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.username} ({student.email})
                </option>
              ))}
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
        
        {parentStudents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-lg">Brak przypisanych relacji rodzic-uczeń</p>
          </div>
        ) : (
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
                {parentStudents.map((ps) => {
                  const student = getStudentById(ps.student);
                  const parent = getParentById(ps.parent);
                  return (
                    <tr key={ps.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 border-b border-gray-200 bg-white text-sm">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blue-600 font-semibold text-xs">
                              {student?.username?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{student?.username || 'Nieznany uczeń'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200 bg-white text-sm text-gray-600">
                        {student?.email || 'Brak emaila'}
                      </td>
                      <td className="px-6 py-4 border-b border-gray-200 bg-white text-sm">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-green-600 font-semibold text-xs">
                              {parent?.username?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{parent?.username || 'Nieznany rodzic'}</p>
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

