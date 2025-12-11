'use client';

import { useState, useEffect } from 'react';
import { db } from '@/config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export default function DebugFirebase() {
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const debugFirebaseData = async () => {
    setLoading(true);
    setDebugInfo('🔍 Debugowanie danych Firebase...\n\n');
    
    try {
      let output = '';
      
      // 1. Sprawdź relacje parent-student
      output += '📋 Sprawdzanie relacji parent-student...\n';
      const parentStudentsRef = collection(db, 'parent_students');
      const parentStudentsSnapshot = await getDocs(parentStudentsRef);
      
      output += `Znaleziono ${parentStudentsSnapshot.docs.length} relacji parent-student:\n`;
      parentStudentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        output += `  - Parent: ${data.parent}, Student: ${data.student}\n`;
      });
      
      // 2. Sprawdź użytkowników
      output += '\n👥 Sprawdzanie użytkowników...\n';
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      
      output += `Znaleziono ${usersSnapshot.docs.length} użytkowników:\n`;
      usersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        output += `  - UID: ${data.uid}, Email: ${data.email}, Role: ${data.role}, Name: ${data.displayName || 'Brak'}\n`;
      });
      
      // 3. Sprawdź kursy
      output += '\n📚 Sprawdzanie kursów...\n';
      const coursesRef = collection(db, 'courses');
      const coursesSnapshot = await getDocs(coursesRef);
      
      output += `Znaleziono ${coursesSnapshot.docs.length} kursów:\n`;
      coursesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        output += `  - ID: ${doc.id}, Tytuł: ${data.title}, Nauczyciel: ${data.teacher}\n`;
        output += `    Przypisani użytkownicy: ${JSON.stringify(data.assignedUsers || [])}\n`;
      });
      
      // 4. Sprawdź oceny
      output += '\n📊 Sprawdzanie ocen...\n';
      const gradesRef = collection(db, 'grades');
      const gradesSnapshot = await getDocs(gradesRef);
      
      output += `Znaleziono ${gradesSnapshot.docs.length} ocen:\n`;
      gradesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        output += `  - ID: ${doc.id}, StudentId: ${data.studentId}, Value: ${data.value || data.grade}, Subject: ${data.subject || data.course_id}\n`;
      });
      
      // 5. Szczegółowa analiza dla konkretnego ucznia
      output += '\n🎯 Szczegółowa analiza dla ucznia uczen2@uczen.pl...\n';
      
      // Znajdź UID ucznia
      const studentQuery = query(usersRef, where('email', '==', 'uczen2@uczen.pl'));
      const studentSnapshot = await getDocs(studentQuery);
      
      if (studentSnapshot.empty) {
        output += '❌ Nie znaleziono ucznia uczen2@uczen.pl\n';
        setDebugInfo(output);
        setLoading(false);
        return;
      }
      
      const studentData = studentSnapshot.docs[0].data();
      const studentUID = studentData.uid;
      output += `✅ Znaleziono ucznia: UID=${studentUID}, Email=${studentData.email}\n`;
      
      // Znajdź kursy przypisane do tego ucznia
      output += '\n📖 Kursy przypisane do tego ucznia:\n';
      let coursesCount = 0;
      coursesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const assignedUsers = data.assignedUsers || [];
        
        if (assignedUsers.includes(studentUID) || assignedUsers.includes(studentData.email)) {
          coursesCount++;
          output += `  ✅ ${data.title} (ID: ${doc.id})\n`;
          output += `     Przypisany przez: ${assignedUsers.includes(studentUID) ? 'UID' : 'email'}\n`;
        }
      });
      
      if (coursesCount === 0) {
        output += '  ❌ Brak przypisanych kursów\n';
      }
      
      // Znajdź oceny tego ucznia
      output += '\n📝 Oceny tego ucznia:\n';
      let gradesCount = 0;
      gradesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.studentId === studentUID || data.student === studentUID) {
          gradesCount++;
          output += `  ✅ Ocena: ${data.value || data.grade}, Przedmiot: ${data.subject || data.course_id}, Data: ${data.date || data.graded_at}\n`;
        }
      });
      
      if (gradesCount === 0) {
        output += '  ❌ Brak ocen\n';
      }
      
      // Znajdź relację parent-student
      output += '\n👨‍👩‍👧‍👦 Sprawdzanie relacji parent-student dla rodzic@rodzic.pl...\n';
      const parentQuery = query(usersRef, where('email', '==', 'rodzic@rodzic.pl'));
      const parentSnapshot = await getDocs(parentQuery);
      
      if (parentSnapshot.empty) {
        output += '❌ Nie znaleziono rodzica rodzic@rodzic.pl\n';
      } else {
        const parentData = parentSnapshot.docs[0].data();
        const parentUID = parentData.uid;
        output += `✅ Znaleziono rodzica: UID=${parentUID}\n`;
        
        // Sprawdź czy jest relacja
        const relationQuery = query(parentStudentsRef, 
          where('parent', '==', parentUID), 
          where('student', '==', studentUID)
        );
        const relationSnapshot = await getDocs(relationQuery);
        
        if (relationSnapshot.empty) {
          output += '❌ Brak relacji parent-student między rodzic@rodzic.pl a uczen2@uczen.pl\n';
          output += `💡 Utwórz relację w panelu administratora!\n`;
        } else {
          output += '✅ Relacja parent-student istnieje!\n';
        }
      }
      
      setDebugInfo(output);
      
    } catch (error) {
      setDebugInfo(`❌ Błąd: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    debugFirebaseData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8 w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Debug Firebase Data</h1>
        
        <button 
          onClick={debugFirebaseData}
          disabled={loading}
          className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Ładowanie...' : 'Odśwież dane'}
        </button>
        
        <div className="bg-white rounded-lg shadow p-6">
          <pre className="whitespace-pre-wrap text-sm font-mono">
            {debugInfo}
          </pre>
        </div>
      </div>
    </div>
  );
}









