'use client';
import React, { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';

interface Student {
  uid: string;
  displayName: string;
  role?: string;
  assignedToTeacher?: string;
}

const SUBJECTS = [
  'Matematyka',
  'Język polski',
  'Język angielski',
  'Fizyka',
  'Chemia',
  'Biologia',
  'Historia',
  'Geografia',
  'Informatyka',
  'Wychowanie fizyczne',
];

const GRADE_TYPES = [
  { value: '', label: '-- wybierz typ --' },
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

const GradeForm: React.FC<{ onGradeAdded?: () => void }> = ({ onGradeAdded }) => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState('');
  const [subject, setSubject] = useState('Matematyka');
  const [grade, setGrade] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [gradeType, setGradeType] = useState('');

  useEffect(() => {
    const fetchStudents = async () => {
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      const studentsList = usersSnapshot.docs
        .map(doc => ({ uid: doc.id, ...(doc.data() as Record<string, unknown>) } as Student))
        .filter(student => student?.role === 'student' && student?.assignedToTeacher === user?.uid);
      setStudents(studentsList);
    };
    fetchStudents();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');
    try {
      const student = students.find(s => s.uid === studentId);
      if (!student) throw new Error('Nie wybrano ucznia.');
      await addDoc(collection(db, 'grades'), {
        studentId,
        studentName: student.displayName,
        subject,
        grade,
        description,
        date,
        gradeType,
        teacherId: user?.uid || '',
        createdAt: Timestamp.now(),
      });
      setSuccess('Ocena została dodana!');
      setStudentId('');
      setSubject('Matematyka');
      setGrade('');
      setDescription('');
      setDate('');
      setGradeType('');
      if (onGradeAdded) onGradeAdded();
    } catch {
      setError('Błąd podczas dodawania oceny.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-8 max-w-xl mx-auto flex flex-col gap-4">
      <h2 className="text-xl font-bold mb-2">Dodaj ocenę</h2>
      {success && <div className="text-green-600 text-sm mb-2">{success}</div>}
      {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Uczeń</label>
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded"
          value={studentId}
          onChange={e => setStudentId(e.target.value)}
          required
        >
          <option value="">-- wybierz ucznia --</option>
          {students.map(student => (
            <option key={student.uid} value={student.uid}>{student.displayName}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Przedmiot</label>
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          required
        >
          {SUBJECTS.map(subj => (
            <option key={subj} value={subj}>{subj}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Ocena (0-6)</label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded"
            value={grade}
            onChange={e => setGrade(e.target.value)}
            required
          >
            <option value="">-- wybierz ocenę --</option>
            {AVAILABLE_GRADES.map(g => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
          <input
            type="date"
            className="w-full px-3 py-2 border border-gray-300 rounded"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Opis (opcjonalnie)</label>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Typ oceny</label>
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded"
          value={gradeType}
          onChange={e => setGradeType(e.target.value)}
          required
        >
          {GRADE_TYPES.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="mt-2 bg-[#4067EC] text-white px-4 py-2 rounded hover:bg-[#3155d4] transition font-semibold disabled:bg-gray-400"
        disabled={loading}
      >
        {loading ? 'Dodawanie...' : 'Dodaj ocenę'}
      </button>
    </form>
  );
};

export default GradeForm; 