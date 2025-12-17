'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';
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
    // Ignore cache errors
  }
}

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const cacheKey = `parent_schedule_${user.uid}`;
    const cached = getSessionCache<{ events: Event[]; courses: Map<string, { courseType?: string }>; studentId: string; studentName: string }>(cacheKey);
    
    if (cached) {
      setEvents(cached.events);
      setCourses(cached.courses);
      setAssignedStudent({ id: cached.studentId, name: cached.studentName });
      setLoading(false);
      return;
    }

    try {
      await measureAsync('ParentSchedule:fetchData', async () => {
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

        // 2. Pobierz dane ucznia i wydarzenia równolegle
        const [studentSnapshot, eventsSnapshot, coursesSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('uid', '==', studentId))),
          getDocs(query(collection(db, 'events'), limit(500))), // Limit events
          getDocs(query(collection(db, 'courses'), limit(200))) // Limit courses
        ]);

        let studentName = 'Uczeń';
        if (!studentSnapshot.empty) {
          const studentData = studentSnapshot.docs[0].data();
          studentName = `${studentData.firstName || ''} ${studentData.lastName || ''}`.trim() || studentData.username || 'Uczeń';
          setAssignedStudent({
            id: studentId,
            name: studentName
          });
        }

        // Filtruj wydarzenia dla przypisanego ucznia
        const allEvents = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
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
        const coursesMap = new Map<string, { courseType?: string }>();
        coursesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          coursesMap.set(doc.id, { courseType: data.courseType });
        });
        setCourses(coursesMap);

        // Cache data
        setSessionCache(cacheKey, {
          events: studentEvents,
          courses: coursesMap,
          studentId,
          studentName
        });
      });
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Wystąpił błąd podczas pobierania danych.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Funkcje nawigacji tygodnia (zakomentowane - nie używane obecnie)
  // const prevWeek = () => {
  //   setCurrentWeek(prev => {
  //     const newDate = new Date(prev);
  //     newDate.setDate(newDate.getDate() - 7);
  //     return newDate;
  //   });
  // };

  // const nextWeek = () => {
  //   setCurrentWeek(prev => {
  //     const newDate = new Date(prev);
  //     newDate.setDate(newDate.getDate() + 7);
  //     return newDate;
  //   });
  // };

  // Funkcja formatująca zakres dat tygodnia (zakomentowane - nie używane obecnie)
  // const formatDateRange = (date: Date): string => {
  //   const monday = new Date(date);
  //   const dayOfWeek = (monday.getDay() + 6) % 7;
  //   monday.setDate(monday.getDate() - dayOfWeek);
  //   
  //   const friday = new Date(monday);
  //   friday.setDate(friday.getDate() + 4);
  //   
  //   return `${monday.getDate()}-${friday.getDate()} ${monthsPl[monday.getMonth()]}${monday.getMonth() !== friday.getMonth() ? ' - ' + friday.getDate() + ' ' + monthsPl[friday.getMonth()] : ''}`;
  // };

  // Funkcja sprawdzająca czy zajęcia są fakultatywne - memoized
  const isElectiveLesson = useCallback((event: Event): boolean => {
    // Sprawdź czy event ma flagę fakultatywny
    if (event.type === 'fakultatywny' || event.type === 'elective') return true;
    // Sprawdź czy event jest powiązany z kursem fakultatywnym
    if (event.course_id) {
      const course = courses.get(event.course_id);
      if (course?.courseType === 'fakultatywny') return true;
    }
    return false;
  }, [courses]);

  // Funkcja pobierająca zajęcia dla danego dnia i slotu czasowego - memoized
  const getLessonsForSlot = useCallback((dayIndex: number, slot: typeof timeSlots[0]): ScheduleLesson[] => {
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
  }, [events, currentWeek, showElectiveOnly, isElectiveLesson]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full" style={{ maxWidth: '100vw' }}>
      {/* Header bez przycisku powrotu */}
      <div className="flex-shrink-0 bg-white/80 backdrop-blur-lg border-b border-white/20 px-3 sm:px-4 lg:px-6 py-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Plan zajęć
          </h1>
          
          {/* Switch na zajęcia fakultatywne */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-gray-700 hidden sm:inline">Tylko zajęcia fakultatywne</span>
              <span className="text-xs text-gray-700 sm:hidden">Fakultatywne</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={showElectiveOnly}
                  onChange={(e) => setShowElectiveOnly(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-10 h-5 rounded-full transition-colors duration-200 ${
                  showElectiveOnly ? 'bg-blue-600' : 'bg-gray-300'
                }`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                    showElectiveOnly ? 'translate-x-5' : 'translate-x-0.5'
                  } mt-0.5`}></div>
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col px-2 sm:px-3 lg:px-4 py-1 min-h-0">
        {error && (
          <div className="flex-shrink-0 bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-lg mb-1 text-xs">
            {error}
          </div>
        )}

        {/* Desktop View - Schedule Grid */}
        <div className="hidden md:block w-full h-full border border-slate-200 rounded-lg overflow-hidden shadow-md bg-white flex-1 min-h-0">
          <div className="grid grid-cols-6 h-full" style={{ fontSize: '1rem' }}>
              {/* Enhanced Headers */}
              <div className="font-bold p-1.5 h-10 text-center border-b border-r bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center">
                <span className="text-[15px]">Godzina</span>
              </div>
              {daysOfWeek.map((day, index) => (
                <div key={index} className="font-bold p-1.5 h-10 text-center border-b border-r bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center">
                  <span className="text-[15px]">{day}</span>
                </div>
              ))}

                {/* Enhanced Time Grid */}
                <div className="contents">
                  {timeSlots.map((slot, index) => (
                    <React.Fragment key={index}>
                      {/* Enhanced Time Column */}
                      <div className="bg-gradient-to-br from-slate-50 to-blue-50 border-r border-b border-slate-200 p-1.5 flex flex-col justify-center hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 transition-all duration-200">
                        <div className="text-[14px] font-bold text-blue-600 mb-0.5 whitespace-nowrap">
                          {slot.startTime} - {slot.endTime}
                        </div>
                        <div className="text-[12px] text-slate-500 font-medium whitespace-nowrap">
                          {slot.label}
                        </div>
                      </div>

                      {/* Enhanced Day Cells - zmniejszone */}
                      {[0, 1, 2, 3, 4].map((dayIndex) => {
                        const lessons = getLessonsForSlot(dayIndex, slot);
                        return (
                          <div 
                            key={`${index}-${dayIndex}`} 
                            className="border-r border-b border-slate-200 p-0.5 bg-white hover:bg-gradient-to-br hover:from-slate-50 hover:to-blue-50 transition-all duration-200 group relative overflow-y-auto max-h-full scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                          >
                            {lessons.length > 0 ? (
                              <div className="space-y-1">
                                {lessons.map((lesson) => (
                                  <div 
                                    key={lesson.id}
                                    className="bg-blue-100 text-blue-800 p-1.5 rounded border border-blue-200 hover:bg-blue-200 transition-colors"
                                  >
                                    <div className="font-semibold text-[14px] mb-0.5 break-words leading-tight">{lesson.subject}</div>
                                    {lesson.room && (
                                      <div className="text-[12px] text-blue-500 whitespace-nowrap overflow-hidden text-ellipsis">Sala: {lesson.room}</div>
                                    )}
                                    {lesson.teacher && (
                                      <div className="text-[12px] text-blue-500 mt-0.5 break-words line-clamp-1">{lesson.teacher}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[12px] text-slate-300 group-hover:text-slate-400 transition-colors duration-200 whitespace-nowrap text-center">
                                -
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

        {/* Mobile View - Day Cards */}
        <div className="md:hidden space-y-2 overflow-hidden flex-1 min-h-0">
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
  );
} 