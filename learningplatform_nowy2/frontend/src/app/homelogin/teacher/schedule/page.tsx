"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { 
  Clock, 
  Plus, 
  Edit, 
  Trash2, 
  Calendar, 
  MapPin,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
  subject: string;
  class: string;
  room: string;
  teacher: string;
  startTime: string;
  endTime: string;
  day: string;
  week: number;
  description?: string;
  type: 'lecture' | 'lab' | 'seminar' | 'exam';
}

interface Class {
  id: string;
  name: string;
  grade_level: number;
  subject: string;
  description?: string;
  max_students: number;
  academic_year: string;
  students?: string[];
  assignedCourses?: string[];
  created_at?: any;
  updated_at?: any;
}

export default function TeacherSchedule() {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  // Oblicz aktualny tydzień na podstawie dzisiejszej daty
  const getCurrentWeek = () => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return weekNumber;
  };

  const [currentWeek, setCurrentWeek] = useState(getCurrentWeek());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDay, setFilterDay] = useState('all');
  const [filterClass, setFilterClass] = useState('all');

  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    class: '',
    room: '',
    startTime: '',
    endTime: '',
    day: 'monday',
    week: 1,
    description: '',
    type: 'lecture' as 'lecture' | 'lab' | 'seminar' | 'exam'
  });

  const days = [
    { key: 'monday', label: 'Poniedziałek', short: 'Pon' },
    { key: 'tuesday', label: 'Wtorek', short: 'Wt' },
    { key: 'wednesday', label: 'Środa', short: 'Śr' },
    { key: 'thursday', label: 'Czwartek', short: 'Czw' },
    { key: 'friday', label: 'Piątek', short: 'Pt' },
    { key: 'saturday', label: 'Sobota', short: 'Sob' },
    { key: 'sunday', label: 'Niedziela', short: 'Nd' }
  ];

  const timeSlots = [
    '08:00', '08:45', '09:30', '10:15', '11:00', '11:45',
    '12:30', '13:15', '14:00', '14:45', '15:30', '16:15',
    '17:00', '17:45', '18:30', '19:15', '20:00'
  ];

  // Funkcja do obliczania dat dla tygodnia
  const getWeekDates = (week: number, year: number) => {
    // Obliczamy pierwszy dzień roku
    const firstDayOfYear = new Date(year, 0, 1);
    
    // Znajdź pierwszy poniedziałek roku (ISO 8601 standard)
    const dayOfWeek = firstDayOfYear.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const firstMonday = new Date(firstDayOfYear);
    firstMonday.setDate(firstDayOfYear.getDate() + daysToMonday);
    
    // Oblicz datę początku tygodnia
    const weekStart = new Date(firstMonday);
    weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);
    
    // Oblicz datę końca tygodnia (niedziela)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    return {
      start: weekStart,
      end: weekEnd
    };
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\./g, '/');
  };

  const fetchClasses = useCallback(async () => {
    try {
      console.log('🔍 fetchClasses - rozpoczynam pobieranie klas');
      const classesRef = collection(db, 'classes');
      const classesSnapshot = await getDocs(classesRef);
      
      const classesData = classesSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Class))
        .filter(cls => cls.name); // Filtruj tylko klasy z nazwą
      
      console.log('🔍 fetchClasses - pobrano klas:', classesData.length);
      console.log('📚 Klasy:', classesData.map(cls => `${cls.name} (${cls.subject})`));
      
      setClasses(classesData);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  }, []);

  const fetchLessons = useCallback(async () => {
    try {
      // Mock data - w rzeczywistej aplikacji pobieralibyśmy z Firebase
      // Używamy nazw klas z bazy danych jeśli są dostępne
      const classNames = classes.length > 0 ? classes.map(cls => cls.name) : ['Klasa 1A', 'Klasa 2B', 'Klasa 1C'];
      
      const mockLessons: Lesson[] = [
        {
          id: '1',
          title: 'Matematyka - Algebra',
          subject: 'Matematyka',
          class: classNames[0] || 'Klasa 1A',
          room: 'Sala 101',
          teacher: user?.email || 'Nauczyciel',
          startTime: '08:00',
          endTime: '08:45',
          day: 'monday',
          week: currentWeek,
          description: 'Wprowadzenie do algebry liniowej',
          type: 'lecture'
        },
        {
          id: '2',
          title: 'Fizyka - Mechanika',
          subject: 'Fizyka',
          class: classNames[1] || 'Klasa 2B',
          room: 'Laboratorium 201',
          teacher: user?.email || 'Nauczyciel',
          startTime: '10:15',
          endTime: '11:00',
          day: 'monday',
          week: currentWeek,
          description: 'Prawa Newtona',
          type: 'lab'
        },
        {
          id: '3',
          title: 'Chemia - Reakcje',
          subject: 'Chemia',
          class: classNames[0] || 'Klasa 1A',
          room: 'Sala 102',
          teacher: user?.email || 'Nauczyciel',
          startTime: '11:00',
          endTime: '11:45',
          day: 'tuesday',
          week: currentWeek,
          description: 'Typy reakcji chemicznych',
          type: 'lecture'
        }
      ];
      
      setLessons(mockLessons);
    } catch (error) {
      console.error('Error fetching lessons:', error);
    } finally {
      setLoading(false);
    }
  }, [user, currentWeek, classes]);

  useEffect(() => {
    if (user) {
      console.log('🔍 useEffect - user changed:', user);
      console.log('🔍 useEffect - wywołuję fetchClasses');
      fetchClasses();
    } else {
      console.log('🔍 useEffect - brak użytkownika');
    }
  }, [user, fetchClasses]);

  useEffect(() => {
    if (user) {
      console.log('🔍 useEffect - currentWeek changed:', currentWeek);
      console.log('🔍 useEffect - wywołuję fetchLessons');
      fetchLessons();
    }
  }, [user, currentWeek, classes, fetchLessons]);

  const filteredLessons = lessons.filter(lesson => {
    const matchesSearch = lesson.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lesson.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lesson.class.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDay = filterDay === 'all' || lesson.day === filterDay;
    const matchesClass = filterClass === 'all' || lesson.class === filterClass;
    
    return matchesSearch && matchesDay && matchesClass;
  });

  const getLessonsForDay = (day: string) => {
    return filteredLessons
      .filter(lesson => lesson.day === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'lecture': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'lab': return 'bg-green-100 text-green-800 border-green-200';
      case 'seminar': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'exam': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'lecture': return 'Wykład';
      case 'lab': return 'Laboratorium';
      case 'seminar': return 'Seminarium';
      case 'exam': return 'Egzamin';
      default: return 'Lekcja';
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      subject: '',
      class: '',
      room: '',
      startTime: '',
      endTime: '',
      day: 'monday',
      week: currentWeek,
      description: '',
      type: 'lecture'
    });
  };

  const handleCreateLesson = () => {
    // Mock implementation - w rzeczywistej aplikacji zapisalibyśmy do Firebase
    const newLesson: Lesson = {
      id: Date.now().toString(),
      ...formData,
      teacher: user?.email || 'Nauczyciel'
    };
    
    setLessons([...lessons, newLesson]);
    setShowCreateModal(false);
    resetForm();
  };

  const handleEditLesson = () => {
    if (!selectedLesson) return;
    
    // Mock implementation - w rzeczywistej aplikacji aktualizowalibyśmy w Firebase
    setLessons(lessons.map(lesson => 
      lesson.id === selectedLesson.id 
        ? { ...lesson, ...formData }
        : lesson
    ));
    
    setShowEditModal(false);
    setSelectedLesson(null);
    resetForm();
  };

  const handleDeleteLesson = (lessonId: string) => {
    // Mock implementation - w rzeczywistej aplikacji usuwalibyśmy z Firebase
    setLessons(lessons.filter(lesson => lesson.id !== lessonId));
  };

  const openEditModal = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setFormData({
      title: lesson.title,
      subject: lesson.subject,
      class: lesson.class,
      room: lesson.room,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      day: lesson.day,
      week: lesson.week,
      description: lesson.description || '',
      type: lesson.type
    });
    setShowEditModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/30 p-8 mb-8 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Clock className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Plan Lekcji
                </h1>
                <p className="text-gray-600 mt-1">Zarządzaj swoim planem lekcji i harmonogramem</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Dodaj Lekcję
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/30 p-6 mb-8 shadow-lg">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Week Navigation */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  if (currentWeek > 1) {
                    setCurrentWeek(currentWeek - 1);
                  } else {
                    setCurrentYear(currentYear - 1);
                    setCurrentWeek(52);
                  }
                }}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-700">
                  Tydzień {currentWeek} - {currentYear}
                </div>
                <div className="text-sm text-gray-500">
                  {(() => {
                    const weekDates = getWeekDates(currentWeek, currentYear);
                    return `${formatDate(weekDates.start)} - ${formatDate(weekDates.end)}`;
                  })()}
                </div>
              </div>
              
              <button
                onClick={() => {
                  if (currentWeek < 52) {
                    setCurrentWeek(currentWeek + 1);
                  } else {
                    setCurrentYear(currentYear + 1);
                    setCurrentWeek(1);
                  }
                }}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              
              <button
                onClick={() => {
                  const now = new Date();
                  const currentYearNow = now.getFullYear();
                  const currentWeekNow = getCurrentWeek();
                  
                  setCurrentYear(currentYearNow);
                  setCurrentWeek(currentWeekNow);
                }}
                className="px-3 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
              >
                Dzisiaj
              </button>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Szukaj lekcji..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-full sm:w-64"
                />
              </div>
              
              <select
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <option value="all">Wszystkie dni</option>
                {days.map(day => (
                  <option key={day.key} value={day.key}>{day.label}</option>
                ))}
              </select>
              
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <option value="all">Wszystkie klasy</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.name}>{cls.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Schedule Grid */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/30 p-6 shadow-lg">
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
            {days.map(day => {
              const dayLessons = getLessonsForDay(day.key);
              return (
                <div key={day.key} className="min-h-[600px]">
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 rounded-xl mb-4 text-center">
                    <h3 className="font-bold text-lg">{day.short}</h3>
                    <p className="text-sm opacity-90">{dayLessons.length} lekcji</p>
                  </div>
                  
                  <div className="space-y-3">
                    {dayLessons.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>Brak lekcji</p>
                      </div>
                    ) : (
                      dayLessons.map(lesson => (
                        <div
                          key={lesson.id}
                          className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all duration-300 cursor-pointer group"
                          onClick={() => openEditModal(lesson)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                {lesson.title}
                              </h4>
                              <p className="text-sm text-gray-600">{lesson.class}</p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(lesson);
                                }}
                                className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                              >
                                <Edit className="h-3 w-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteLesson(lesson.id);
                                }}
                                className="p-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Clock className="h-4 w-4" />
                              <span>{lesson.startTime} - {lesson.endTime}</span>
                            </div>
                            
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <MapPin className="h-4 w-4" />
                              <span>{lesson.room}</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getTypeColor(lesson.type)}`}>
                                {getTypeLabel(lesson.type)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Create Lesson Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Plus className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Dodaj Nową Lekcję</h3>
                </div>
                <button 
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors group"
                >
                  <span className="text-gray-500 group-hover:text-gray-700 text-lg font-medium">×</span>
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tytuł lekcji</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="Np. Matematyka - Algebra"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Przedmiot</label>
                    <input
                      type="text"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="Np. Matematyka"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Klasa</label>
                    <select
                      value={formData.class}
                      onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      <option value="">Wybierz klasę</option>
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.name}>{cls.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sala</label>
                    <input
                      type="text"
                      value={formData.room}
                      onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="Np. Sala 101"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Dzień tygodnia</label>
                    <select
                      value={formData.day}
                      onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      {days.map(day => (
                        <option key={day.key} value={day.key}>{day.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Typ lekcji</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      <option value="lecture">Wykład</option>
                      <option value="lab">Laboratorium</option>
                      <option value="seminar">Seminarium</option>
                      <option value="exam">Egzamin</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Godzina rozpoczęcia</label>
                    <select
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      <option value="">Wybierz godzinę</option>
                      {timeSlots.map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Godzina zakończenia</label>
                    <select
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      <option value="">Wybierz godzinę</option>
                      {timeSlots.map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Opis (opcjonalny)</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="Dodatkowe informacje o lekcji..."
                  />
                </div>
                
                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      resetForm();
                    }}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-200 font-semibold"
                  >
                    Anuluj
                  </button>
                  <button
                    onClick={handleCreateLesson}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-semibold"
                  >
                    Dodaj Lekcję
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Lesson Modal */}
        {showEditModal && selectedLesson && (
          <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Edit className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Edytuj Lekcję</h3>
                </div>
                <button 
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedLesson(null);
                    resetForm();
                  }}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors group"
                >
                  <span className="text-gray-500 group-hover:text-gray-700 text-lg font-medium">×</span>
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tytuł lekcji</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="Np. Matematyka - Algebra"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Przedmiot</label>
                    <input
                      type="text"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="Np. Matematyka"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Klasa</label>
                    <select
                      value={formData.class}
                      onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      <option value="">Wybierz klasę</option>
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.name}>{cls.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sala</label>
                    <input
                      type="text"
                      value={formData.room}
                      onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="Np. Sala 101"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Dzień tygodnia</label>
                    <select
                      value={formData.day}
                      onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      {days.map(day => (
                        <option key={day.key} value={day.key}>{day.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Typ lekcji</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      <option value="lecture">Wykład</option>
                      <option value="lab">Laboratorium</option>
                      <option value="seminar">Seminarium</option>
                      <option value="exam">Egzamin</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Godzina rozpoczęcia</label>
                    <select
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      <option value="">Wybierz godzinę</option>
                      {timeSlots.map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Godzina zakończenia</label>
                    <select
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      <option value="">Wybierz godzinę</option>
                      {timeSlots.map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Opis (opcjonalny)</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="Dodatkowe informacje o lekcji..."
                  />
                </div>
                
                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedLesson(null);
                      resetForm();
                    }}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-200 font-semibold"
                  >
                    Anuluj
                  </button>
                  <button
                    onClick={handleEditLesson}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 font-semibold"
                  >
                    Zapisz Zmiany
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
