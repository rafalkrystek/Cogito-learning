'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  School, 
  Plus, 
  Users, 
  BookOpen, 
  Calendar, 
  Edit, 
  Trash2, 
  Search,
  ArrowLeft,
  Upload,
  FileText,
} from 'lucide-react';
import { db, auth } from '@/config/firebase';
import { collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, arrayUnion, arrayRemove, serverTimestamp, query, where, limit } from 'firebase/firestore';
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
    // Ignore storage errors
  }
}

interface Class {
  id: string;
  name: string;
  description: string;
  grade_level: number;
  subject: string;
  students: string[];
  max_students: number;
  academic_year: string;
  is_active: boolean;
  created_at: any;
  updated_at: any;
  assignedCourses?: string[];
  schedule?: Array<{
    day: string;
    time: string;
    subject?: string;
    room: string;
  }>;
}

interface Student {
  id: string;
  name: string;
  email: string;
  classId?: string;
  role?: string;
}

interface Course {
  id: string;
  title: string;
  subject: string;
  created_by: string;
  assignedUsers: string[];
}

export default function ClassesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showManageStudentsModal, setShowManageStudentsModal] = useState(false);
  const [showAssignCourseModal, setShowAssignCourseModal] = useState(false);
  const [showImportCSVModal, setShowImportCSVModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');
  const [selectedClassForImport, setSelectedClassForImport] = useState<string>('');
  const [csvText, setCsvText] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    grade_level: 1,
    subject: '',
    max_students: 30,
    academic_year: '2024/2025',
    schedule: [] as any[]
  });

  const [, setStudentFormData] = useState({
    studentEmail: ''
  });

  // Multi-selection states
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [courseFormData, setCourseFormData] = useState({
    courseId: ''
  });

  // Kolejność dni tygodnia do sortowania
  const dayOrder = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek'];
  
  // Funkcja pomocnicza do konwersji czasu na minuty od początku dnia (dla sortowania)
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };

  // Funkcja sortująca plan zajęć po dniach tygodnia, a następnie po godzinie
  const sortedSchedule = useMemo(() => {
    if (!formData.schedule || formData.schedule.length === 0) return [];
    
    return [...formData.schedule].sort((a, b) => {
      // Najpierw sortuj po dniu tygodnia
      const dayA = a.day || '';
      const dayB = b.day || '';
      const dayIndexA = dayOrder.indexOf(dayA);
      const dayIndexB = dayOrder.indexOf(dayB);
      
      // Jeśli dzień nie jest w liście, umieść na końcu
      if (dayIndexA === -1 && dayIndexB === -1) {
        // Jeśli oba nie mają dnia, sortuj po godzinie
        const timeA = timeToMinutes(a.time || '');
        const timeB = timeToMinutes(b.time || '');
        return timeA - timeB;
      }
      if (dayIndexA === -1) return 1;
      if (dayIndexB === -1) return -1;
      
      if (dayIndexA !== dayIndexB) {
        return dayIndexA - dayIndexB;
      }
      
      // Jeśli ten sam dzień, sortuj po godzinie (konwertuj na minuty dla poprawnego sortowania)
      const timeA = timeToMinutes(a.time || '');
      const timeB = timeToMinutes(b.time || '');
      return timeA - timeB;
    });
  }, [formData.schedule]);

  // Gotowe przedziały czasowe lekcji (zgodne z planem lekcji)
  const timeSlots = [
    { startTime: "8:00", endTime: "8:45", label: "1", display: "8:00 - 8:45 (Lekcja 1)" },
    { startTime: "8:45", endTime: "9:30", label: "2", display: "8:45 - 9:30 (Lekcja 2)" },
    { startTime: "10:00", endTime: "10:45", label: "3", display: "10:00 - 10:45 (Lekcja 3)" },
    { startTime: "10:45", endTime: "11:30", label: "4", display: "10:45 - 11:30 (Lekcja 4)" },
    { startTime: "11:35", endTime: "12:20", label: "5", display: "11:35 - 12:20 (Lekcja 5)" },
    { startTime: "12:20", endTime: "13:05", label: "6", display: "12:20 - 13:05 (Lekcja 6)" },
    { startTime: "13:55", endTime: "14:40", label: "7", display: "13:55 - 14:40 (Lekcja 7)" },
    { startTime: "14:40", endTime: "15:25", label: "8", display: "14:40 - 15:25 (Lekcja 8)" },
    { startTime: "15:30", endTime: "16:15", label: "9", display: "15:30 - 16:15 (Lekcja 9)" },
    { startTime: "16:15", endTime: "17:00", label: "10", display: "16:15 - 17:00 (Lekcja 10)" }
  ];

  const fetchClasses = useCallback(async (forceRefresh = false) => {
    if (!user?.uid) {
      return;
    }

    try {
      await measureAsync('TeacherClasses:fetchClasses', async () => {
        // Teacher panel: w zarządzaniu klasami nauczyciel widzi wszystkie aktywne klasy (jak wcześniej).
        // To nie wpływa na kalendarz nauczyciela, bo tam `class_lesson` są ukryte dla roli teacher.
        const cacheKey = `teacher_classes_all`;
        
        // Jeśli wymuszamy odświeżenie, pomiń cache
        if (!forceRefresh) {
          const cached = getSessionCache<Class[]>(cacheKey);
          
          if (cached) {
            setClasses(cached);
            setError(null);
            return;
          }
        }

        const classesRef = collection(db, 'classes');
        const classesSnapshot = await getDocs(query(classesRef, where('is_active', '==', true), limit(100)));

        const classesData = classesSnapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Class))
          .filter(cls => cls.is_active !== false);

        setClasses(classesData);
        setSessionCache(cacheKey, classesData);
        setError(null); // Clear any previous errors
      });
    } catch (error: any) {
      setError(`Wystąpił błąd podczas pobierania klas: ${error?.message || 'Nieznany błąd'}`);
    }
  }, [user?.uid]);

  const fetchStudents = useCallback(async () => {
    try {
      await measureAsync('TeacherClasses:fetchStudents', async () => {
        const usersRef = collection(db, 'users');
        const studentsQuery = query(usersRef, where('role', '==', 'student'), limit(500));
        const usersSnapshot = await getDocs(studentsQuery);

        const studentsData = usersSnapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          // Utwórz nazwę z displayName, firstName/lastName lub email
          let name = '';
          if (data.displayName) {
            name = data.displayName;
          } else if (data.firstName || data.lastName) {
            name = `${data.firstName || ''} ${data.lastName || ''}`.trim();
          } else if (data.email) {
            // Jeśli nie ma nazwy, użyj części przed @ z emaila
            name = data.email.split('@')[0];
          }
          
          return {
            id: docSnap.id,
            name: name || 'Brak nazwy',
            email: data.email || '',
            classId: data.classId,
            role: data.role,
            displayName: data.displayName,
            firstName: data.firstName,
            lastName: data.lastName,
            ...data
          } as Student;
        });

        setStudents(studentsData);
      });
    } catch {
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    if (!user?.email) return;

    try {
      await measureAsync('TeacherClasses:fetchCourses', async () => {
        const coursesRef = collection(db, 'courses');

        // Pobierz kursy powiązane z nauczycielem (jako twórca lub przypisany nauczyciel) with limit
        const [createdBySnapshot, teacherEmailSnapshot] = await Promise.all([
          getDocs(query(coursesRef, where('created_by', '==', user.email), limit(100))),
          getDocs(query(coursesRef, where('teacherEmail', '==', user.email), limit(100)))
        ]);

        const map = new Map<string, Course>();

        createdBySnapshot.docs.forEach((docSnap) => {
          map.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Course);
        });

        teacherEmailSnapshot.docs.forEach((docSnap) => {
          if (!map.has(docSnap.id)) {
            map.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Course);
          }
        });

        setCourses(Array.from(map.values()));
      });
    } catch {
    }
  }, [user?.email]);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null); // Clear errors on reload

    Promise.all([
      fetchClasses(),
      fetchStudents(),
      fetchCourses(),
    ]).finally(() => {
      setLoading(false);
    });
  }, [user?.uid, fetchClasses, fetchStudents, fetchCourses]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowStudentDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCreateClass = async () => {
    if (!formData.name || !formData.grade_level) {
      setError('Wypełnij wszystkie wymagane pola.');
      return;
    }

    if (!user || !user.uid) {
      setError('Brak danych użytkownika. Zaloguj się ponownie.');
      return;
    }

    // Sprawdź czy Firebase Auth jest dostępny
    const currentUser = auth.currentUser;
    
    // Sprawdź token i custom claims
    if (currentUser) {
      try {
        const token = await currentUser.getIdTokenResult(true); // forceRefresh
        
        if (!token.claims.role) {
          // Próba automatycznego ustawienia custom claims
          try {
            const response = await fetch('/api/set-teacher-role-api', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ uid: user.uid })
            });
            
            if (response.ok) {
              await currentUser.getIdToken(true); // Odśwież token
            }
          } catch {
            // Ignore
          }
        }
      } catch {
        // Ignore
      }
    }

    try {
      // Upewnij się że teacher_id jest dokładnie równy currentUser.uid
      const teacherId = String(user.uid).trim();
      const currentUserId = String(currentUser?.uid || user.uid).trim();
      
      if (teacherId !== currentUserId) {
        setError('Błąd weryfikacji użytkownika. Odśwież stronę i spróbuj ponownie.');
        return;
      }
      
      const classData = {
        name: String(formData.name).trim(),
        description: String(formData.description || '').trim(),
        grade_level: Number(formData.grade_level),
        subject: String(formData.subject || '').trim(),
        max_students: Number(formData.max_students || 30),
        academic_year: String(formData.academic_year || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`).trim(),
        teacher_id: teacherId, // Używamy zweryfikowanego teacher_id
        teacher_email: String(user.email || '').trim(),
        students: [],
        is_active: true,
        schedule: Array.isArray(formData.schedule) ? formData.schedule : [],
        assignedCourses: [],
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };
      
      // Sprawdź czy kolekcja istnieje
      collection(db, 'classes'); // Test dostępności kolekcji
      
      try {
        // Próba odczytu kolekcji (test uprawnień)
        await getDocs(query(collection(db, 'classes'), where('is_active', '==', true), limit(1)));
      } catch {
        // Ignore
      }

      // Próba 1: Bezpośredni zapis do Firestore
      try {
        await addDoc(collection(db, 'classes'), classData);
      } catch (firestoreError: any) {
        // Szczegółowa analiza błędu uprawnień
        if (firestoreError?.code === 'permission-denied') {
          // Próba 2: Przez API backend (jeśli bezpośredni zapis nie działa)
          try {
            const token = await currentUser?.getIdToken();
            
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/api/classes/create/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                name: formData.name,
                description: formData.description || '',
                grade_level: formData.grade_level,
                subject: formData.subject || '',
                max_students: formData.max_students || 30,
                academic_year: formData.academic_year || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
                students: [],
                schedule: formData.schedule || []
              })
            });
            
            if (response.ok) {
              await response.json();
            } else {
              const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
              throw new Error(errorData.error || 'Błąd API');
            }
          } catch {
            throw firestoreError; // Rzuć oryginalny błąd Firestore
          }
        } else {
          throw firestoreError;
        }
      }
      
      // Invalidate cache after creating class (używamy wspólnego cache dla wszystkich nauczycieli)
      sessionStorage.removeItem(`teacher_classes_all`);
      
      // Synchronizuj plan zajęć z kalendarzem
      try {
        await syncClassScheduleToCalendar(classData, []);
      } catch {
        // Nie przerywamy procesu tworzenia klasy, tylko logujemy błąd
      }
      
      setSuccess('Klasa została utworzona pomyślnie!');
      setShowCreateModal(false);
      resetForm();
      
      // Odśwież listę klas
      await fetchClasses();
    } catch (error: any) {
      // Szczegółowa analiza błędu
      if (error?.code === 'permission-denied') {
        setError('Brak uprawnień do tworzenia klas. Sprawdź reguły Firestore lub skontaktuj się z administratorem.');
      } else if (error?.code === 'unavailable') {
        setError('Firebase jest niedostępny. Sprawdź połączenie z internetem.');
      } else if (error?.code === 'unauthenticated') {
        setError('Nie jesteś zalogowany. Zaloguj się ponownie.');
      } else {
        setError(`Wystąpił błąd podczas tworzenia klasy: ${error?.message || 'Nieznany błąd'}`);
      }
      
    }
  };

  const handleEditClass = async () => {
    console.log('📝 ========== ROZPOCZĘCIE EDYCJI KLASY ==========');
    console.log('Klasa:', selectedClass?.name, 'ID:', selectedClass?.id);
    console.log('Nowy plan zajęć:', formData.schedule);
    
    if (!selectedClass || !formData.name || !formData.grade_level) {
      setError('Wypełnij wszystkie wymagane pola.');
      return;
    }

    try {
      if (!user || !user.uid) {
        setError('Brak danych użytkownika. Zaloguj się ponownie.');
        return;
      }

      // Usuń WSZYSTKIE eventy dla klasy przed synchronizacją nowego planu
      // To zapewnia, że nie zostaną stare eventy, które nie pasują do nowego planu
      console.log('🗑️ KROK 1: Usuwanie wszystkich starych eventów...');
      try {
        await removeAllClassEvents(selectedClass.id);
        console.log('✅ KROK 1: Zakończono usuwanie eventów');
      } catch (error) {
        console.error('❌ KROK 1: Błąd podczas usuwania eventów:', error);
        // Nie przerywamy procesu, tylko logujemy błąd
      }

      console.log('💾 KROK 2: Zapisuję zmiany w klasie...');
      const classRef = doc(db, 'classes', selectedClass.id);
      await updateDoc(classRef, {
        name: formData.name,
        description: formData.description,
        grade_level: formData.grade_level,
        subject: formData.subject,
        max_students: formData.max_students,
        academic_year: formData.academic_year,
        schedule: formData.schedule, // ✅ Dodano zapisywanie planu zajęć
        updated_at: serverTimestamp()
      });
      console.log('✅ KROK 2: Zmiany zapisane w Firestore');

      // Synchronizuj plan zajęć z kalendarzem po edycji
      console.log('🔄 KROK 3: Synchronizacja planu zajęć z kalendarzem...');
      try {
        const updatedClassData = {
          ...selectedClass,
          ...formData,
          id: selectedClass.id
        };
        await syncClassScheduleToCalendar(updatedClassData, selectedClass.students || []);
        console.log('✅ KROK 3: Synchronizacja zakończona');
      } catch (error) {
        console.error('❌ KROK 3: Błąd podczas synchronizacji:', error);
        // Nie przerywamy procesu edycji klasy, tylko logujemy błąd
      }
      
      console.log('✅ ========== EDYCJA KLASY ZAKOŃCZONA ==========');

      // Invalidate cache (używamy wspólnego cache dla wszystkich nauczycieli)
      sessionStorage.removeItem(`teacher_classes_all`);
      
      setSuccess('Klasa została zaktualizowana pomyślnie!');
      setShowEditModal(false);
      setSelectedClass(null);
      resetForm();
      fetchClasses();
    } catch {
      setError('Wystąpił błąd podczas aktualizacji klasy.');
    }
  };

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tę klasę?')) return;

    try {
      await deleteDoc(doc(db, 'classes', classId));
      
      // Invalidate cache (używamy wspólnego cache dla wszystkich nauczycieli)
      sessionStorage.removeItem(`teacher_classes_all`);
      
      setSuccess('Klasa została usunięta pomyślnie!');
      // Odśwież listę klas (wymuś odświeżenie bez cache)
      await fetchClasses(true);
    } catch (error: any) {
      console.error('Error deleting class:', error);
      setError(`Wystąpił błąd podczas usuwania klasy: ${error?.message || 'Nieznany błąd'}`);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      grade_level: 1,
      subject: '',
      max_students: 30,
      academic_year: '2024/2025',
      schedule: [] as any[]
    });
  };

  const updateScheduleSlot = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      schedule: prev.schedule.map((slot: any, i: number) => 
        i === index ? { ...slot, [field]: value } : slot
      )
    }));
  };

  const removeScheduleSlot = (index: number) => {
    setFormData(prev => ({
      ...prev,
      schedule: prev.schedule.filter((_: any, i: number) => i !== index)
    }));
  };

  const addScheduleSlot = () => {
    setFormData(prev => ({
      ...prev,
      schedule: [...prev.schedule, {
        day: '',
        time: '',
        subject: '',
        room: ''
      }]
    }));
  };

  // Funkcja usuwania WSZYSTKICH eventów dla klasy (używamy przed synchronizacją)
  // Funkcja do usunięcia ucznia ze wszystkich eventów wszystkich klas (oprócz wybranej)
  const removeStudentFromAllOtherClassEvents = async (studentId: string, excludeClassId: string) => {
    if (!studentId) return;

    try {
      console.log(`🔄 Usuwanie ucznia ${studentId} z eventów wszystkich klas (oprócz ${excludeClassId})`);
      
      // Pobierz wszystkie eventy typu class_lesson
      let allEvents: any[] = [];
      
      try {
        const eventsQuery = query(
          collection(db, 'events'),
          where('type', '==', 'class_lesson')
        );
        const eventsSnapshot = await getDocs(eventsQuery);
        allEvents = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (queryError) {
        // Alternatywa: pobierz wszystkie eventy
        const allEventsSnapshot = await getDocs(collection(db, 'events'));
        allEvents = allEventsSnapshot.docs
          .filter(doc => doc.data().type === 'class_lesson')
          .map(doc => ({ id: doc.id, ...doc.data() }));
      }

      // Filtruj eventy: tylko te z innych klas, które mają tego ucznia
      const eventsToUpdate = allEvents.filter(event => {
        const hasStudent = (event.students || event.assignedTo || []).includes(studentId);
        const isOtherClass = event.classId && event.classId !== excludeClassId;
        return hasStudent && isOtherClass;
      });

      console.log(`   Znaleziono ${eventsToUpdate.length} eventów do aktualizacji`);

      if (eventsToUpdate.length === 0) {
        console.log('   ⚠️ Brak eventów do aktualizacji');
        return;
      }

      // Usuń ucznia z każdego eventu
      const updatePromises = eventsToUpdate.map(async (event) => {
        const currentStudents = event.students || event.assignedTo || [];
        const updatedStudents = currentStudents.filter((id: string) => id !== studentId);

        if (updatedStudents.length !== currentStudents.length) {
          const eventRef = doc(db, 'events', event.id);
          await updateDoc(eventRef, {
            students: updatedStudents,
            assignedTo: updatedStudents
          });
          console.log(`   ✅ Usunięto ucznia z eventu ${event.id} (klasa: ${event.classId || 'brak'})`);
        }
      });

      await Promise.all(updatePromises);
      console.log(`✅ Usunięto ucznia z ${eventsToUpdate.length} eventów starych klas`);
    } catch (error: any) {
      console.error(`❌ Błąd podczas usuwania ucznia z eventów starych klas:`, error);
      // Nie rzucaj błędu - to nie jest krytyczne
    }
  };

  // Funkcja do aktualizacji listy studentów w eventach klasy
  const updateStudentsInClassEvents = async (classId: string, studentIds: string[], action: 'add' | 'remove') => {
    if (!classId || !studentIds || studentIds.length === 0) {
      return;
    }

    try {
      console.log(`🔄 Aktualizacja studentów w eventach klasy ${classId}: ${action} ${studentIds.length} studentów`);
      
      // Pobierz wszystkie eventy dla tej klasy
      let classEvents: any[] = [];
      
      // Metoda 1: Zapytanie z where
      try {
        const eventsQuery = query(
          collection(db, 'events'),
          where('classId', '==', classId),
          where('type', '==', 'class_lesson')
        );
        const eventsSnapshot = await getDocs(eventsQuery);
        classEvents = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (queryError) {
        // Metoda 2: Pobierz wszystkie eventy i filtruj
        try {
          const allEventsQuery = query(
            collection(db, 'events'),
            where('type', '==', 'class_lesson')
          );
          const allEventsSnapshot = await getDocs(allEventsQuery);
          classEvents = allEventsSnapshot.docs
            .filter(doc => doc.data().classId === classId)
            .map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (filterError) {
          // Metoda 3: Pobierz wszystkie eventy
          const allEventsSnapshot = await getDocs(collection(db, 'events'));
          classEvents = allEventsSnapshot.docs
            .filter(doc => {
              const data = doc.data();
              return data.classId === classId && data.type === 'class_lesson';
            })
            .map(doc => ({ id: doc.id, ...doc.data() }));
        }
      }

      console.log(`   Znaleziono ${classEvents.length} eventów do aktualizacji`);

      if (classEvents.length === 0) {
        console.log('   ⚠️ Brak eventów do aktualizacji');
        return;
      }

      // Zaktualizuj każdy event
      const updatePromises = classEvents.map(async (event) => {
        const currentStudents = event.students || event.assignedTo || [];
        let updatedStudents: string[];

        if (action === 'add') {
          // Dodaj studentów (unikaj duplikatów)
          updatedStudents = [...new Set([...currentStudents, ...studentIds])];
        } else {
          // Usuń studentów
          updatedStudents = currentStudents.filter((id: string) => !studentIds.includes(id));
        }

        // Zaktualizuj event tylko jeśli lista się zmieniła
        if (JSON.stringify(currentStudents.sort()) !== JSON.stringify(updatedStudents.sort())) {
          const eventRef = doc(db, 'events', event.id);
          await updateDoc(eventRef, {
            students: updatedStudents,
            assignedTo: updatedStudents // Kompatybilność ze starszą strukturą
          });
          console.log(`   ✅ Zaktualizowano event ${event.id}: ${currentStudents.length} → ${updatedStudents.length} studentów`);
        }
      });

      await Promise.all(updatePromises);
      console.log(`✅ Zaktualizowano ${classEvents.length} eventów dla klasy ${classId}`);
    } catch (error: any) {
      console.error(`❌ Błąd podczas aktualizacji studentów w eventach klasy ${classId}:`, error);
      // Nie rzucaj błędu - to nie jest krytyczne
    }
  };

  const removeAllClassEvents = async (classId: string) => {
    if (!classId) {
      console.error('❌ Brak classId - nie można usunąć eventów');
      return;
    }

    try {
      console.log(`🗑️ Usuwanie wszystkich eventów dla klasy: ${classId}`);
      
      let totalDeleted = 0;
      
      // Metoda 1: Spróbuj użyć zapytania z where (szybsze, jeśli działa)
      try {
        const eventsQuery = query(
          collection(db, 'events'),
          where('classId', '==', classId),
          where('type', '==', 'class_lesson')
        );

        const eventsSnapshot = await getDocs(eventsQuery);
        console.log(`   📊 Metoda 1: Znaleziono ${eventsSnapshot.docs.length} eventów przez zapytanie`);
        
        if (eventsSnapshot.docs.length > 0) {
          const deletePromises = eventsSnapshot.docs.map(eventDoc => {
            const eventData = eventDoc.data();
            console.log(`   🗑️ Usuwanie: ${eventDoc.id} - ${eventData.subject || eventData.title || 'bez tytułu'} (${eventData.day || '?'} ${eventData.time || '?'})`);
            return deleteDoc(eventDoc.ref);
          });
          
          await Promise.all(deletePromises);
          totalDeleted += eventsSnapshot.docs.length;
          console.log(`   ✅ Metoda 1: Usunięto ${eventsSnapshot.docs.length} eventów`);
        }
      } catch (queryError: any) {
        console.log(`   ⚠️ Metoda 1 nie zadziałała (może brak indeksu): ${queryError?.message}`);
      }
      
      // Metoda 2: Pobierz wszystkie eventy typu class_lesson i filtruj (zawsze działa)
      try {
        const allEventsQuery = query(
          collection(db, 'events'),
          where('type', '==', 'class_lesson')
        );
        const allEventsSnapshot = await getDocs(allEventsQuery);
        console.log(`   📊 Metoda 2: Znaleziono ${allEventsSnapshot.docs.length} eventów typu class_lesson`);
        
        const classEvents = allEventsSnapshot.docs.filter(doc => {
          const data = doc.data();
          const matches = data.classId === classId;
          return matches;
        });
        
        console.log(`   🎯 Metoda 2: Po filtrowaniu: ${classEvents.length} eventów dla klasy ${classId}`);
        
        if (classEvents.length > 0) {
          const deletePromises = classEvents.map(eventDoc => {
            const eventData = eventDoc.data();
            console.log(`   🗑️ Usuwanie: ${eventDoc.id} - ${eventData.subject || eventData.title || 'bez tytułu'} (${eventData.day || '?'} ${eventData.time || '?'})`);
            return deleteDoc(eventDoc.ref);
          });
          
          await Promise.all(deletePromises);
          totalDeleted += classEvents.length;
          console.log(`   ✅ Metoda 2: Usunięto ${classEvents.length} eventów`);
        }
      } catch (filterError: any) {
        console.error(`   ❌ Metoda 2 nie zadziałała: ${filterError?.message}`);
      }
      
      // Metoda 3: Ostatnia deska ratunku - pobierz WSZYSTKIE eventy i filtruj (bardzo wolne, ale zawsze działa)
      if (totalDeleted === 0) {
        try {
          console.log(`   🔍 Metoda 3: Pobieranie wszystkich eventów (może być wolne)...`);
          const allEventsSnapshot = await getDocs(collection(db, 'events'));
          console.log(`   📊 Metoda 3: Znaleziono ${allEventsSnapshot.docs.length} wszystkich eventów`);
          
          const classEvents = allEventsSnapshot.docs.filter(doc => {
            const data = doc.data();
            const matches = data.classId === classId && data.type === 'class_lesson';
            return matches;
          });
          
          console.log(`   🎯 Metoda 3: Po filtrowaniu: ${classEvents.length} eventów dla klasy ${classId}`);
          
          if (classEvents.length > 0) {
            const deletePromises = classEvents.map(eventDoc => deleteDoc(eventDoc.ref));
            await Promise.all(deletePromises);
            totalDeleted += classEvents.length;
            console.log(`   ✅ Metoda 3: Usunięto ${classEvents.length} eventów`);
          }
        } catch (lastResortError: any) {
          console.error(`   ❌ Metoda 3 nie zadziałała: ${lastResortError?.message}`);
        }
      }
      
      console.log(`✅ Usunięto łącznie ${totalDeleted} eventów dla klasy ${classId}`);
    } catch (error: any) {
      console.error('❌ Błąd podczas usuwania eventów klasy:', error);
      throw error;
    }
  };

  // Funkcja usuwania eventów dla usuniętych slotów planu zajęć (stara wersja - zachowana dla kompatybilności)
  const removeDeletedScheduleEvents = async (classId: string, oldSchedule: any[], newSchedule: any[]) => {
    // Używamy nowego podejścia - usuwamy wszystkie eventy i tworzymy nowe
    // To jest bardziej niezawodne niż próba znalezienia dokładnych różnic
    try {
      await removeAllClassEvents(classId);
    } catch (error) {
      console.error('Błąd podczas usuwania eventów:', error);
      // Nie przerywamy procesu, tylko logujemy błąd
    }
  };

  // Funkcja synchronizacji planu zajęć z kalendarzem
  const syncClassScheduleToCalendar = async (classData: any, students: string[]) => {
    if (!classData.schedule || classData.schedule.length === 0) {
      console.log('⚠️ Brak planu zajęć do synchronizacji');
      return;
    }

    if (!classData.id) {
      console.error('❌ Brak ID klasy - nie można zsynchronizować');
      return;
    }

    try {
      console.log(`🔄 Synchronizacja planu zajęć dla klasy: ${classData.id} (${classData.name})`);
      console.log(`   Liczba slotów: ${classData.schedule.length}`);
      console.log(`   Liczba studentów: ${students.length}`);
      
      // ZAWSZE usuń wszystkie istniejące eventy dla tej klasy przed tworzeniem nowych
      // To zapewnia, że nie będzie duplikatów i starych eventów
      console.log(`   🗑️ Usuwanie wszystkich istniejących eventów dla klasy ${classData.id}...`);
      try {
        await removeAllClassEvents(classData.id);
        console.log(`   ✅ Wszystkie stare eventy zostały usunięte`);
      } catch (removeError) {
        console.error(`   ⚠️ Błąd podczas usuwania starych eventów (kontynuuję):`, removeError);
        // Kontynuuj nawet jeśli usuwanie się nie powiodło - może nie było eventów do usunięcia
      }
      
      let createdCount = 0;
      let skippedCount = 0;
      
      // Dla każdego slotu planu zajęć
      console.log(`   📋 Przetwarzanie ${classData.schedule.length} slotów planu zajęć...`);
      console.log(`   📋 Pełna lista slotów:`, classData.schedule.map(s => ({
        day: s.day,
        time: s.time,
        subject: s.subject,
        room: s.room
      })));
      
      for (const scheduleSlot of classData.schedule) {
        // Sprawdź wymagane pola - day i time są wymagane, subject może być puste (będzie użyte "Lekcja")
        if (!scheduleSlot.day || !scheduleSlot.time) {
          console.log(`   ⏭️ Pomijam slot bez wymaganych danych (day/time):`, {
            day: scheduleSlot.day,
            time: scheduleSlot.time,
            subject: scheduleSlot.subject,
            room: scheduleSlot.room
          });
          skippedCount++;
          continue;
        }
        
        // Jeśli nie ma subject, użyj domyślnego
        const subject = scheduleSlot.subject || classData.subject || 'Lekcja';
        
        console.log(`   ✅ Przetwarzam slot: ${subject} - ${scheduleSlot.day} ${scheduleSlot.time}`);

        // Konwertuj dzień tygodnia na datę (następny występ tego dnia)
        const dayMapping = {
          'Poniedziałek': 1,
          'Wtorek': 2,
          'Środa': 3,
          'Czwartek': 4,
          'Piątek': 5
        };

        const targetDay = dayMapping[scheduleSlot.day as keyof typeof dayMapping];
        if (!targetDay) {
          console.log(`   ⏭️ Nieznany dzień tygodnia: ${scheduleSlot.day}`);
          skippedCount++;
          continue;
        }

        // Znajdź następny występ tego dnia tygodnia
        const today = new Date();
        const daysUntilTarget = (targetDay - today.getDay() + 7) % 7;
        const nextOccurrence = new Date(today);
        nextOccurrence.setDate(today.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));

        // Utwórz wydarzenie kalendarza (subject już jest zdefiniowane wcześniej)
        const eventData = {
          title: `${subject} - ${classData.name}`,
          description: `Lekcja dla klasy ${classData.name}`,
          type: 'class_lesson',
          classId: classData.id,
          className: classData.name,
          subject: subject,
          room: scheduleSlot.room || '',
          day: scheduleSlot.day,
          time: scheduleSlot.time,
          students: students, // Lista studentów przypisanych do klasy
          assignedTo: students, // Kompatybilność ze starszą strukturą
          date: nextOccurrence.toISOString().split('T')[0], // YYYY-MM-DD
          startTime: scheduleSlot.time,
          endTime: calculateEndTime(scheduleSlot.time, 45), // 45 minut lekcji
          createdBy: user?.email,
          createdAt: serverTimestamp(),
          isRecurring: true, // Oznaczenie że to powtarzające się zajęcia
          recurrenceType: 'weekly'
        };

        
        // Dodaj wydarzenie do kolekcji events
        await addDoc(collection(db, 'events'), eventData);
        createdCount++;
        console.log(`   ✅ Utworzono event: ${scheduleSlot.subject} - ${scheduleSlot.day} ${scheduleSlot.time}`);
      }

      console.log(`✅ Synchronizacja zakończona: utworzono ${createdCount} eventów, pominięto ${skippedCount} slotów`);
    } catch (error) {
      console.error('❌ Błąd podczas synchronizacji planu zajęć:', error);
      throw error;
    }
  };

  // Funkcja pomocnicza do obliczania czasu zakończenia lekcji
  const calculateEndTime = (startTime: string, durationMinutes: number) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);
    
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
    return `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
  };

  const resetStudentForm = () => {
    setStudentFormData({
      studentEmail: ''
    });
    setSelectedStudents([]);
    setStudentSearchTerm('');
    setShowStudentDropdown(false);
  };

  // Multi-selection functions
  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const selectAllStudents = () => {
    const availableStudents = students
      .filter(student => !selectedClass?.students?.includes(student.id))
      .filter(student => 
        student.name?.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(studentSearchTerm.toLowerCase())
      )
      .map(student => student.id);
    
    setSelectedStudents(availableStudents);
  };

  const clearAllSelections = () => {
    setSelectedStudents([]);
  };

  const handleAddMultipleStudentsToClass = async () => {
    if (!selectedClass || selectedStudents.length === 0) {
      setError('Wybierz przynajmniej jednego ucznia.');
      return;
    }

    try {
      const classRef = doc(db, 'classes', selectedClass.id);
      
      // Dodaj wszystkich wybranych uczniów do klasy
      await updateDoc(classRef, {
        students: arrayUnion(...selectedStudents)
      });

      // Zaktualizuj selectedClass lokalnie dla natychmiastowej aktualizacji UI
      const updatedStudents = [...(selectedClass.students || []), ...selectedStudents];
      setSelectedClass({
        ...selectedClass,
        students: updatedStudents
      });

      // WAŻNE: Usuń nowych studentów z eventów WSZYSTKICH innych klas
      // To zapewnia, że nie będą widzieć starych lekcji
      for (const studentId of selectedStudents) {
        try {
          await removeStudentFromAllOtherClassEvents(studentId, selectedClass.id);
        } catch (error) {
          console.error(`Błąd podczas usuwania ucznia ${studentId} z starych klas:`, error);
        }
      }

      // Zaktualizuj eventy klasy - dodaj nowych studentów do istniejących eventów
      try {
        await updateStudentsInClassEvents(selectedClass.id, selectedStudents, 'add');
      } catch (error) {
        console.error('Błąd podczas aktualizacji studentów w eventach:', error);
      }

      // Synchronizuj plan zajęć klasy z kalendarzem dla nowych studentów
      // To utworzy nowe eventy jeśli klasa ma plan zajęć
      try {
        await syncClassScheduleToCalendar(selectedClass, updatedStudents);
      } catch {
      }

      setSuccess(`${selectedStudents.length} uczniów zostało dodanych do klasy!`);
      resetStudentForm();
      
      // Odśwież listę klas (wymuś odświeżenie bez cache)
      await fetchClasses(true);
      
      // Poczekaj chwilę i zaktualizuj selectedClass z najnowszymi danymi z Firestore
      // Używamy setTimeout aby upewnić się, że stan classes został zaktualizowany
      setTimeout(async () => {
        try {
          // Pobierz najnowsze dane klasy bezpośrednio z Firestore
          const classRef = doc(db, 'classes', selectedClass.id);
          const classDoc = await getDoc(classRef);
          
          if (classDoc.exists()) {
            const updatedClassData = { id: classDoc.id, ...classDoc.data() } as Class;
            console.log('✅ Zaktualizowano selectedClass z Firestore:', updatedClassData);
            setSelectedClass(updatedClassData);
          } else {
            console.error('❌ Klasa nie istnieje w Firestore!');
          }
        } catch (error) {
          console.error('❌ Błąd podczas aktualizacji selectedClass:', error);
          // Fallback: użyj danych z lokalnego stanu classes
          const updatedClass = classes.find(c => c.id === selectedClass.id);
          if (updatedClass) {
            setSelectedClass(updatedClass);
          }
        }
      }, 200);
    } catch (error: any) {
      console.error('Error adding students to class:', error);
      setError(`Wystąpił błąd podczas dodawania uczniów: ${error?.message || 'Nieznany błąd'}`);
    }
  };

  const resetCourseForm = () => {
    setCourseFormData({
      courseId: ''
    });
  };

  // Funkcja do synchronizacji wszystkich klas z kalendarzem
  const syncAllClassesToCalendar = async () => {
    try {
      
      for (const classItem of classes) {
        if (classItem.schedule && classItem.schedule.length > 0 && classItem.students && classItem.students.length > 0) {
          await syncClassScheduleToCalendar(classItem, classItem.students);
        }
      }
      
      setSuccess('Wszystkie klasy zostały zsynchronizowane z kalendarzem!');
    } catch {
      setError('Wystąpił błąd podczas synchronizacji klas z kalendarzem.');
    }
  };

  // Funkcja parsowania CSV i importu planu zajęć dla wybranej klasy
  const parseCSVAndImportSchedule = async (csvTextInput: string, classId: string) => {
    if (!classId) {
      setError('Wybierz klasę do importu.');
      return;
    }

    const selectedClassData = classes.find(c => c.id === classId);
    if (!selectedClassData) {
      setError('Nie znaleziono wybranej klasy.');
      return;
    }

    setImportLoading(true);
    setImportProgress('Rozpoczynam parsowanie pliku CSV...');
    setError(null);
    setSuccess(null);

    try {
      const lines = csvTextInput.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      // Mapowanie godzin do formatu timeSlots
      const timeSlotMapping: Record<string, string> = {
        '8:00 - 8:45': '8:00',
        '8:45 - 9:30': '8:45',
        '10:00 - 10:45': '10:00',
        '10:45 - 11:30': '10:45',
        '11:35 - 12:20': '11:35',
        '12:20 - 13:05': '12:20',
        '13:55 - 14:40': '13:55',
        '14:40 - 15:25': '14:40',
        '15:30 - 16:15': '15:30',
        '16:15 - 17:00': '16:15'
      };

      const schedule: Array<{day: string, time: string, subject: string, room: string}> = [];
      let headerRowIndex = -1;
      let currentSection = 0; // 0 = pierwsza sekcja, 1 = druga sekcja

      // Znajdź sekcję z planem zajęć (używamy pierwszej znalezionej sekcji)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Szukaj wiersza z nagłówkami dni tygodnia
        if (line.includes('BLOK') && (line.includes('PONIEDZIAŁEK') || line.includes('WTOREK'))) {
          headerRowIndex = i;
          // Określ, która sekcja (pierwsza czy druga)
          const columns = line.split(',');
          if (columns.length > 7) {
            currentSection = 1; // Druga sekcja zaczyna się po kolumnie 7
          }
          break; // Używamy pierwszej znalezionej sekcji
        }
      }

      if (headerRowIndex === -1) {
        throw new Error('Nie znaleziono nagłówka z dniami tygodnia w pliku CSV.');
      }

      setImportProgress('Parsuję dane z CSV...');

      // Parsuj dane zaczynając od wiersza po nagłówku
      for (let i = headerRowIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        
        // Sprawdź czy to wiersz z danymi (zawiera godzinę)
        const timeMatch = line.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
        if (timeMatch) {
          const timeRange = `${timeMatch[1]} - ${timeMatch[2]}`;
          const startTime = timeSlotMapping[timeRange];
          
          if (!startTime) {
            continue; // Pomiń nieznane przedziały czasowe
          }

          // Parsuj komórki CSV (uwzględniając cudzysłowy)
          const cells: string[] = [];
          let currentCell = '';
          let inQuotes = false;
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              cells.push(currentCell.trim());
              currentCell = '';
            } else {
              currentCell += char;
            }
          }
          cells.push(currentCell.trim()); // Ostatnia komórka

          // Mapuj kolumny do dni tygodnia
          // W pierwszej sekcji: kolumny 2-6 (indeksy 2,3,4,5,6)
          // W drugiej sekcji: kolumny 9-13 (indeksy 9,10,11,12,13)
          const dayColumns = currentSection === 0 
            ? [2, 3, 4, 5, 6] 
            : [9, 10, 11, 12, 13];
          
          const dayNames = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek'];

          dayColumns.forEach((colIndex, dayIndex) => {
            if (colIndex < cells.length) {
              let subjectText = cells[colIndex].trim();
              
              // Pomiń puste komórki, gwiazdki i separatory
              if (!subjectText || subjectText === '*' || subjectText === '' || subjectText === ',') {
                return;
              }

              // Wyciągnij przedmiot i salę (format: "PRZEDMIOT SALA" lub "PRZEDMIOT\nSALA")
              let subject = subjectText;
              let room = '';
              
              // Usuń znaki nowej linii i cudzysłowy
              subject = subject.replace(/"/g, '').replace(/\n/g, ' ').trim();
              
              // Sprawdź czy jest informacja o sali (np. "MATEMATYKA B8")
              const roomMatch = subject.match(/^(.+?)\s+([A-Z]\d+)$/);
              if (roomMatch) {
                subject = roomMatch[1].trim();
                room = roomMatch[2].trim();
              } else {
                // Spróbuj znaleźć salę w formacie "PRZEDMIOT\nSALA"
                const parts = subject.split(/\s+/);
                if (parts.length > 1 && /^[A-Z]\d+$/.test(parts[parts.length - 1])) {
                  room = parts.pop() || '';
                  subject = parts.join(' ');
                }
              }

              // Normalizuj nazwę przedmiotu
              subject = subject.replace(/\s+/g, ' ').trim();

              if (subject && subject.length > 0) {
                schedule.push({
                  day: dayNames[dayIndex],
                  time: startTime,
                  subject: subject,
                  room: room
                });
              }
            }
          });
        }
      }

      console.log(`📊 Sparsowany plan zajęć dla klasy ${selectedClassData.name}:`, schedule);

      if (schedule.length === 0) {
        throw new Error('Nie znaleziono żadnych zajęć w pliku CSV. Sprawdź format pliku.');
      }

      // Aktualizuj klasę w Firestore
      setImportProgress(`Znaleziono ${schedule.length} slotów zajęć. Aktualizuję klasę ${selectedClassData.name}...`);
      
      // Usuń stare eventy przed aktualizacją
      try {
        await removeAllClassEvents(selectedClassData.id);
      } catch (error) {
        console.error(`Błąd podczas usuwania eventów dla klasy ${selectedClassData.name}:`, error);
      }

      // Zaktualizuj plan zajęć w Firestore
      const classRef = doc(db, 'classes', selectedClassData.id);
      await updateDoc(classRef, {
        schedule: schedule,
        updated_at: serverTimestamp()
      });

      // Synchronizuj z kalendarzem
      setImportProgress('Synchronizuję z kalendarzem...');
      try {
        await syncClassScheduleToCalendar(
          { ...selectedClassData, schedule: schedule },
          selectedClassData.students || []
        );
      } catch (error) {
        console.error(`Błąd podczas synchronizacji klasy ${selectedClassData.name}:`, error);
      }

      // Odśwież listę klas
      await fetchClasses(true);

      setImportLoading(false);
      setImportProgress('');
      setShowImportCSVModal(false);
      setCsvText('');
      setSelectedClassForImport('');

      setSuccess(`Pomyślnie zaimportowano plan zajęć dla klasy ${selectedClassData.name} (${schedule.length} slotów)!`);

    } catch (error: any) {
      console.error('Błąd podczas importu CSV:', error);
      setImportLoading(false);
      setImportProgress('');
      setError(`Błąd podczas importu CSV: ${error?.message || 'Nieznany błąd'}`);
    }
  };

  // Obsługa wczytania pliku CSV
  const handleCSVFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Proszę wybrać plik CSV.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvContent = e.target?.result as string;
      if (csvContent) {
        setCsvText(csvContent);
      }
    };
    reader.onerror = () => {
      setError('Błąd podczas odczytu pliku.');
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Obsługa importu CSV dla wybranej klasy
  const handleImportCSV = async () => {
    if (!selectedClassForImport) {
      setError('Wybierz klasę do importu.');
      return;
    }
    if (!csvText.trim()) {
      setError('Wklej lub wczytaj plik CSV.');
      return;
    }
    await parseCSVAndImportSchedule(csvText, selectedClassForImport);
  };

  const handleRemoveStudentFromClass = async (studentId: string) => {
    if (!selectedClass) return;

    try {
      console.log('🗑️ Usuwanie ucznia z klasy:', studentId, 'Klasa:', selectedClass.id);
      
      const classRef = doc(db, 'classes', selectedClass.id);
      await updateDoc(classRef, {
        students: arrayRemove(studentId)
      });

      // Zaktualizuj lokalny stan selectedClass natychmiast
      const updatedStudents = (selectedClass.students || []).filter(id => id !== studentId);
      setSelectedClass({
        ...selectedClass,
        students: updatedStudents
      });

      console.log('✅ Uczeń usunięty z klasy. Zaktualizowana lista:', updatedStudents);

      // Usuń ucznia z wszystkich eventów tej klasy
      try {
        await updateStudentsInClassEvents(selectedClass.id, [studentId], 'remove');
        console.log('✅ Uczeń usunięty z eventów klasy');
      } catch (error) {
        console.error('Błąd podczas usuwania ucznia z eventów:', error);
      }

      // Invalidate cache
      sessionStorage.removeItem(`teacher_classes_all`);
      
      // Odśwież listę klas (wymuś odświeżenie bez cache)
      await fetchClasses(true);
      
      setSuccess('Uczeń został usunięty z klasy!');
    } catch (error: any) {
      console.error('❌ Błąd podczas usuwania ucznia:', error);
      setError(`Wystąpił błąd podczas usuwania ucznia: ${error?.message || 'Nieznany błąd'}`);
    }
  };

  const handleAssignCourseToClass = async () => {
    if (!selectedClass || !courseFormData.courseId) {
      setError('Wybierz kurs.');
      return;
    }

    try {
      // Sprawdź czy kurs nie jest już przypisany
      if (selectedClass.assignedCourses?.includes(courseFormData.courseId)) {
        setError('Kurs jest już przypisany do tej klasy.');
        return;
      }

      // Dodaj kurs do klasy
      const classRef = doc(db, 'classes', selectedClass.id);
      await updateDoc(classRef, {
        assignedCourses: arrayUnion(courseFormData.courseId)
      });

      // Dodaj wszystkich uczniów z klasy do kursu
      if (selectedClass.students && selectedClass.students.length > 0) {
        const courseRef = doc(db, 'courses', courseFormData.courseId);
        await updateDoc(courseRef, {
          assignedUsers: arrayUnion(...selectedClass.students)
        });
      }

      setSuccess('Kurs został przypisany do klasy i uczniowie zostali automatycznie dodani!');
      resetCourseForm();
      fetchClasses();
    } catch {
      setError('Wystąpił błąd podczas przypisywania kursu.');
    }
  };

  const handleRemoveCourseFromClass = async (courseId: string) => {
    if (!selectedClass) return;

    try {
      const classRef = doc(db, 'classes', selectedClass.id);
      await updateDoc(classRef, {
        assignedCourses: arrayRemove(courseId)
      });

      setSuccess('Kurs został usunięty z klasy!');
      fetchClasses();
    } catch {
      setError('Wystąpił błąd podczas usuwania kursu.');
    }
  };

  const openEditModal = (cls: Class) => {
    setSelectedClass(cls);
    setFormData({
      name: cls.name,
      description: cls.description,
      grade_level: cls.grade_level,
      subject: cls.subject,
      max_students: cls.max_students,
      academic_year: cls.academic_year,
      schedule: cls.schedule || [] // ✅ Ładuj istniejący plan zajęć
    });
    setShowEditModal(true);
  };

  // Memoized filtered classes
  const filteredClasses = useMemo(() => {
    if (!searchTerm.trim()) return classes;
    
    const term = searchTerm.toLowerCase();
    return classes.filter((cls) => {
      return (
        cls.name.toLowerCase().includes(term) ||
        cls.grade_level.toString().includes(term) ||
        (cls.subject || '').toLowerCase().includes(term)
      );
    });
  }, [classes, searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-blue-50 w-full max-w-full overflow-hidden flex flex-col" style={{ maxWidth: '100vw' }}>
      {/* Header - Fixed */}
      <div className="bg-white/90 backdrop-blur-xl border-b border-white/30 shadow-sm flex-shrink-0">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => window.location.href = '/homelogin/teacher'}
              className="md:hidden flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Powrót</span>
            </button>

            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-blue-600">
                Zarządzanie Klasami
              </h1>
              <p className="text-gray-600 mt-1 font-medium">Organizuj swoje klasy i uczniów</p>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowImportCSVModal(true)}
                className="flex items-center gap-3 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-semibold"
              >
                <Upload className="h-5 w-5" />
                <span className="hidden sm:inline">Importuj Plan Zajęć (CSV)</span>
                <span className="sm:hidden">Import CSV</span>
              </button>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-semibold"
              >
                <Plus className="h-5 w-5" />
                <span>Utwórz Klasę</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-hidden flex flex-col px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6 flex-1 flex flex-col min-h-0">
          {/* Stats Cards - Fixed */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-shrink-0">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <School className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{classes.length}</p>
                  <p className="text-sm text-gray-600 font-medium">Utworzonych klas</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {classes.reduce((acc, cls) => acc + cls.students.length, 0)}
                  </p>
                  <p className="text-sm text-gray-600 font-medium">Przypisanych uczniów</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {new Set(classes.map(cls => cls.subject)).size}
                  </p>
                  <p className="text-sm text-gray-600 font-medium">Przedmiotów</p>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {classes.reduce((acc, cls) => acc + (cls.assignedCourses?.length || 0), 0)}
                  </p>
                  <p className="text-sm text-gray-600 font-medium">Przypisanych kursów</p>
                </div>
              </div>
            </div>
          </div>

          {/* Search - Fixed */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-sm flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Wyszukaj klasę po nazwie, poziomie lub przedmiocie..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 text-gray-700 bg-white hover:border-gray-300 font-medium"
              />
            </div>
          </div>

          {/* Error/Success Messages - Fixed */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-6 py-4 rounded-xl flex items-center gap-3 flex-shrink-0">
              <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600 text-sm">!</span>
              </div>
              <span className="font-medium">{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border-2 border-green-200 text-green-700 px-6 py-4 rounded-xl flex items-center gap-3 flex-shrink-0">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-sm">✓</span>
              </div>
              <span className="font-medium">{success}</span>
            </div>
          )}

          {/* Synchronization Button - Fixed */}
          <div className="flex justify-center flex-shrink-0">
            <button
              onClick={syncAllClassesToCalendar}
              className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium border border-green-200"
              title="Synchronizuj plan zajęć wszystkich klas z kalendarzem"
            >
              <Calendar className="h-4 w-4" />
              Synchronizuj z kalendarzem
            </button>
          </div>

          {/* Classes Grid - Scrollable */}
          <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 min-h-0">
            {filteredClasses.map((cls) => (
              <div key={cls.id} className="bg-white/90 backdrop-blur-sm rounded-2xl border border-white/30 p-4 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 transform hover:-translate-y-1 group h-80 flex flex-col">
                {/* Class Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <School className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => openEditModal(cls)}
                      className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Edit className="h-3 w-3" />
                    </button>
                    <button 
                      onClick={() => handleDeleteClass(cls.id)}
                      className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Class Info */}
                <div className="mb-4 flex-1 min-h-0">
                  <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {cls.name}
                  </h3>
                  <p className="text-xs text-gray-600 font-medium mb-4">Klasa {cls.grade_level} • {cls.subject}</p>
                </div>

                {/* Stats */}
                <div className="mb-6 flex-shrink-0">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-xs text-gray-600 font-medium">Uczniowie</span>
                    <span className="text-sm font-bold text-blue-600">{cls.students?.length || 0}/{cls.max_students}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-auto flex-shrink-0 h-10">
                  <button 
                    onClick={() => {
                      setSelectedClass(cls);
                      setShowManageStudentsModal(true);
                    }}
                    className="flex-1 bg-blue-600 text-white py-2 px-2 rounded-lg hover:bg-blue-700 transition-all duration-300 font-medium text-xs shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    Zarządzaj
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedClass(cls);
                      setShowAssignCourseModal(true);
                    }}
                    className="w-10 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-all duration-300 border border-green-200 hover:border-green-300 font-medium flex items-center justify-center"
                  >
                    <BookOpen className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {filteredClasses.length === 0 && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/30 shadow-sm p-12 text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <School className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                {searchTerm ? 'Nie znaleziono klas' : 'Brak utworzonych klas'}
              </h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                {searchTerm 
                  ? 'Spróbuj zmienić kryteria wyszukiwania lub wyczyść filtr.'
                  : 'Nie masz jeszcze utworzonych klas. Zacznij od utworzenia pierwszej klasy.'
                }
              </p>
              {!searchTerm && (
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="bg-blue-600 text-white px-8 py-4 rounded-xl hover:bg-blue-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  Utwórz pierwszą klasę
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Class Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Plus className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Utwórz Nową Klasę</h3>
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nazwa klasy *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="np. 3A, 1B, 2C"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Poziom *
                  </label>
                  <select
                    value={formData.grade_level}
                    onChange={(e) => setFormData(prev => ({ ...prev, grade_level: parseInt(e.target.value) }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  >
                    <option value="">Wybierz poziom</option>
                    <option value="1">Klasa 1</option>
                    <option value="2">Klasa 2</option>
                    <option value="3">Klasa 3</option>
                    <option value="4">Klasa 4</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Przedmiot/Kurs *
                </label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  <option value="">Wybierz przedmiot/kurs</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.title}>
                      {course.title}
                    </option>
                  ))}
                </select>
                {courses.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    Brak dostępnych kursów. Utwórz najpierw kurs w sekcji &quot;Moje Kursy&quot;.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Opis klasy
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  rows={3}
                  placeholder="Krótki opis klasy..."
                />
              </div>

              {/* Schedule Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-semibold text-gray-700">
                    Plan zajęć
                  </label>
                  <button
                    type="button"
                    onClick={addScheduleSlot}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    <Plus className="h-4 w-4" />
                    Dodaj zajęcia
                  </button>
                </div>
                
                <div className="space-y-3">
                  {sortedSchedule.map((slot, sortedIndex) => {
                    // Znajdź oryginalny indeks w formData.schedule
                    const originalIndex = formData.schedule.findIndex(
                      (s, idx) => 
                        s.day === slot.day && 
                        s.time === slot.time && 
                        s.subject === slot.subject && 
                        s.room === slot.room &&
                        // Upewnij się, że to ten sam slot (sprawdź wszystkie pola)
                        JSON.stringify(s) === JSON.stringify(slot)
                    );
                    // Jeśli nie znaleziono dokładnego dopasowania, użyj sortedIndex jako fallback
                    const index = originalIndex !== -1 ? originalIndex : sortedIndex;
                    
                    return (
                      <div key={`${slot.day}-${slot.time}-${index}`} className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Dzień tygodnia</label>
                          <select
                            value={slot.day || ''}
                            onChange={(e) => updateScheduleSlot(index, 'day', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="">Wybierz dzień</option>
                            <option value="Poniedziałek">Poniedziałek</option>
                            <option value="Wtorek">Wtorek</option>
                            <option value="Środa">Środa</option>
                            <option value="Czwartek">Czwartek</option>
                            <option value="Piątek">Piątek</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Godzina</label>
                          <select
                            value={slot.time || ''}
                            onChange={(e) => updateScheduleSlot(index, 'time', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="">Wybierz godzinę</option>
                            {timeSlots.map((slotOption) => (
                              <option key={slotOption.startTime} value={slotOption.startTime}>
                                {slotOption.display}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Przedmiot</label>
                          <input
                            type="text"
                            value={slot.subject || ''}
                            onChange={(e) => updateScheduleSlot(index, 'subject', e.target.value)}
                            placeholder="np. WF, Matematyka, Język polski"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Sala</label>
                          <input
                            type="text"
                            value={slot.room || ''}
                            onChange={(e) => updateScheduleSlot(index, 'room', e.target.value)}
                            placeholder="np. Sala 101, WF"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => removeScheduleSlot(index)}
                            className="w-full flex items-center justify-center px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                            title="Usuń zajęcia"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  
                  {formData.schedule.length === 0 && (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                      <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium">Brak zaplanowanych zajęć</p>
                      <p className="text-sm mt-2">Dodaj zajęcia, aby stworzyć plan dla tej klasy</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateClass}
                  className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-xl hover:bg-blue-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  Utwórz Klasę
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium border border-gray-200 hover:border-gray-300"
                >
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Class Modal */}
      {showEditModal && selectedClass && (
        <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Edit className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Edytuj Klasę</h3>
              </div>
              <button 
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedClass(null);
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nazwa klasy *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="np. 3A, 1B, 2C"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Poziom *
                  </label>
                  <select
                    value={formData.grade_level}
                    onChange={(e) => setFormData(prev => ({ ...prev, grade_level: parseInt(e.target.value) }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  >
                    <option value="">Wybierz poziom</option>
                    <option value="1">Klasa 1</option>
                    <option value="2">Klasa 2</option>
                    <option value="3">Klasa 3</option>
                    <option value="4">Klasa 4</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Przedmiot/Kurs *
                </label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  <option value="">Wybierz przedmiot/kurs</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.title}>
                      {course.title}
                    </option>
                  ))}
                </select>
                {courses.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    Brak dostępnych kursów. Utwórz najpierw kurs w sekcji &quot;Moje Kursy&quot;.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Opis klasy
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  rows={3}
                  placeholder="Krótki opis klasy..."
                />
              </div>

              {/* Schedule Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-semibold text-gray-700">
                    Plan zajęć
                  </label>
                  <button
                    type="button"
                    onClick={addScheduleSlot}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    <Plus className="h-4 w-4" />
                    Dodaj zajęcia
                  </button>
                </div>
                
                <div className="space-y-3">
                  {sortedSchedule.map((slot, sortedIndex) => {
                    // Znajdź oryginalny indeks w formData.schedule
                    const originalIndex = formData.schedule.findIndex(
                      (s, idx) => 
                        s.day === slot.day && 
                        s.time === slot.time && 
                        s.subject === slot.subject && 
                        s.room === slot.room &&
                        // Upewnij się, że to ten sam slot (sprawdź wszystkie pola)
                        JSON.stringify(s) === JSON.stringify(slot)
                    );
                    // Jeśli nie znaleziono dokładnego dopasowania, użyj sortedIndex jako fallback
                    const index = originalIndex !== -1 ? originalIndex : sortedIndex;
                    
                    return (
                      <div key={`${slot.day}-${slot.time}-${index}`} className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Dzień tygodnia</label>
                          <select
                            value={slot.day || ''}
                            onChange={(e) => updateScheduleSlot(index, 'day', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="">Wybierz dzień</option>
                            <option value="Poniedziałek">Poniedziałek</option>
                            <option value="Wtorek">Wtorek</option>
                            <option value="Środa">Środa</option>
                            <option value="Czwartek">Czwartek</option>
                            <option value="Piątek">Piątek</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Godzina</label>
                          <select
                            value={slot.time || ''}
                            onChange={(e) => updateScheduleSlot(index, 'time', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="">Wybierz godzinę</option>
                            {timeSlots.map((slotOption) => (
                              <option key={slotOption.startTime} value={slotOption.startTime}>
                                {slotOption.display}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Przedmiot</label>
                          <input
                            type="text"
                            value={slot.subject || ''}
                            onChange={(e) => updateScheduleSlot(index, 'subject', e.target.value)}
                            placeholder="np. WF, Matematyka, Język polski"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Sala</label>
                          <input
                            type="text"
                            value={slot.room || ''}
                            onChange={(e) => updateScheduleSlot(index, 'room', e.target.value)}
                            placeholder="np. Sala 101, WF"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => removeScheduleSlot(index)}
                            className="w-full flex items-center justify-center px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                            title="Usuń zajęcia"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  
                  {formData.schedule.length === 0 && (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                      <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium">Brak zaplanowanych zajęć</p>
                      <p className="text-sm mt-2">Dodaj zajęcia, aby stworzyć plan dla tej klasy</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col gap-3 pt-4">
                <div className="flex gap-3">
                  <button
                    onClick={handleEditClass}
                    className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-xl hover:bg-blue-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    Zaktualizuj Klasę
                  </button>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedClass(null);
                      resetForm();
                    }}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium border border-gray-200 hover:border-gray-300"
                  >
                    Anuluj
                  </button>
                </div>
                {selectedClass && (
                  <>
                    <button
                      onClick={async () => {
                        if (!confirm('Czy na pewno chcesz usunąć WSZYSTKIE eventy kalendarza dla tej klasy? To usunie wszystkie lekcje z planów uczniów.')) {
                          return;
                        }
                        try {
                          setError(null);
                          setSuccess(null);
                          console.log('🧹 Ręczne czyszczenie eventów dla klasy:', selectedClass.id);
                          await removeAllClassEvents(selectedClass.id);
                          setSuccess('Wszystkie eventy dla klasy zostały usunięte. Teraz zaktualizuj klasę, aby utworzyć nowe eventy.');
                          // Odśwież dane klasy
                          await fetchClasses();
                        } catch (error: any) {
                          console.error('Błąd podczas czyszczenia eventów:', error);
                          setError(`Błąd podczas czyszczenia eventów: ${error?.message || 'Nieznany błąd'}`);
                        }
                      }}
                      className="w-full bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium mb-2"
                    >
                      🧹 Wyczyść wszystkie eventy kalendarza dla tej klasy
                    </button>
                    <button
                      onClick={async () => {
                        if (!selectedClass) return;
                        try {
                          setLoading(true);
                          setSuccess(null);
                          setError(null);
                          console.log('🔄 Ręczna synchronizacja planu zajęć dla klasy:', selectedClass.name);
                          
                          // Pobierz najnowsze dane klasy z Firestore
                          const classRef = doc(db, 'classes', selectedClass.id);
                          const classDoc = await getDoc(classRef);
                          
                          if (!classDoc.exists()) {
                            setError('Klasa nie istnieje!');
                            return;
                          }
                          
                          const latestClassData = { id: classDoc.id, ...classDoc.data() };
                          const students = latestClassData.students || [];
                          
                          console.log(`   Plan zajęć ma ${latestClassData.schedule?.length || 0} slotów`);
                          console.log(`   Klasa ma ${students.length} studentów`);
                          
                          // Synchronizuj plan zajęć
                          await syncClassScheduleToCalendar(latestClassData, students);
                          
                          // Odśwież dane klasy
                          await fetchClasses(true);
                          
                          // Zaktualizuj selectedClass
                          const updatedClass = classes.find(c => c.id === selectedClass.id);
                          if (updatedClass) {
                            setSelectedClass(updatedClass);
                          }
                          
                          setSuccess(`Plan zajęć został zsynchronizowany! Utworzono eventy dla ${latestClassData.schedule?.length || 0} slotów.`);
                        } catch (error: any) {
                          console.error('Błąd podczas synchronizacji:', error);
                          setError(`Błąd podczas synchronizacji: ${error?.message || 'Nieznany błąd'}`);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                    >
                      🔄 Zsynchronizuj plan zajęć z kalendarzem
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Students Modal */}
      {showManageStudentsModal && selectedClass && (
        <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Zarządzaj Uczniami - {selectedClass.name}</h3>
              </div>
              <button 
                onClick={() => {
                  setShowManageStudentsModal(false);
                  setSelectedClass(null);
                  resetStudentForm();
                }}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors group"
              >
                <span className="text-gray-500 group-hover:text-gray-700 text-lg font-medium">×</span>
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Add Students Form with Multi-selection */}
              <div className="bg-gray-50 p-4 rounded-xl">
                <h4 className="text-lg font-semibold mb-4">Dodaj uczniów do klasy</h4>
                
                {/* Search Input */}
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="Wyszukaj uczniów po nazwie lub emailu..."
                    value={studentSearchTerm}
                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                    onFocus={() => setShowStudentDropdown(true)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Selection Controls */}
                {selectedStudents.length > 0 && (
                  <div className="flex items-center justify-between mb-4 p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium text-blue-800">
                      Wybrano: {selectedStudents.length} uczniów
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllStudents}
                        className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                      >
                        Zaznacz wszystkich
                      </button>
                      <button
                        onClick={clearAllSelections}
                        className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                      >
                        Wyczyść
                      </button>
                    </div>
                  </div>
                )}

                {/* Students Dropdown */}
                {showStudentDropdown && (
                  <div ref={dropdownRef} className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl bg-white shadow-lg mb-4">
                    {students
                      .filter(student => !selectedClass.students?.includes(student.id))
                      .filter(student => 
                        student.name?.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
                        student.email.toLowerCase().includes(studentSearchTerm.toLowerCase())
                      )
                      .map(student => (
                        <div
                          key={student.id}
                          className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          onClick={() => toggleStudentSelection(student.id)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedStudents.includes(student.id)}
                            onChange={() => toggleStudentSelection(student.id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {student.name || 'Brak nazwy'}
                            </p>
                            <p className="text-sm text-gray-500">{student.email}</p>
                          </div>
                        </div>
                      ))}
                    
                    {students
                      .filter(student => !selectedClass.students?.includes(student.id))
                      .filter(student => 
                        student.name?.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
                        student.email.toLowerCase().includes(studentSearchTerm.toLowerCase())
                      ).length === 0 && (
                      <div className="p-4 text-center text-gray-500">
                        <p>Brak dostępnych uczniów</p>
                        <p className="text-sm">Wszyscy uczniowie są już w tej klasie</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Add Button */}
                <div className="flex gap-3">
                  <button
                    onClick={handleAddMultipleStudentsToClass}
                    disabled={selectedStudents.length === 0}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 font-semibold"
                  >
                    Dodaj wybranych ({selectedStudents.length})
                  </button>
                  <button
                    onClick={() => setShowStudentDropdown(!showStudentDropdown)}
                    className="px-4 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:border-gray-300 transition-all duration-200"
                  >
                    {showStudentDropdown ? 'Ukryj listę' : 'Pokaż listę'}
                  </button>
                </div>
              </div>

              {/* Students List */}
              <div>
                <h4 className="text-lg font-semibold mb-4">Uczniowie w klasie ({selectedClass.students?.length || 0})</h4>
                {selectedClass.students && selectedClass.students.length > 0 ? (
                  <div className="space-y-2">
                    {selectedClass.students.map(studentId => {
                      const student = students.find(s => s.id === studentId);
                      // Jeśli uczeń nie jest w liście students, pobierz jego dane z Firestore
                      if (!student) {
                        // Możemy wyświetlić tylko ID, ale lepiej pobrać dane
                        return (
                          <div key={studentId} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl">
                            <div>
                              <p className="font-medium text-gray-900">Ładowanie danych ucznia...</p>
                              <p className="text-sm text-gray-500">{studentId}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveStudentFromClass(studentId)}
                              className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      }
                      
                      // Utwórz nazwę z dostępnych danych
                      const studentName = student.name || 
                        student.displayName || 
                        (student.firstName || student.lastName ? `${student.firstName || ''} ${student.lastName || ''}`.trim() : '') ||
                        student.email?.split('@')[0] ||
                        'Brak nazwy';
                      
                      return (
                        <div key={studentId} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl">
                          <div>
                            <p className="font-medium text-gray-900">{studentName}</p>
                            <p className="text-sm text-gray-500">{student.email}</p>
                          </div>
                          <button
                            onClick={() => handleRemoveStudentFromClass(studentId)}
                            className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Brak uczniów w klasie</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Course Modal */}
      {showAssignCourseModal && selectedClass && (
        <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Przypisz Kurs - {selectedClass.name}</h3>
              </div>
              <button 
                onClick={() => {
                  setShowAssignCourseModal(false);
                  setSelectedClass(null);
                  resetCourseForm();
                }}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors group"
              >
                <span className="text-gray-500 group-hover:text-gray-700 text-lg font-medium">×</span>
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Assign Course Form */}
              <div className="bg-gray-50 p-4 rounded-xl">
                <h4 className="text-lg font-semibold mb-4">Przypisz kurs do klasy</h4>
                <div className="flex gap-3">
                  <select
                    value={courseFormData.courseId}
                    onChange={(e) => setCourseFormData({ courseId: e.target.value })}
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all"
                  >
                    <option value="">Wybierz kurs</option>
                    {courses
                      .filter(course => !selectedClass.assignedCourses?.includes(course.id))
                      .map(course => (
                        <option key={course.id} value={course.id}>
                          {course.title} - {course.subject}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={handleAssignCourseToClass}
                    className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all duration-200 font-semibold"
                  >
                    Przypisz
                  </button>
                </div>
              </div>

              {/* Assigned Courses List */}
              <div>
                <h4 className="text-lg font-semibold mb-4">Przypisane kursy ({selectedClass.assignedCourses?.length || 0})</h4>
                {selectedClass.assignedCourses && selectedClass.assignedCourses.length > 0 ? (
                  <div className="space-y-2">
                    {selectedClass.assignedCourses.map(courseId => {
                      const course = courses.find(c => c.id === courseId);
                      return course ? (
                        <div key={courseId} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl">
                          <div>
                            <p className="font-medium text-gray-900">{course.title}</p>
                            <p className="text-sm text-gray-500">{course.subject}</p>
                          </div>
                          <button
                            onClick={() => handleRemoveCourseFromClass(courseId)}
                            className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Brak przypisanych kursów</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportCSVModal && (
        <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Upload className="h-5 w-5 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Importuj Plan Zajęć z CSV</h3>
              </div>
              <button 
                onClick={() => {
                  setShowImportCSVModal(false);
                  setImportProgress('');
                  setCsvText('');
                  setSelectedClassForImport('');
                }}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors group"
              >
                <span className="text-gray-500 group-hover:text-gray-700 text-lg font-medium">×</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Instrukcja:</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Wybierz klasę z listy poniżej</li>
                  <li>Wklej tekst CSV do pola tekstowego lub wczytaj plik CSV</li>
                  <li>System automatycznie sparsuje plan zajęć z pierwszej sekcji</li>
                  <li>Istniejący plan zajęć zostanie zastąpiony nowym</li>
                  <li>Stare eventy kalendarza zostaną usunięte i utworzone nowe</li>
                </ul>
              </div>

              {/* Wybór klasy */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Wybierz klasę:
                </label>
                <select
                  value={selectedClassForImport}
                  onChange={(e) => setSelectedClassForImport(e.target.value)}
                  disabled={importLoading}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                >
                  <option value="">-- Wybierz klasę --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} {cls.grade_level ? `(Klasa ${cls.grade_level})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pole tekstowe do wklejenia CSV */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Wklej tekst CSV lub wczytaj plik:
                </label>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  disabled={importLoading}
                  placeholder="Wklej tutaj zawartość pliku CSV z planem lekcji..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-sm min-h-[200px] bg-white"
                />
              </div>

              {/* Przycisk wczytania pliku */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <label className="cursor-pointer inline-flex items-center gap-2">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVFileUpload}
                    disabled={importLoading}
                    className="hidden"
                  />
                  <FileText className="h-5 w-5 text-gray-400" />
                  <span className="text-sm text-gray-600 hover:text-gray-800">
                    Lub wczytaj plik CSV
                  </span>
                </label>
              </div>

              {importProgress && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">{importProgress}</p>
                </div>
              )}

              {importLoading && (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}

              {/* Przyciski akcji */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleImportCSV}
                  disabled={!selectedClassForImport || !csvText.trim() || importLoading}
                  className="flex-1 bg-green-600 text-white py-3 px-6 rounded-xl hover:bg-green-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {importLoading ? 'Importowanie...' : 'Importuj Plan Zajęć'}
                </button>
                <button
                  onClick={() => {
                    setShowImportCSVModal(false);
                    setImportProgress('');
                    setCsvText('');
                    setSelectedClassForImport('');
                  }}
                  disabled={importLoading}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium border border-gray-200 hover:border-gray-300 disabled:opacity-50"
                >
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
