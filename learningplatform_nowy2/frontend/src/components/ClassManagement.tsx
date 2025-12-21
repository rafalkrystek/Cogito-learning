"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Class, Course } from '../types/models';
import { db } from '../config/firebase';
import { collection, getDocs, addDoc, updateDoc, doc, arrayUnion } from 'firebase/firestore';

interface ClassManagementProps {
  onClose: () => void;
}

export default function ClassManagement({ onClose }: ClassManagementProps) {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'classes' | 'assignments'>('classes');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Form states
  const [newClass, setNewClass] = useState({
    name: '',
    description: '',
    grade_level: 1,
    subject: '',
    max_students: 30,
    academic_year: '2024/2025'
  });
  
  const [assignmentData, setAssignmentData] = useState({
    course_id: '',
    class_id: '',
    student_email: ''
  });

  // Show message function
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const loadClasses = useCallback(async () => {
    try {
      setLoading(true);
      const classesRef = collection(db, 'classes');
      const snapshot = await getDocs(classesRef);
      const classesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Class[];
      
      // Filtruj klasy w zależności od roli użytkownika
      if (user?.role === 'admin') {
        setClasses(classesData.filter(c => c.is_active));
      } else if (user?.role === 'teacher') {
        // Nauczyciele widzą wszystkie klasy (wszyscy nauczyciele mogą widzieć wszystkie klasy)
        setClasses(classesData.filter(c => c.is_active));
      } else {
        setClasses(classesData.filter(c => c.students?.includes(user?.uid || '') && c.is_active));
      }
    } catch (error) {
      console.error('Error loading classes:', error);
      showMessage('error', 'Błąd podczas ładowania klas');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadCourses = useCallback(async () => {
    try {
      const coursesRef = collection(db, 'courses');
      const snapshot = await getDocs(coursesRef);
      const coursesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Course[];
      
      setCourses(coursesData.filter(c => c.is_active));
    } catch (error) {
      console.error('Error loading courses:', error);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadClasses();
      loadCourses();
    }
  }, [user, loadClasses, loadCourses]);

  const createClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setLoading(true);
      const classData = {
        ...newClass,
        teacher_id: user.uid,
        teacher_email: user.email,
        students: [],
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
        metadata: {}
      };

      await addDoc(collection(db, 'classes'), classData);
      
      showMessage('success', 'Klasa została utworzona pomyślnie!');
      setNewClass({
        name: '',
        description: '',
        grade_level: 1,
        subject: '',
        max_students: 30,
        academic_year: '2024/2025'
      });
      loadClasses();
    } catch (error) {
      console.error('Error creating class:', error);
      showMessage('error', 'Błąd podczas tworzenia klasy');
    } finally {
      setLoading(false);
    }
  };

  const assignCourseToClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentData.course_id || !assignmentData.class_id) {
      showMessage('error', 'Wybierz kurs i klasę');
      return;
    }

    try {
      setLoading(true);
      
      // Zaktualizuj kurs - dodaj klasę
      const courseRef = doc(db, 'courses', assignmentData.course_id);
      await updateDoc(courseRef, {
        assignedClasses: arrayUnion(assignmentData.class_id)
      });

      // Zaktualizuj klasę - dodaj kurs
      const classRef = doc(db, 'classes', assignmentData.class_id);
      await updateDoc(classRef, {
        assignedCourses: arrayUnion(assignmentData.course_id)
      });

      // 🆕 NOWE - Automatycznie dodaj wszystkich studentów z klasy do kursu
      const selectedClass = classes.find(c => c.id === assignmentData.class_id);
      if (selectedClass && selectedClass.students && selectedClass.students.length > 0) {
        await updateDoc(courseRef, {
          assignedUsers: arrayUnion(...selectedClass.students)
        });
      }

      showMessage('success', 'Kurs został przypisany do klasy i studenci zostali automatycznie dodani!');
      setAssignmentData({ course_id: '', class_id: '', student_email: '' });
      loadClasses();
    } catch (error) {
      console.error('Error assigning course to class:', error);
      showMessage('error', 'Błąd podczas przypisywania kursu');
    } finally {
      setLoading(false);
    }
  };

  const addStudentToClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentData.class_id || !assignmentData.student_email) {
      showMessage('error', 'Wybierz klasę i podaj email studenta');
      return;
    }

    try {
      setLoading(true);
      
      // Znajdź studenta po email
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const userDoc = snapshot.docs.find(doc => doc.data().email === assignmentData.student_email);
      
      if (!userDoc) {
        showMessage('error', 'Student o podanym email nie został znaleziony');
        return;
      }

      // Dodaj studenta do klasy
      const classRef = doc(db, 'classes', assignmentData.class_id);
      await updateDoc(classRef, {
        students: arrayUnion(userDoc.id)
      });

      // 🆕 NOWE - Dodaj klasę do profilu studenta
      const userRef = doc(db, 'users', userDoc.id);
      await updateDoc(userRef, {
        classes: arrayUnion(assignmentData.class_id)
      });

      // 🆕 NOWE - Automatycznie dodaj studenta do wszystkich kursów przypisanych do klasy
      const selectedClass = classes.find(c => c.id === assignmentData.class_id);
      if (selectedClass && selectedClass.assignedCourses && selectedClass.assignedCourses.length > 0) {
        for (const courseId of selectedClass.assignedCourses) {
          const courseRef = doc(db, 'courses', courseId);
          await updateDoc(courseRef, {
            assignedUsers: arrayUnion(userDoc.id)
          });
        }
      }

      showMessage('success', 'Student został dodany do klasy i automatycznie przypisany do kursów!');
      setAssignmentData({ course_id: '', class_id: '', student_email: '' });
      loadClasses();
    } catch (error) {
      console.error('Error adding student to class:', error);
      showMessage('error', 'Błąd podczas dodawania studenta');
    } finally {
      setLoading(false);
    }
  };

  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return (
      <div className="fixed inset-0 bg-transparent backdrop-blur-xl flex items-center justify-center z-50">
        <div className="bg-white/20 backdrop-blur-2xl border border-white/30 rounded-lg p-6 max-w-md w-full mx-4">
          <h2 className="text-xl font-bold mb-4">Brak uprawnień</h2>
          <p className="text-gray-600 mb-4">
            Tylko nauczyciele i administratorzy mogą zarządzać klasami.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
          >
            Zamknij
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-transparent backdrop-blur-xl flex items-center justify-center z-50">
      <div className="bg-white/20 backdrop-blur-2xl border border-white/30 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Zarządzanie Klasami</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-4 p-3 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b mb-6">
          <button
            onClick={() => setActiveTab('classes')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'classes'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Klasy
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'assignments'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Przypisania
          </button>
        </div>

        {activeTab === 'classes' && (
          <div className="space-y-6">
            {/* Create Class Form */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Utwórz nową klasę</h3>
              <form onSubmit={createClass} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Nazwa klasy"
                  value={newClass.name}
                  onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                  className="border rounded-lg px-3 py-2"
                  required
                />
                <input
                  type="text"
                  placeholder="Opis (opcjonalnie)"
                  value={newClass.description}
                  onChange={(e) => setNewClass({ ...newClass, description: e.target.value })}
                  className="border rounded-lg px-3 py-2"
                />
                <select
                  value={newClass.grade_level}
                  onChange={(e) => setNewClass({ ...newClass, grade_level: parseInt(e.target.value) })}
                  className="border rounded-lg px-3 py-2"
                  required
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(grade => (
                    <option key={grade} value={grade}>Klasa {grade}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Przedmiot (opcjonalnie)"
                  value={newClass.subject}
                  onChange={(e) => setNewClass({ ...newClass, subject: e.target.value })}
                  className="border rounded-lg px-3 py-2"
                />
                <input
                  type="number"
                  placeholder="Maksymalna liczba studentów"
                  value={newClass.max_students}
                  onChange={(e) => setNewClass({ ...newClass, max_students: parseInt(e.target.value) })}
                  className="border rounded-lg px-3 py-2"
                  min="1"
                  max="50"
                />
                <input
                  type="text"
                  placeholder="Rok akademicki"
                  value={newClass.academic_year}
                  onChange={(e) => setNewClass({ ...newClass, academic_year: e.target.value })}
                  className="border rounded-lg px-3 py-2"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="md:col-span-2 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Tworzenie...' : 'Utwórz klasę'}
                </button>
              </form>
            </div>

            {/* Classes List */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Twoje klasy</h3>
              {loading ? (
                <div className="text-center py-8">Ładowanie...</div>
              ) : classes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Brak klas</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classes.map((cls) => (
                    <div key={cls.id} className="border rounded-lg p-4">
                      <h4 className="font-semibold text-lg">{cls.name}</h4>
                      <p className="text-gray-600 text-sm mb-2">{cls.description}</p>
                      <div className="text-sm text-gray-500 space-y-1">
                        <p>Klasa {cls.grade_level}</p>
                        {cls.subject && <p>Przedmiot: {cls.subject}</p>}
                        <p>Studentów: {cls.students?.length || 0}/{cls.max_students}</p>
                        <p>Rok: {cls.academic_year}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'assignments' && (
          <div className="space-y-6">
            {/* Assign Course to Class */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Przypisz kurs do klasy</h3>
              <form onSubmit={assignCourseToClass} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  value={assignmentData.course_id}
                  onChange={(e) => setAssignmentData({ ...assignmentData, course_id: e.target.value })}
                  className="border rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Wybierz kurs</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title} - {course.subject}
                    </option>
                  ))}
                </select>
                <select
                  value={assignmentData.class_id}
                  onChange={(e) => setAssignmentData({ ...assignmentData, class_id: e.target.value })}
                  className="border rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Wybierz klasę</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} - Klasa {cls.grade_level}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={loading}
                  className="md:col-span-2 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Przypisywanie...' : 'Przypisz kurs do klasy'}
                </button>
              </form>
            </div>

            {/* Add Student to Class */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Dodaj studenta do klasy</h3>
              <form onSubmit={addStudentToClass} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  value={assignmentData.class_id}
                  onChange={(e) => setAssignmentData({ ...assignmentData, class_id: e.target.value })}
                  className="border rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Wybierz klasę</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} - Klasa {cls.grade_level}
                    </option>
                  ))}
                </select>
                <input
                  type="email"
                  placeholder="Email studenta"
                  value={assignmentData.student_email}
                  onChange={(e) => setAssignmentData({ ...assignmentData, student_email: e.target.value })}
                  className="border rounded-lg px-3 py-2"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="md:col-span-2 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {loading ? 'Dodawanie...' : 'Dodaj studenta do klasy'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
