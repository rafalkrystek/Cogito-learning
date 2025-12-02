'use client';
import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, getDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';

interface Student {
  uid: string;
  displayName: string;
  role?: string;
  email?: string;
  phone?: string;
}

interface Class {
  id: string;
  name: string;
  description?: string;
  students: string[];
  teacher_id: string;
  is_active: boolean;
}

const CreateEvent: React.FC = () => {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [timeError, setTimeError] = useState('');
  const [availableClasses, setAvailableClasses] = useState<Class[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  // Pobierz klasy nauczyciela
  useEffect(() => {
    const fetchClasses = async () => {
      if (!user || !user.uid) return;
      
      try {
        const classesQuery = query(
          collection(db, 'classes'),
          where('teacher_id', '==', user.uid)
        );
        const classesSnapshot = await getDocs(classesQuery);
        const classesData = classesSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Class))
          .filter(cls => cls.is_active);
        setAvailableClasses(classesData);
      } catch (error) {
        console.error('Error fetching classes:', error);
      }
    };
    
    if (user?.role === 'teacher') {
      fetchClasses();
    }
  }, [user]);

  useEffect(() => {
    const fetchStudents = async () => {
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      const studentsList = usersSnapshot.docs
        .map(doc => {
          const data = doc.data() as Record<string, unknown>;
          return {
            uid: doc.id,
            displayName: data.displayName as string || '',
            role: data.role as string,
            email: data.email as string || '',
            phone: data.phone as string || ''
          } as Student;
        })
        .filter(user => user?.role === 'student');
      setStudents(studentsList);
    };
    fetchStudents();
  }, []);

  // Filtrowanie uczniów na podstawie wyszukiwania
  const filteredStudents = students.filter(student =>
    student.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Funkcje do zarządzania wyborem uczniów
  const selectAllStudents = () => {
    setSelectedStudents(filteredStudents.map(student => student.uid));
  };

  const deselectAllStudents = () => {
    setSelectedStudents([]);
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleClass = (classId: string) => {
    setSelectedClasses(prev => {
      const isSelected = prev.includes(classId);
      const newSelectedClasses = isSelected
        ? prev.filter(id => id !== classId)
        : [...prev, classId];
      
      // Zaktualizuj wybranych uczniów na podstawie wybranych klas
      const classStudents = new Set<string>();
      
      // Dodaj uczniów z wybranych klas
      newSelectedClasses.forEach(cId => {
        const classData = availableClasses.find(c => c.id === cId);
        if (classData && classData.students) {
          classData.students.forEach(studentId => classStudents.add(studentId));
        }
      });
      
      // Dodaj uczniów z indywidualnie wybranych uczniów (których nie ma w klasach)
      selectedStudents.forEach(studentId => {
        // Sprawdź czy uczeń nie jest już w wybranej klasie
        const isInSelectedClass = newSelectedClasses.some(cId => {
          const classData = availableClasses.find(c => c.id === cId);
          return classData?.students?.includes(studentId);
        });
        if (!isInSelectedClass) {
          classStudents.add(studentId);
        }
      });
      
      setSelectedStudents(Array.from(classStudents));
      return newSelectedClasses;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');
    setTimeError('');
    // Walidacja czy godziny są wypełnione
    if (!startTime || !endTime) {
      setTimeError('Proszę wypełnić godzinę rozpoczęcia i zakończenia');
      setLoading(false);
      return;
    }
    try {
      console.log('🚀 ========== TWORZENIE WYDARZENIA ==========');
      console.log('📝 Tytuł:', title);
      console.log('📅 Data:', date);
      console.log('⏰ Godzina:', `${startTime} - ${endTime}`);
      console.log('👥 Wybrane klasy (ID):', selectedClasses);
      console.log('👥 Wybrani uczniowie (ID):', selectedStudents);
      console.log('👥 Liczba wybranych uczniów:', selectedStudents.length);
      
      // Zbierz wszystkich uczniów z wybranych klas
      const studentsFromClasses = new Set<string>();
      selectedClasses.forEach(classId => {
        const classData = availableClasses.find(c => c.id === classId);
        if (classData && classData.students) {
          classData.students.forEach(studentId => studentsFromClasses.add(studentId));
        }
      });
      
      // Połącz uczniów z klas z indywidualnie wybranymi
      const allSelectedStudents = Array.from(new Set([...Array.from(studentsFromClasses), ...selectedStudents]));
      
      if (allSelectedStudents.length === 0) {
        setError('Musisz wybrać przynajmniej jednego ucznia lub klasę!');
        setLoading(false);
        return;
      }
      
      console.log('👥 Wszyscy wybrani uczniowie (z klas + indywidualnie):', allSelectedStudents);

      // Utwórz wydarzenie
      console.log('💾 Zapisuję wydarzenie do bazy danych...');
      const eventRef = await addDoc(collection(db, 'events'), {
        title,
        description,
        date,
        startTime,
        endTime,
        createdBy: 'teacher',
        assignedTo: allSelectedStudents,
      });

      console.log('✅ Wydarzenie utworzone z ID:', eventRef.id);

      // Pobierz dane uczniów (email i telefon) do wysyłki powiadomień
      console.log('📥 Pobieram dane uczniów z bazy danych...');
      const studentDataPromises = allSelectedStudents.map(async (studentId) => {
        try {
          console.log(`  🔍 Pobieram dane dla ucznia ID: ${studentId}`);
          const studentDoc = await getDoc(doc(db, 'users', studentId));
          if (studentDoc.exists()) {
            const studentData = studentDoc.data();
            const studentInfo = {
              uid: studentId,
              email: studentData.email || '',
              phone: studentData.phone || '',
              displayName: studentData.displayName || 'Uczeń'
            };
            console.log(`  ✅ Dane ucznia ${studentId}:`, {
              name: studentInfo.displayName,
              email: studentInfo.email ? 'TAK' : 'BRAK',
              phone: studentInfo.phone ? studentInfo.phone : 'BRAK'
            });
            return studentInfo;
          }
          console.log(`  ⚠️ Dokument ucznia ${studentId} nie istnieje w bazie`);
          return { uid: studentId, email: '', phone: '', displayName: 'Uczeń' };
        } catch (error) {
          console.error(`  ❌ Błąd pobierania danych ucznia ${studentId}:`, error);
          return { uid: studentId, email: '', phone: '', displayName: 'Uczeń' };
        }
      });

      const studentsData = await Promise.all(studentDataPromises);
      
      // Loguj dane uczniów dla debugowania
      console.log('📋 ========== PODSUMOWANIE DANYCH UCZNIÓW ==========');
      studentsData.forEach((student, index) => {
        console.log(`  ${index + 1}. ${student.displayName} (${student.uid}):`);
        console.log(`     📧 Email: ${student.email || 'BRAK'}`);
        console.log(`     📱 Telefon: ${student.phone || 'BRAK'}`);
      });
      
      const studentsWithEmail = studentsData.filter(s => s.email).length;
      const studentsWithPhoneCount = studentsData.filter(s => s.phone).length;
      console.log(`📊 Statystyki: ${studentsWithEmail} z emailem, ${studentsWithPhoneCount} z numerem telefonu`);

      // Utwórz powiadomienia dla każdego przypisanego ucznia
      const notificationPromises = allSelectedStudents.map(studentId => {
        console.log('Creating notification for student:', studentId);
        return addDoc(collection(db, 'notifications'), {
          user_id: studentId,
          type: 'event',
          title: `Nowe wydarzenie: ${title}`,
          message: description || 'Masz nowe wydarzenie w kalendarzu',
          timestamp: new Date().toISOString(),
          read: false,
          event_id: eventRef.id,
          event_date: date,
          event_time: `${startTime} - ${endTime}`,
          action_url: '/homelogin/student/calendar'
        });
      });

      await Promise.all(notificationPromises);

      // Formatuj datę i godzinę dla wiadomości
      const formattedDate = new Date(date).toLocaleDateString('pl-PL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Wysyłaj emaile i SMSy do uczniów
      console.log('📧 ========== WYSYŁANIE EMAILI I SMS ==========');
      let emailsSent = 0;
      let smsSent = 0;
      let emailErrors = 0;
      let smsErrors = 0;

      const emailPromises = studentsData
        .filter(student => student.email)
        .map(async (student) => {
          console.log(`📧 Przetwarzanie emaila dla: ${student.displayName} (${student.email})`);
          try {
            const emailSubject = `Nowe wydarzenie: ${title}`;
            const emailBody = `
Witaj ${student.displayName},

Masz nowe wydarzenie w kalendarzu:

Tytuł: ${title}
${description ? `Opis: ${description}` : ''}
Data: ${formattedDate}
Godzina: ${startTime} - ${endTime}

Zaloguj się do platformy, aby zobaczyć szczegóły:
${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/homelogin/student/calendar

---
Platforma E-Learning
            `.trim();

            const formData = new FormData();
            formData.append('to', student.email);
            formData.append('subject', emailSubject);
            formData.append('body', emailBody);

            const response = await fetch('/api/send-email', {
              method: 'POST',
              body: formData,
            });

            if (response.ok) {
              emailsSent++;
              console.log(`  ✅ Email wysłany do ${student.email}`);
            } else {
              emailErrors++;
              const errorData = await response.json().catch(() => ({}));
              console.error(`  ❌ Błąd wysyłania emaila do ${student.email}:`, errorData);
            }
          } catch (error) {
            emailErrors++;
            console.error(`  ❌ Błąd wysyłania emaila do ${student.email}:`, error);
          }
        });

      const studentsWithPhone = studentsData.filter(s => s.phone);
      console.log(`📱 Uczniowie z numerem telefonu: ${studentsWithPhone.length}`);
      
      if (studentsWithPhone.length === 0) {
        console.log('⚠️ BRAK UCZNIÓW Z NUMEREM TELEFONU - SMS nie będą wysyłane');
      }

      const smsPromises = studentsWithPhone
        .map(async (student) => {
          try {
            console.log(`📱 ========== PRZETWARZANIE SMS ==========`);
            console.log(`📱 Uczeń: ${student.displayName} (${student.uid})`);
            console.log(`📱 Oryginalny numer: ${student.phone}`);
            
            // Formatuj numer telefonu (usuń spacje, dodaj +48 jeśli brak)
            let phoneNumber = student.phone.replace(/\s/g, '');
            if (!phoneNumber.startsWith('+')) {
              if (phoneNumber.startsWith('0')) {
                phoneNumber = '+48' + phoneNumber.substring(1);
              } else {
                phoneNumber = '+48' + phoneNumber;
              }
            }
            
            console.log(`📱 Sformatowany numer: ${phoneNumber}`);

            const smsMessage = `Nowe wydarzenie: ${title}\nData: ${formattedDate}\nGodzina: ${startTime}-${endTime}\n\nZaloguj się do platformy, aby zobaczyć szczegóły.`;
            
            console.log(`📱 Treść SMS:`, smsMessage);
            console.log(`📱 Wywołuję endpoint /api/send-sms...`);

            const response = await fetch('/api/send-sms', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: phoneNumber,
                message: smsMessage
              }),
            });

            console.log(`📱 Status odpowiedzi: ${response.status} ${response.statusText}`);
            
            const responseData = await response.json();
            console.log(`📱 Odpowiedź z API:`, responseData);

            if (response.ok) {
              smsSent++;
              console.log(`✅ SMS wysłany pomyślnie do ${phoneNumber}`);
              console.log(`   Message SID: ${responseData.messageId || 'brak'}`);
              console.log(`   Status: ${responseData.status || 'brak'}`);
            } else {
              smsErrors++;
              console.error(`❌ Błąd wysyłania SMS do ${phoneNumber}:`);
              console.error(`   Status: ${response.status}`);
              console.error(`   Błąd: ${responseData.error || 'Nieznany błąd'}`);
              if (responseData.details) {
                console.error(`   Szczegóły: ${responseData.details}`);
              }
            }
          } catch (error) {
            smsErrors++;
            console.error(`❌ Błąd podczas wysyłania SMS do ${student.phone}:`);
            if (error instanceof Error) {
              console.error(`   Typ błędu: ${error.name}`);
              console.error(`   Wiadomość: ${error.message}`);
              console.error(`   Stack: ${error.stack}`);
            } else {
              console.error(`   Błąd:`, error);
            }
          }
        });

      // Wykonaj wszystkie wysyłki równolegle
      console.log('⏳ Wykonuję wszystkie wysyłki równolegle...');
      await Promise.all([...emailPromises, ...smsPromises]);

      console.log('📊 ========== PODSUMOWANIE WYSYŁKI ==========');
      console.log(`📊 Powiadomienia w systemie: ${notificationPromises.length}`);
      console.log(`📧 Emails: ${emailsSent} wysłanych, ${emailErrors} błędów`);
      console.log(`📱 SMS: ${smsSent} wysłanych, ${smsErrors} błędów`);
      console.log(`📱 Uczniowie z numerem telefonu: ${studentsWithPhone.length}`);
      
      // Sprawdź czy są uczniowie z numerami telefonu, ale SMS nie zostały wysłane
      if (studentsWithPhone.length > 0 && smsSent === 0) {
        console.error('❌ ========== BŁĄD: SMS NIE ZOSTAŁY WYSŁANE ==========');
        console.error(`❌ ${studentsWithPhone.length} uczniów ma numer telefonu, ale żaden SMS nie został wysłany.`);
        console.error('❌ Możliwe przyczyny:');
        console.error('   1. Brak konfiguracji Twilio w pliku .env.local');
        console.error('   2. Nieprawidłowe dane Twilio (Account SID, Auth Token, Phone Number)');
        console.error('   3. Serwer nie został uruchomiony ponownie po dodaniu zmiennych');
        console.error('   4. Błąd w endpoint /api/send-sms');
        console.error('   5. Brak środków na koncie Twilio');
        console.error('   6. Numer telefonu nie jest zweryfikowany (wersja trial)');
        
        setError(`Wydarzenie utworzone, ale SMS nie zostały wysłane (${smsErrors} błędów). Sprawdź konfigurację Twilio w pliku .env.local. Otwórz konsolę przeglądarki (F12) aby zobaczyć szczegóły.`);
      } else if (smsErrors > 0) {
        setError(`Wydarzenie utworzone, ale wystąpiły błędy podczas wysyłania SMS (${smsErrors} błędów). Sprawdź konsolę przeglądarki (F12) aby zobaczyć szczegóły.`);
      } else {
        const successMessage = `Wydarzenie utworzone! Wysłano ${notificationPromises.length} powiadomień${emailsSent > 0 ? `, ${emailsSent} emaili` : ''}${smsSent > 0 ? `, ${smsSent} SMSów` : ''}.`;
        setSuccess(successMessage);
      }
      
      console.log('✅ ========== KONIEC TWORZENIA WYDARZENIA ==========');
      setTitle('');
      setDescription('');
      setDate('');
      setStartTime('');
      setEndTime('');
      setSelectedStudents([]);
      setSelectedClasses([]);
    } catch (error) {
      console.error('Error creating event:', error);
      setError('Błąd podczas tworzenia wydarzenia: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Toggle Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Utwórz nowe wydarzenie</h3>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-4 py-2 bg-[#4067EC] text-white rounded-lg hover:bg-[#3155d4] transition-all duration-200 font-medium"
        >
          {isExpanded ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Zwiń formularz
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Rozwiń formularz
            </>
          )}
        </button>
      </div>

      {/* Collapsible Form */}
      {isExpanded && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Status Messages */}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {success}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {error}
            </div>
          )}
          {timeError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              {timeError}
            </div>
          )}

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tytuł */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Tytuł wydarzenia *</label>
          <input
            type="text"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC] transition-all"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="np. Sprawdzian z matematyki"
            required
          />
        </div>

        {/* Opis */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Opis (opcjonalnie)</label>
          <textarea
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC] transition-all resize-none"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="Dodatkowe informacje o wydarzeniu..."
          />
        </div>

        {/* Data */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Data *</label>
          <input
            type="date"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC] transition-all"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
          />
        </div>

        {/* Godzina rozpoczęcia */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Godzina rozpoczęcia *</label>
          <input
            type="time"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC] transition-all"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            required
          />
        </div>

        {/* Godzina zakończenia */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Godzina zakończenia *</label>
          <input
            type="time"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC] transition-all"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            required
          />
        </div>

        {/* Wybór klas */}
        {availableClasses.length > 0 && (
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Wybierz klasy (opcjonalnie)</label>
            <div className="max-h-48 overflow-y-auto border-2 border-gray-200 rounded-xl p-4 bg-gray-50 mb-4">
              {availableClasses.length > 0 ? (
                <div className="space-y-3">
                  {availableClasses.map(classItem => (
                    <label key={classItem.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-[#4067EC] hover:bg-[#F1F4FE] transition-all cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedClasses.includes(classItem.id)}
                        onChange={() => toggleClass(classItem.id)}
                        className="w-4 h-4 text-[#4067EC] border-gray-300 rounded focus:ring-[#4067EC] focus:ring-2"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{classItem.name || 'Brak nazwy'}</div>
                        <div className="text-sm text-gray-500">
                          {classItem.students?.length || 0} {classItem.students?.length === 1 ? 'uczeń' : 'uczniów'}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {selectedClasses.includes(classItem.id) ? '✓ Zaznaczona' : '○ Niezaznaczona'}
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-4">
                  Brak dostępnych klas
                </div>
              )}
            </div>
            {selectedClasses.length > 0 && (
              <div className="mb-4 text-sm text-gray-600">
                Wybrane klasy: <span className="font-semibold text-[#4067EC]">{selectedClasses.length}</span>
              </div>
            )}
          </div>
        )}

        {/* Wybór uczniów */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Wybierz uczniów {selectedClasses.length > 0 ? '(dodatkowo do klas)' : '*'}
          </label>
          
          {/* Wyszukiwarka uczniów */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="🔍 Wyszukaj uczniów..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 pl-12 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC] transition-all"
              />
              <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Przyciski zarządzania */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={selectAllStudents}
              className="px-4 py-2 bg-[#4067EC] text-white text-sm font-medium rounded-lg hover:bg-[#3155d4] transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Zaznacz wszystkich
            </button>
            <button
              type="button"
              onClick={deselectAllStudents}
              className="px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Odznacz wszystkich
            </button>
          </div>

          {/* Lista uczniów z checkboxami */}
          <div className="max-h-64 overflow-y-auto border-2 border-gray-200 rounded-xl p-4 bg-gray-50">
            {filteredStudents.length > 0 ? (
              <div className="space-y-3">
                {filteredStudents.map(student => (
                  <label key={student.uid} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-[#4067EC] hover:bg-[#F1F4FE] transition-all cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(student.uid)}
                      onChange={() => toggleStudent(student.uid)}
                      className="w-4 h-4 text-[#4067EC] border-gray-300 rounded focus:ring-[#4067EC] focus:ring-2"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{student.displayName || 'Brak nazwy'}</div>
                      <div className="text-sm text-gray-500">Student</div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {selectedStudents.includes(student.uid) ? '✓ Zaznaczony' : '○ Niezaznaczony'}
                    </div>
                  </label>
                ))}
              </div>
            ) : searchTerm ? (
              <div className="text-center text-gray-500 py-8">
                <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Brak wyników dla: &quot;{searchTerm}&quot;
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                Brak dostępnych uczniów
              </div>
            )}
          </div>

          {/* Licznik wybranych uczniów */}
          {filteredStudents.length > 0 && (
            <div className="mt-3 text-sm text-gray-600">
              Zaznaczono: <span className="font-semibold text-[#4067EC]">{selectedStudents.length}</span> z <span className="font-semibold">{filteredStudents.length}</span> uczniów
              {selectedClasses.length > 0 && (
                <span className="ml-2 text-gray-500">
                  (+ uczniowie z {selectedClasses.length} {selectedClasses.length === 1 ? 'klasy' : 'klas'})
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-4">
        <button
          type="submit"
          className="bg-[#4067EC] text-white px-8 py-3 rounded-xl hover:bg-[#3155d4] transition-all duration-200 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          disabled={loading}
        >
          {loading ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Tworzenie...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Utwórz wydarzenie
            </>
          )}
        </button>
      </div>
    </form>
      )}
    </div>
  );
};

export default CreateEvent; 