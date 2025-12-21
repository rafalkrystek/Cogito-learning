"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { collection, query, where, getDocs, getDocsFromServer } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';

interface TimeSlot {
  startTime: string;
  endTime: string;
  label: string;
}

const timeSlots: TimeSlot[] = [
  { startTime: "8:00", endTime: "8:45", label: "1" },
  { startTime: "8:45", endTime: "9:30", label: "2" },
  { startTime: "10:00", endTime: "10:45", label: "3" },
  { startTime: "10:45", endTime: "11:30", label: "4" },
  { startTime: "11:35", endTime: "12:20", label: "5" },
  { startTime: "12:20", endTime: "13:05", label: "6" },
  { startTime: "13:55", endTime: "14:40", label: "7" },
  { startTime: "14:40", endTime: "15:25", label: "8" },
  { startTime: "15:30", endTime: "16:15", label: "9" },
  { startTime: "16:15", endTime: "17:00", label: "10" }
];

const daysOfWeek = [
  { id: 0, name: 'Poniedziałek' },
  { id: 1, name: 'Wtorek' },
  { id: 2, name: 'Środa' },
  { id: 3, name: 'Czwartek' },
  { id: 4, name: 'Piątek' }
];

const monthsPl = [
  'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
];

function formatDateRange(date: Date): string {
  const monday = new Date(date);
  const dayOfWeek = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - dayOfWeek);
  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);
  return `${monday.getDate()}-${friday.getDate()} ${monthsPl[monday.getMonth()]}`;
}

interface Lesson {
  id: string;
  title: string;
  subject?: string;
  room?: string;
  day: string;
  startTime: string;
  endTime: string;
  className?: string;
}

const LessonSchedule: React.FC = () => {
  const { user } = useAuth();
  const [current, setCurrent] = useState(() => new Date());
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLessons = useCallback(async (forceRefresh = false) => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // WAŻNE: Najpierw sprawdź, czy uczeń jest przypisany do jakiejkolwiek klasy
      // Używamy getDocsFromServer aby wymusić pobranie z serwera (pomijając cache)
      const classesRef = collection(db, 'classes');
      const classesSnapshot = forceRefresh 
        ? await getDocsFromServer(classesRef)
        : await getDocs(classesRef);
      
      // Znajdź wszystkie klasy, do których uczeń jest przypisany
      const studentClassIds: string[] = [];
      classesSnapshot.docs.forEach((classDoc) => {
        const classData = classDoc.data();
        const students = classData.students || [];
        if (students.includes(user.uid)) {
          studentClassIds.push(classDoc.id);
        }
      });

      console.log(`📚 Uczeń jest przypisany do ${studentClassIds.length} klas:`, studentClassIds);

      // Jeśli uczeń nie jest przypisany do żadnej klasy, nie pokazuj żadnych eventów
      if (studentClassIds.length === 0) {
        console.log('⚠️ Uczeń nie jest przypisany do żadnej klasy - brak lekcji');
        setLessons([]);
        setLoading(false);
        return;
      }

      // Pobierz wszystkie wydarzenia typu class_lesson
      // Używamy getDocsFromServer aby wymusić pobranie z serwera (pomijając cache)
      const eventsRef = collection(db, 'events');
      const eventsQuery = query(
        eventsRef,
        where('type', '==', 'class_lesson')
      );
      
      const eventsSnapshot = forceRefresh
        ? await getDocsFromServer(eventsQuery)
        : await getDocs(eventsQuery);
      
      console.log(`📊 Znaleziono ${eventsSnapshot.docs.length} eventów typu class_lesson w bazie`);
      
      const allLessons: Lesson[] = [];
      let matchedCount = 0;
      let skippedNotInClass = 0;
      let skippedNoClassId = 0;

      eventsSnapshot.docs.forEach((doc) => {
        const eventData = doc.data();
        const eventClassId = eventData.classId;
        
        // Sprawdź czy event należy do klasy, do której uczeń jest przypisany
        const students = eventData.students || eventData.assignedTo || [];
        const isInEventStudents = students.includes(user.uid);
        const isInStudentClass = eventClassId && studentClassIds.includes(eventClassId);
        
        // WAŻNE: Event jest ważny jeśli należy do klasy ucznia
        // Nie wymagamy, aby uczeń był w students array (może być problem z synchronizacją)
        // Ale jeśli uczeń jest w students array, to też pokaż event (dla bezpieczeństwa)
        if (isInStudentClass) {
          // Event należy do klasy ucznia - pokaż go
          allLessons.push({
            id: doc.id,
            title: eventData.title || eventData.subject || 'Lekcja',
            subject: eventData.subject,
            room: eventData.room,
            day: eventData.day || '',
            startTime: eventData.startTime || eventData.time || '',
            endTime: eventData.endTime || '',
            className: eventData.className
          });
          matchedCount++;
          
          // Loguj jeśli uczeń nie jest w students array (może być problem z synchronizacją)
          if (!isInEventStudents) {
            console.log(`⚠️ Event ${doc.id} (${eventData.subject} - ${eventData.day} ${eventData.time}) należy do klasy ${eventClassId}, ale uczeń nie jest w students array. Pokazuję go mimo to.`);
          }
        } else if (!eventClassId) {
          skippedNoClassId++;
          console.log(`⚠️ Event ${doc.id} (${eventData.subject || 'bez subject'} - ${eventData.day || '?'} ${eventData.time || '?'}) nie ma classId - pomijam`);
        } else if (isInEventStudents && !isInStudentClass) {
          // Uczeń jest w eventach, ale nie jest w klasie - to błąd danych, pomiń
          skippedNotInClass++;
          console.log(`⚠️ Event ${doc.id} (${eventData.subject} - ${eventData.day} ${eventData.time}) ma ucznia w liście, ale uczeń nie jest w klasie ${eventClassId} (klasy ucznia: ${studentClassIds.join(', ')})`);
        } else {
          skippedNotInClass++;
          // Loguj pierwsze 5 pominiętych eventów dla debugowania
          if (skippedNotInClass <= 5) {
            console.log(`⚠️ Event ${doc.id} (${eventData.subject || 'bez subject'} - ${eventData.day || '?'} ${eventData.time || '?'}) należy do klasy ${eventClassId}, ale uczeń nie jest w tej klasie (klasy ucznia: ${studentClassIds.join(', ')})`);
          }
        }
      });

      console.log(`✅ Statystyki: ${matchedCount} dopasowanych, ${skippedNotInClass} pominiętych (nie w klasie), ${skippedNoClassId} bez classId`);
      console.log(`✅ Znaleziono ${allLessons.length} lekcji dla ucznia z klas: ${studentClassIds.join(', ')}`);
      
      // Diagnostyka: sprawdź ile eventów jest dla każdej klasy ucznia
      for (const classId of studentClassIds) {
        const classEvents = eventsSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data.classId === classId;
        });
        console.log(`📊 Klasa ${classId}: ${classEvents.length} eventów w bazie`);
        
        // Pobierz dane klasy z Firestore, aby sprawdzić ile slotów jest w planie
        try {
          const classDoc = classesSnapshot.docs.find(doc => doc.id === classId);
          if (classDoc) {
            const classData = classDoc.data();
            const scheduleSlots = classData.schedule || [];
            console.log(`📋 Klasa ${classId} ma ${scheduleSlots.length} slotów w planie zajęć`);
            
            if (scheduleSlots.length !== classEvents.length) {
              console.warn(`⚠️ ROZNICA: Plan zajęć ma ${scheduleSlots.length} slotów, ale w bazie jest tylko ${classEvents.length} eventów!`);
              console.log(`   Slotów w planie:`, scheduleSlots.map((s: any) => `${s.day} ${s.time} - ${s.subject || 'brak subject'}`));
            }
          }
        } catch (error) {
          console.error(`Błąd podczas pobierania danych klasy ${classId}:`, error);
        }
        
        // Pokaż wszystkie eventy dla tej klasy (maksymalnie 20 pierwszych)
        const eventsToShow = classEvents.slice(0, 20);
        console.log(`   📝 Lista eventów dla klasy ${classId} (pierwsze ${eventsToShow.length} z ${classEvents.length}):`);
        eventsToShow.forEach(eventDoc => {
          const eventData = eventDoc.data();
          const students = eventData.students || eventData.assignedTo || [];
          const hasStudent = students.includes(user.uid);
          console.log(`   - ${eventData.subject || 'bez subject'} - ${eventData.day} ${eventData.time} (uczeń w students: ${hasStudent ? 'TAK' : 'NIE'}, students: ${students.length})`);
        });
        if (classEvents.length > 20) {
          console.log(`   ... i ${classEvents.length - 20} więcej eventów`);
        }
      }
      setLessons(allLessons);
    } catch (error) {
      console.error('Error fetching lessons:', error);
      setLessons([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    // Zawsze wymuszaj odświeżenie przy pierwszym załadowaniu i gdy zmienia się użytkownik
    fetchLessons(true);
  }, [user?.uid]);

  // Dodatkowo: odświeżaj dane co 30 sekund (na wypadek zmian w tle)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLessons(true);
    }, 30000); // 30 sekund

    return () => clearInterval(interval);
  }, [fetchLessons]);

  // Mapowanie polskich nazw dni na indeksy
  const dayNameToIndex: Record<string, number> = {
    'Poniedziałek': 0,
    'Wtorek': 1,
    'Środa': 2,
    'Czwartek': 3,
    'Piątek': 4
  };

  // Funkcja do znajdowania lekcji dla danego slotu czasowego i dnia
  const getLessonForSlot = (slotIndex: number, dayIndex: number): Lesson | null => {
    const dayName = daysOfWeek[dayIndex].name;
    const slot = timeSlots[slotIndex];
    
    return lessons.find(lesson => {
      const lessonDayIndex = dayNameToIndex[lesson.day];
      if (lessonDayIndex !== dayIndex) return false;
      
      // Sprawdź czy czas lekcji pasuje do slotu (z tolerancją ±5 minut)
      const lessonStart = lesson.startTime.split(':').map(Number);
      const slotStart = slot.startTime.split(':').map(Number);
      
      const lessonMinutes = lessonStart[0] * 60 + lessonStart[1];
      const slotMinutes = slotStart[0] * 60 + slotStart[1];
      
      return Math.abs(lessonMinutes - slotMinutes) <= 5;
    }) || null;
  };

  const prevWeek = () => setCurrent(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; });
  const nextWeek = () => setCurrent(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; });
  const prevDay = () => setSelectedDayIndex(prev => (prev > 0 ? prev - 1 : 4));
  const nextDay = () => setSelectedDayIndex(prev => (prev < 4 ? prev + 1 : 0));

  const selectedDay = daysOfWeek[selectedDayIndex];

  return (
    <div className="w-full h-full flex flex-col" style={{ height: '100%' }}>
      {/* ===== MOBILE: lista dni tygodnia z godzinami ===== */}
      <div className="block lg:hidden h-full flex flex-col overflow-y-auto" style={{ height: '100%' }}>
        <div className="flex items-center justify-between mb-2 p-1.5 bg-slate-50 dark:bg-gray-800 rounded-lg flex-shrink-0 sticky top-0 z-10">
          <button onClick={prevWeek} className="p-1.5 rounded-lg bg-blue-600 dark:bg-blue-700 text-white"><ChevronLeft className="w-3 h-3" /></button>
          <div className="text-center">
            <div className="font-bold text-xs dark:text-gray-100">{monthsPl[current.getMonth()]} {current.getFullYear()}</div>
            <div className="text-[10px] text-slate-600 dark:text-gray-400">{formatDateRange(current)}</div>
          </div>
          <button onClick={nextWeek} className="p-1.5 rounded-lg bg-blue-600 dark:bg-blue-700 text-white"><ChevronRight className="w-3 h-3" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-1.5 pb-2">
          {daysOfWeek.map((day) => {
            const dayLessons = timeSlots.map(slot => ({
              slot,
              lesson: getLessonForSlot(timeSlots.indexOf(slot), day.id)
            }));

            return (
              <div key={day.id} className="mb-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                {/* Nagłówek dnia */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-800 px-2 py-0.5">
                  <h3 className="text-xs font-bold text-white">{day.name}</h3>
                </div>

                {/* Lista lekcji dla danego dnia */}
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {dayLessons.map(({ slot, lesson }, index) => (
                    <div key={index} className="py-0.5 px-1 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <div className="flex items-center gap-1.5">
                        {/* Kolumna z godziną */}
                        <div className="flex-shrink-0 w-12 text-center">
                          <div className="bg-blue-50 dark:bg-blue-900 rounded px-1 py-0.5 border border-blue-200 dark:border-blue-700">
                            <div className="text-[10px] font-bold text-blue-700 dark:text-blue-200 leading-tight">{slot.startTime}</div>
                            <div className="text-[9px] text-blue-600 dark:text-blue-300 leading-tight">- {slot.endTime}</div>
                          </div>
                        </div>

                        {/* Kolumna z zajęciami */}
                        <div className="flex-1">
                          {lesson ? (
                            <div className="bg-blue-100 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded px-1.5 py-0.5">
                              <div className="text-xs font-semibold text-blue-900 dark:text-blue-100 leading-tight">
                                {lesson.subject || lesson.title}
                              </div>
                              {lesson.room && (
                                <div className="text-[9px] text-blue-700 dark:text-blue-300">Sala: {lesson.room}</div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center">
                              <div className="text-[10px] text-gray-400 dark:text-gray-500">Brak lekcji</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== DESKTOP: cały tydzień ===== */}
      <div className="hidden lg:flex h-full flex-col" style={{ height: '100%' }}>
        <div className="flex items-center justify-between mb-1 p-1 bg-slate-50 dark:bg-gray-800 rounded-lg flex-shrink-0">
          <button onClick={prevWeek} className="p-2 rounded-lg bg-blue-600 dark:bg-blue-700 text-white"><ChevronLeft className="w-4 h-4" /></button>
          <div className="text-center">
            <div className="font-bold text-sm dark:text-gray-100">{monthsPl[current.getMonth()]} {current.getFullYear()}</div>
            <div className="text-[10px] text-slate-600 dark:text-gray-400">{formatDateRange(current)}</div>
          </div>
          <button onClick={nextWeek} className="p-2 rounded-lg bg-blue-600 dark:bg-blue-700 text-white"><ChevronRight className="w-4 h-4" /></button>
        </div>

        <div className="border dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 flex-1 flex flex-col" style={{ flex: '1 1 0', minHeight: 0, height: '100%' }}>
          <div className="grid grid-cols-6 flex-1" style={{ gridTemplateRows: 'auto repeat(10, 1fr)', height: '100%' }}>
            <div className="font-bold p-2 text-center border-b border-r dark:border-gray-700 bg-blue-600 dark:bg-blue-700 text-white text-xs flex items-center justify-center">Godzina</div>
            {daysOfWeek.map(d => (
              <div key={d.id} className="font-bold p-2 text-center border-b border-r dark:border-gray-700 last:border-r-0 bg-blue-600 dark:bg-blue-700 text-white text-xs flex items-center justify-center">{d.name}</div>
            ))}
            {timeSlots.map((slot, i) => (
              <React.Fragment key={i}>
                <div className={`border-r dark:border-gray-700 ${i === timeSlots.length - 1 ? 'border-b-0' : 'border-b'} p-1.5 bg-slate-50 dark:bg-gray-800 flex items-center justify-center`} style={{ height: '100%' }}>
                  <div>
                    <div className="font-bold text-blue-600 dark:text-blue-400 text-xs">{slot.startTime} - {slot.endTime}</div>
                    <div className="text-[10px] text-slate-500 dark:text-gray-400">Lekcja {slot.label}</div>
                  </div>
                </div>
                {daysOfWeek.map(d => {
                  const lesson = getLessonForSlot(i, d.id);
                  const isLastRow = i === timeSlots.length - 1;
                  return (
                    <div key={`${i}-${d.id}`} className={`border-r dark:border-gray-700 ${isLastRow ? 'border-b-0' : 'border-b'} last:border-r-0 p-1.5 hover:bg-slate-50 dark:hover:bg-gray-700 flex items-center justify-center`} style={{ height: '100%' }}>
                      {lesson ? (
                        <div className="bg-blue-100 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded p-1.5 w-full h-full flex flex-col justify-center">
                          <div className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-0.5 leading-tight">{lesson.subject || lesson.title}</div>
                          {lesson.room && (
                            <div className="text-[10px] text-blue-700 dark:text-blue-300">Sala: {lesson.room}</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="text-[10px] text-slate-400 dark:text-gray-500">{slot.startTime}</div>
                          <div className="text-[10px] text-slate-300 dark:text-gray-600">Brak</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LessonSchedule;
