'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';

interface Event {
  id: string;
  title: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  deadline?: string;
  description?: string;
  type?: string;
  assignedTo?: string[];
  students?: string[];
  subject?: string;
  room?: string;
  day?: string;
  course_id?: string;
}

interface ScheduleLesson {
  id: string;
  title: string;
  subject: string;
  time: string;
  room?: string;
  teacher?: string;
}

const timeSlots = [
  { startTime: "8:00", endTime: "8:45", label: "1" },
  { startTime: "8:55", endTime: "9:40", label: "2" },
  { startTime: "9:50", endTime: "10:35", label: "3" },
  { startTime: "10:45", endTime: "11:30", label: "4" },
  { startTime: "11:40", endTime: "12:25", label: "5" },
  { startTime: "12:45", endTime: "13:30", label: "6" },
  { startTime: "13:40", endTime: "14:25", label: "7" },
  { startTime: "14:35", endTime: "15:20", label: "8" }
];

const monthsPl = [
  'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
];

const daysOfWeek = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek'];

export default function ParentDashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [courses, setCourses] = useState<Map<string, { courseType?: string }>>(new Map());
  const [, setAssignedStudent] = useState<{ id: string; name: string } | null>(null);
  const [currentWeek, setCurrentWeek] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(today);
    monday.setDate(diff);
    return monday;
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showElectiveOnly, setShowElectiveOnly] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // 1. Znajdź przypisanego ucznia
        const parentStudentsRef = collection(db, 'parent_students');
        const parentStudentsQuery = query(parentStudentsRef, where('parent', '==', user.uid));
        const parentStudentsSnapshot = await getDocs(parentStudentsQuery);

        if (parentStudentsSnapshot.empty) {
          setError('Nie masz przypisanego żadnego ucznia.');
          setLoading(false);
          return;
        }

        const studentId = parentStudentsSnapshot.docs[0].data().student;

        // 2. Pobierz dane ucznia
        const usersRef = collection(db, 'users');
        const studentQuery = query(usersRef, where('uid', '==', studentId));
        const studentSnapshot = await getDocs(studentQuery);

        if (!studentSnapshot.empty) {
          const studentData = studentSnapshot.docs[0].data();
          setAssignedStudent({
            id: studentId,
            name: `${studentData.firstName || ''} ${studentData.lastName || ''}`.trim() || studentData.username || 'Uczeń'
          });
        }

        // 3. Pobierz wydarzenia dla ucznia
        const eventsRef = collection(db, 'events');
        const eventsSnapshot = await getDocs(eventsRef);
        const allEvents = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));

        // Filtruj wydarzenia dla przypisanego ucznia
        const studentEvents = allEvents.filter(event => {
          if (event.assignedTo && event.assignedTo.includes(studentId)) {
            return true;
          }
          if (event.students && event.students.includes(studentId)) {
            return true;
          }
          return false;
        });

        setEvents(studentEvents);

        // Pobierz kursy aby sprawdzić typy
        const coursesRef = collection(db, 'courses');
        const coursesSnapshot = await getDocs(coursesRef);
        const coursesMap = new Map<string, { courseType?: string }>();
        coursesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          coursesMap.set(doc.id, { courseType: data.courseType });
        });
        setCourses(coursesMap);

        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Wystąpił błąd podczas pobierania danych.');
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Funkcje nawigacji tygodnia
  const prevWeek = () => {
    setCurrentWeek(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 7);
      return newDate;
    });
  };

  const nextWeek = () => {
    setCurrentWeek(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 7);
      return newDate;
    });
  };

  // Funkcja formatująca zakres dat tygodnia
  const formatDateRange = (date: Date): string => {
    const monday = new Date(date);
    const dayOfWeek = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - dayOfWeek);
    
    const friday = new Date(monday);
    friday.setDate(friday.getDate() + 4);
    
    return `${monday.getDate()}-${friday.getDate()} ${monthsPl[monday.getMonth()]}${monday.getMonth() !== friday.getMonth() ? ' - ' + friday.getDate() + ' ' + monthsPl[friday.getMonth()] : ''}`;
  };

  // Funkcja sprawdzająca czy zajęcia są fakultatywne
  const isElectiveLesson = (event: Event): boolean => {
    // Sprawdź czy event ma flagę fakultatywny
    if (event.type === 'fakultatywny' || event.type === 'elective') return true;
    // Sprawdź czy event jest powiązany z kursem fakultatywnym
    if (event.course_id) {
      const course = courses.get(event.course_id);
      if (course?.courseType === 'fakultatywny') return true;
    }
    return false;
  };

  // Funkcja pobierająca zajęcia dla danego dnia i slotu czasowego
  const getLessonsForSlot = (dayIndex: number, slot: typeof timeSlots[0]): ScheduleLesson[] => {
    // Oblicz datę dla danego dnia tygodnia (0 = poniedziałek, 4 = piątek)
    const monday = new Date(currentWeek);
    const dayOfWeek = (monday.getDay() + 6) % 7; // Konwertuj na poniedziałek = 0
    monday.setDate(monday.getDate() - dayOfWeek); // Upewnij się, że zaczynamy od poniedziałku
    
    const currentDate = new Date(monday);
    currentDate.setDate(monday.getDate() + dayIndex);
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayName = daysOfWeek[dayIndex];

    // Pobierz wydarzenia dla tego dnia
    const dayEvents = events.filter(event => {
      // PRZYPADEK 1: Wydarzenie ma konkretną datę
      let eventDate: string | null = null;
      if (event.date) {
        eventDate = event.date;
      } else if (event.deadline) {
        eventDate = new Date(event.deadline).toISOString().split('T')[0];
      }

      // Jeśli wydarzenie ma datę, sprawdź czy pasuje do tego dnia
      if (eventDate) {
        if (eventDate !== dateStr) return false;

        // Sprawdź czy wydarzenie pasuje do slotu czasowego
        if (event.startTime) {
          const parseTime = (timeStr: string) => {
            const parts = timeStr.split(':');
            if (parts.length === 2) {
              return parseInt(parts[0]) * 60 + parseInt(parts[1]);
            }
            return 0;
          };

          const eventStartMinutes = parseTime(event.startTime);
          const slotStartMinutes = parseTime(slot.startTime);
          const slotEndMinutes = parseTime(slot.endTime);

          return eventStartMinutes >= slotStartMinutes && eventStartMinutes < slotEndMinutes;
        }
        
        return true; // Wydarzenie ma datę ale nie ma godziny - pokaż je
      }

      // PRZYPADEK 2: Wydarzenie ma tylko dzień tygodnia (powtarzające się zajęcia)
      if (event.day && event.day === dayName) {
        // Sprawdź slot czasowy jeśli jest dostępny
        if (event.startTime) {
          const parseTime = (timeStr: string) => {
            const parts = timeStr.split(':');
            if (parts.length === 2) {
              return parseInt(parts[0]) * 60 + parseInt(parts[1]);
            }
            return 0;
          };

          const eventStartMinutes = parseTime(event.startTime);
          const slotStartMinutes = parseTime(slot.startTime);
          const slotEndMinutes = parseTime(slot.endTime);

          return eventStartMinutes >= slotStartMinutes && eventStartMinutes < slotEndMinutes;
        }
        
        return true; // Wydarzenie ma dzień tygodnia ale nie ma godziny - pokaż je
      }

      return false;
    });

    // Filtruj według typu zajęć (fakultatywne/obowiązkowe)
    const filteredEvents = showElectiveOnly 
      ? dayEvents.filter(event => isElectiveLesson(event))
      : dayEvents; // Gdy wyłączone, pokaż wszystkie zajęcia

    return filteredEvents.map(event => ({
      id: event.id,
      title: event.title,
      subject: event.subject || event.title,
      time: event.startTime && event.endTime ? `${event.startTime}-${event.endTime}` : event.startTime || '',
      room: event.room,
      teacher: event.description
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full">
      {/* Header bez przycisku powrotu */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Plan zajęć
          </h1>
          
          {/* Switch na zajęcia fakultatywne */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-gray-700 hidden sm:inline">Tylko zajęcia fakultatywne</span>
              <span className="text-xs text-gray-700 sm:hidden">Fakultatywne</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={showElectiveOnly}
                  onChange={(e) => setShowElectiveOnly(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                  showElectiveOnly ? 'bg-blue-600' : 'bg-gray-300'
                }`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                    showElectiveOnly ? 'translate-x-5' : 'translate-x-0.5'
                  } mt-0.5`}></div>
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <div className="w-full">
            {/* Desktop View - Schedule Grid - Zmniejszona rozdzielczość */}
            <div className="hidden md:block w-full border border-slate-200 rounded-3xl overflow-hidden shadow-xl bg-white">
              <div className="grid grid-cols-6" style={{ maxHeight: 'calc(100vh - 250px)', fontSize: '0.75rem' }}>
                {/* Enhanced Headers */}
                <div className="font-bold p-4 md:p-6 h-16 sm:h-20 text-center border-b border-r bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center">
                  <span className="text-sm md:text-base lg:text-xl">Godzina</span>
                </div>
                {daysOfWeek.map((day, index) => (
                  <div key={index} className="font-bold p-4 md:p-6 h-16 sm:h-20 text-center border-b border-r bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center">
                    <span className="text-sm md:text-base lg:text-xl">{day}</span>
                  </div>
                ))}

                {/* Enhanced Time Grid */}
                <div className="contents">
                  {timeSlots.map((slot, index) => (
                    <React.Fragment key={index}>
                      {/* Enhanced Time Column */}
                      <div className="bg-gradient-to-br from-slate-50 to-blue-50 border-r border-b border-slate-200 p-3 md:p-4 lg:p-6 flex flex-col justify-center hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 transition-all duration-200">
                        <div className="text-xs md:text-sm lg:text-lg font-bold text-blue-600 mb-1 sm:mb-2 whitespace-nowrap">
                          {slot.startTime} - {slot.endTime}
                        </div>
                        <div className="text-xs md:text-sm text-slate-500 font-medium whitespace-nowrap">
                          Lekcja {slot.label}
                        </div>
                      </div>

                      {/* Enhanced Day Cells */}
                      {[0, 1, 2, 3, 4].map((dayIndex) => {
                        const lessons = getLessonsForSlot(dayIndex, slot);
                        return (
                          <div 
                            key={`${index}-${dayIndex}`} 
                            className="border-r border-b border-slate-200 p-2 md:p-3 lg:p-6 bg-white hover:bg-gradient-to-br hover:from-slate-50 hover:to-blue-50 transition-all duration-200 group relative"
                          >
                            {lessons.length > 0 ? (
                              <div className="space-y-1 sm:space-y-2">
                                {lessons.map((lesson) => (
                                  <div 
                                    key={lesson.id}
                                    className="bg-blue-100 text-blue-800 p-2 md:p-3 rounded-lg border border-blue-200 hover:bg-blue-200 transition-colors"
                                  >
                                    <div className="font-semibold text-[10px] md:text-xs lg:text-sm mb-0.5 sm:mb-1 break-words">{lesson.subject}</div>
                                    {lesson.time && (
                                      <div className="text-[9px] md:text-xs text-blue-600 mb-0.5 sm:mb-1 whitespace-nowrap overflow-hidden text-ellipsis">{lesson.time}</div>
                                    )}
                                    {lesson.room && (
                                      <div className="text-[9px] md:text-xs text-blue-500 whitespace-nowrap overflow-hidden text-ellipsis">Sala: {lesson.room}</div>
                                    )}
                                    {lesson.teacher && (
                                      <div className="text-[9px] md:text-xs text-blue-500 mt-0.5 sm:mt-1 break-words line-clamp-2">{lesson.teacher}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <>
                                <div className="text-xs md:text-sm text-slate-400 mb-1 sm:mb-3 font-medium whitespace-nowrap">{slot.startTime}</div>
                                <div className="flex items-center justify-between">
                                  <div className="text-[10px] md:text-xs text-slate-300 group-hover:text-slate-400 transition-colors duration-200 whitespace-nowrap">
                                    Brak zajęć
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile View - Day Cards */}
            <div className="md:hidden space-y-4">
              {[0, 1, 2, 3, 4].map((dayIndex) => {
                const monday = new Date(currentWeek);
                const dayOfWeek = (monday.getDay() + 6) % 7;
                monday.setDate(monday.getDate() - dayOfWeek);
                const currentDate = new Date(monday);
                currentDate.setDate(monday.getDate() + dayIndex);
                const dateStr = `${currentDate.getDate()} ${monthsPl[currentDate.getMonth()]}`;

                return (
                  <div key={dayIndex} className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                    {/* Day Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
                      <h3 className="text-lg font-bold">{daysOfWeek[dayIndex]}</h3>
                      <p className="text-sm opacity-90">{dateStr}</p>
                    </div>

                    {/* Lessons for this day */}
                    <div className="p-4 space-y-3">
                      {timeSlots.map((slot, slotIndex) => {
                        const lessons = getLessonsForSlot(dayIndex, slot);
                        
                        if (lessons.length === 0) return null;

                        return (
                          <div key={slotIndex} className="border-l-4 border-blue-500 pl-4 py-2 bg-slate-50 rounded-r-lg">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="text-sm font-bold text-blue-600">
                                  {slot.startTime} - {slot.endTime}
                                </div>
                                <div className="text-xs text-slate-500">
                                  Lekcja {slot.label}
                                </div>
                              </div>
                            </div>
                            
                            {lessons.map((lesson) => (
                              <div key={lesson.id} className="mt-2 bg-blue-50 p-3 rounded-lg border border-blue-200">
                                <div className="font-semibold text-blue-900 mb-1">{lesson.subject}</div>
                                {lesson.room && (
                                  <div className="text-sm text-blue-700 flex items-center gap-1">
                                    <span>📍</span>
                                    <span>Sala: {lesson.room}</span>
                                  </div>
                                )}
                                {lesson.teacher && (
                                  <div className="text-sm text-slate-600 mt-1">{lesson.teacher}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                      
                      {/* If no lessons for this day */}
                      {timeSlots.every(slot => getLessonsForSlot(dayIndex, slot).length === 0) && (
                        <div className="text-center py-8 text-slate-400">
                          <p className="text-sm">Brak zajęć w tym dniu</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 