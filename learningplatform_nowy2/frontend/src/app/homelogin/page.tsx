"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Lazy load Calendar - ciężki komponent
const Calendar = dynamic(() => import('../../components/Calendar'), { 
  ssr: false,
  loading: () => <div className="h-96 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />
});
import { collection, getDocs, query, where, deleteDoc, doc, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Search, ArrowUp, ArrowDown } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

import Providers from '@/components/Providers';

// Add Course interface
interface Course {
  id: number;
  title: string;
  slug: string;
  description: string;
  thumbnail: string;
  level: string;
  category: number;
  category_name: string;
  instructor: number;
  instructor_name: string;
  is_featured: boolean;
  assignedUsers?: string[];
  firebase_id?: string;
  iconUrl?: string;
}

// Add Teacher interface
interface Teacher {
  uid: string;
  displayName: string;
  email: string;
  subject: string;
  role: string;
  photoURL?: string;
}

// Add SearchResult interface
interface SearchResult {
  type: 'course' | 'teacher';
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  photoURL?: string;
}

// Function to get sidebar links based on user role
const getSidebarLinks = (userRole?: string) => {
  const baseLinks = [
    {
      label: "Moje kursy",
      icon: <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M16 3v4M8 3v4M4 7h16" /></svg>,
      href: "/homelogin/my-courses"
    },
    {
      label: "Plan lekcji",
      icon: <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
      href: "/homelogin/schedule"
    }
  ];

  // Add group chat with appropriate link based on role
  baseLinks.push({
    label: "Czat grupowy",
    icon: <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
    href: userRole === 'teacher' ? "/homelogin/teacher/group-chats" : "/homelogin/group-chats"
  });

  baseLinks.push(
  {
    label: "Dziennik",
    icon: <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V6a2 2 0 012-2h2l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2z" /></svg>,
    href: "/homelogin/grades"
  },
  {
    label: "Instructors",
    icon: <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    href: "/homelogin/instructors"
  },
  {
    label: "Specjaliści",
    icon: <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    href: "/homelogin/specialists"
  },
  {
    label: "Zgłoś błąd platformy",
    icon: <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    href: "/homelogin/report-bug"
  },
  {
    label: "Ankiety",
    icon: <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
    href: "/homelogin/ankiety"
  },
  {
    label: "ZPE.gov.pl",
    icon: <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>,
    href: "https://zpe.gov.pl"
  },
  {
    label: "Support & FAQs",
    icon: <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>,
    href: "/homelogin/support"
  });
  
  return baseLinks;
};



function DashboardPageContent() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      // Przekieruj na podstawie roli użytkownika
      if (user.role === 'teacher') {
        router.replace('/homelogin/teacher');
      } else if (user.role === 'admin') {
        router.replace('/homelogin/superadmin');
      } else if (user.role === 'parent') {
        router.replace('/homelogin/parent');
      }
      // Student - zostaje na tej stronie
    }
  }, [user, loading, router]);

  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}

export default function DashboardPage() {
  return (
    <Providers>
      <DashboardPageContent />
    </Providers>
  );
}

function Dashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  
  // Get sidebar links based on user role
  const sidebarLinks = getSidebarLinks(user?.role);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Changed to false for mobile
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [assignedCourses, setAssignedCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [loadingAssigned, setLoadingAssigned] = useState(true);
  const [courseSearch, setCourseSearch] = useState('');
  const [courseSortBy, setCourseSortBy] = useState<'title' | 'category'>('title');
  const [courseSortOrder, setCourseSortOrder] = useState<'asc' | 'desc'>('asc');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [, setLoadingTeachers] = useState(true);
  const searchRef = useRef<HTMLDivElement>(null);

  interface Notification {
    id: string;
    title: string;
    description?: string;
    deadline: string;
    isOverdue?: boolean;
    students?: string[];
    type?: 'assignment' | 'exam' | 'announcement' | 'grade' | 'course';
    courseId?: string;
    courseTitle?: string;
    actionUrl?: string;
    priority?: 'low' | 'medium' | 'high';
    read?: boolean;
  }

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [searchPosition, setSearchPosition] = useState({ left: 0, width: 0 });





  // Oblicz pozycję i szerokość pola wyszukiwania
  useEffect(() => {
    const updateSearchPosition = () => {
      if (searchRef.current) {
        const rect = searchRef.current.getBoundingClientRect();
        setSearchPosition({
          left: rect.left,
          width: rect.width
        });
      }
    };
    
    updateSearchPosition();
    window.addEventListener('resize', updateSearchPosition);
    return () => window.removeEventListener('resize', updateSearchPosition);
  }, []);

  // Pobierz kursy przypisane do użytkownika
  useEffect(() => {
    if (!user) return;
    const fetchAssignedCourses = async () => {
      setLoadingAssigned(true);
      try {
        // Użyj query z where zamiast pobierania wszystkich kursów
        const [coursesByUid, coursesByEmail] = await Promise.all([
          getDocs(query(collection(db, 'courses'), where('assignedUsers', 'array-contains', user.uid))),
          user.email ? getDocs(query(collection(db, 'courses'), where('assignedUsers', 'array-contains', user.email))) : Promise.resolve({ docs: [] } as any)
        ]);
        
        // Połącz i deduplikuj kursy
        const coursesMap = new Map();
        [coursesByUid, coursesByEmail].forEach(snapshot => {
          snapshot.docs.forEach((doc: any) => {
            coursesMap.set(doc.id, {
              id: doc.id,
              firebase_id: doc.id,
              ...doc.data()
            });
          });
        });
        
        const assigned = Array.from(coursesMap.values()) as Course[];
        setAssignedCourses(assigned);
      } catch (error) {
        console.error('Error fetching assigned courses:', error);
        setAssignedCourses([]);
      } finally {
        setLoadingAssigned(false);
      }
    };
    fetchAssignedCourses();
  }, [user]);

  // Memoizuj funkcję sortowania kursów
  const sortCourses = useCallback((coursesToSort: Course[]) => {
    return [...coursesToSort].sort((a, b) => {
      let aValue: string = '';
      let bValue: string = '';
      
      switch (courseSortBy) {
        case 'title':
          aValue = a.title?.toLowerCase() || '';
          bValue = b.title?.toLowerCase() || '';
          break;
        case 'category':
          aValue = a.category_name?.toLowerCase() || '';
          bValue = b.category_name?.toLowerCase() || '';
          break;
      }
      
      if (courseSortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [courseSortBy, courseSortOrder]);

  // Memoizuj filtrowane i posortowane kursy
  const filteredCoursesMemo = useMemo(() => {
    let filtered = assignedCourses;
    
    if (courseSearch) {
      filtered = assignedCourses.filter(course => {
        const title = course.title?.toLowerCase() || '';
        const category = course.category_name?.toLowerCase() || '';
        const searchTerm = courseSearch.toLowerCase();
        
        return title.includes(searchTerm) || category.includes(searchTerm);
      });
    }
    
    return sortCourses(filtered);
  }, [assignedCourses, courseSearch, sortCourses]);

  // Użyj memoizowanych kursów
  useEffect(() => {
    setFilteredCourses(filteredCoursesMemo);
  }, [filteredCoursesMemo]);

  // Funkcja zmiany sortowania kursów - memoizowana
  const handleCourseSortChange = useCallback((newSortBy: 'title' | 'category') => {
    if (courseSortBy === newSortBy) {
      setCourseSortOrder(courseSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setCourseSortBy(newSortBy);
      setCourseSortOrder('asc');
    }
  }, [courseSortBy, courseSortOrder]);

  // Pobierz nauczycieli z Firestore
  useEffect(() => {
    const fetchTeachers = async () => {
      setLoadingTeachers(true);
      try {
        const usersCollection = collection(db, 'users');
        // Pobierz tylko nauczycieli i tutorów używając równoległych zapytań z where
        const [teachersSnapshot, tutorsSnapshot] = await Promise.all([
          getDocs(query(usersCollection, where('role', '==', 'teacher'), limit(50))),
          getDocs(query(usersCollection, where('role', '==', 'tutor'), limit(50)))
        ]);
        
        // Połącz i deduplikuj wyniki
        const teachersMap = new Map();
        [...teachersSnapshot.docs, ...tutorsSnapshot.docs].forEach(doc => {
          const data = doc.data();
          teachersMap.set(doc.id, {
            uid: doc.id,
            displayName: data.displayName || '',
            email: data.email || '',
            subject: data.subject || '',
            role: data.role || '',
            photoURL: data.photoURL || '',
          });
        });
        
        setTeachers(Array.from(teachersMap.values()));
      } catch (error) {
        console.error('Error fetching teachers:', error);
        setTeachers([]);
      } finally {
        setLoadingTeachers(false);
      }
    };
    fetchTeachers();
  }, []);

  // Memoizuj wyniki wyszukiwania
  const searchResultsMemo = useMemo(() => {
    if (search.length === 0) {
      const results: SearchResult[] = [];
      
      // Dodaj wszystkie kursy
      assignedCourses.forEach(course => {
        results.push({
          type: 'course',
          id: course.firebase_id || course.id.toString(),
          title: course.title,
          subtitle: course.category_name,
          description: course.description,
          photoURL: course.thumbnail
        });
      });
      
      // Dodaj wszystkich nauczycieli
      teachers.forEach(teacher => {
        results.push({
          type: 'teacher',
          id: teacher.uid,
          title: teacher.displayName,
          subtitle: teacher.subject,
          description: teacher.email,
          photoURL: teacher.photoURL
        });
      });
      
      return results;
    } else {
      const results: SearchResult[] = [];
      const searchTerm = search.toLowerCase();
      
      // Filtruj kursy
      assignedCourses.forEach(course => {
        const title = course.title?.toLowerCase() || '';
        const description = course.description?.toLowerCase() || '';
        
        if (title.includes(searchTerm) || description.includes(searchTerm)) {
          results.push({
            type: 'course',
            id: course.firebase_id || course.id.toString(),
            title: course.title,
            subtitle: course.category_name,
            description: course.description,
            photoURL: course.thumbnail
          });
        }
      });
      
      // Filtruj nauczycieli
      teachers.forEach(teacher => {
        const name = teacher.displayName?.toLowerCase() || '';
        const email = teacher.email?.toLowerCase() || '';
        const subject = teacher.subject?.toLowerCase() || '';
        
        if (name.includes(searchTerm) || email.includes(searchTerm) || subject.includes(searchTerm)) {
          results.push({
            type: 'teacher',
            id: teacher.uid,
            title: teacher.displayName,
            subtitle: teacher.subject,
            description: teacher.email,
            photoURL: teacher.photoURL
          });
        }
      });
      
      return results;
    }
  }, [search, assignedCourses, teachers]);

  // Debounced search handler - płynniejsze wyszukiwanie
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Debounce search results update
    searchTimeoutRef.current = setTimeout(() => {
      setSearchResults(searchResultsMemo);
      setShowSearchResults(true);
    }, 150); // 150ms debounce dla płynności
  }, [searchResultsMemo]);

  // Funkcja do pokazania wszystkich wyników przy focusie - memoizowana
  const handleSearchFocus = useCallback(() => {
    if (search.length === 0) {
      setSearchResults(searchResultsMemo);
      setShowSearchResults(true);
    }
  }, [search.length, searchResultsMemo]);

  // Funkcja nawigacji do kursu - memoizowana
  const handleCourseClick = useCallback((courseId: string) => {
    // Sprawdź czy kurs ma slug, jeśli nie użyj ID
    const course = assignedCourses.find(c => (c.firebase_id || c.id.toString()) === courseId);
    if (course && course.slug) {
      router.push(`/courses/${course.slug}`);
    } else {
      router.push(`/courses/${courseId}`);
    }
    setSearch('');
    setShowSearchResults(false);
  }, [assignedCourses, router]);

  // Funkcja nawigacji do profilu nauczyciela - memoizowana
  const handleTeacherClick = useCallback((teacherId: string) => {
    // Przejdź do profilu nauczyciela
    router.push(`/homelogin/student/teacher/${teacherId}`);
    setSearch('');
    setShowSearchResults(false);
  }, [router]);

  // Cleanup dla search timeout
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Obsługa kliknięć poza wyszukiwarką
  useEffect(() => {
    if (!showSearchResults) return;
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearchResults]);

  // Pobierz eventy jako powiadomienia
  useEffect(() => {
    if (!user) return;
    
    const fetchNotifications = async () => {
      try {
        const allNotificationsList: any[] = [];
        const eventIdsFromNotifications = new Set<string>(); // Śledzenie event_id z notifications
        const now = new Date();
        
        // 1. Pobierz powiadomienia z kolekcji notifications (dla studentów) - zoptymalizowane
        if (user.role === 'student') {
          const notificationsRef = collection(db, 'notifications');
          const notificationsQuery = query(
            notificationsRef, 
            where('user_id', '==', user.uid),
            limit(50) // Ogranicz do 50 najnowszych
          );
          const notificationsSnapshot = await getDocs(notificationsQuery);
          
          // Przetwórz powiadomienia równolegle zamiast w pętli
          const notificationPromises = notificationsSnapshot.docs.map(async (notificationDoc) => {
            const notificationData = notificationDoc.data();
            const eventDate = notificationData.event_date ? new Date(notificationData.event_date) : null;
            
            // Usuń powiadomienia z niepoprawną datą lub stare
            if (notificationData.event_date && (!eventDate || isNaN(eventDate.getTime()))) {
              await deleteDoc(doc(db, 'notifications', notificationDoc.id));
              return null;
            }
            
            if (eventDate) {
              const sevenDaysAfterEvent = new Date(eventDate.getTime() + 7 * 24 * 60 * 60 * 1000);
              if (sevenDaysAfterEvent < now) {
                await deleteDoc(doc(db, 'notifications', notificationDoc.id));
                return null;
              }
            }
            
            if (notificationData.event_id) {
              eventIdsFromNotifications.add(notificationData.event_id);
            }
            
            return {
              id: notificationDoc.id,
              title: notificationData.title || 'Nowe wydarzenie',
              description: notificationData.message || '',
              deadline: notificationData.event_date || notificationData.timestamp || new Date().toISOString(),
              type: 'event' as const,
              priority: 'medium' as const,
              read: notificationData.read || false,
              isOverdue: eventDate ? eventDate < now : false,
              students: [user.uid],
              event_id: notificationData.event_id
            };
          });
          
          const processedNotifications = await Promise.all(notificationPromises);
          allNotificationsList.push(...processedNotifications.filter(Boolean));
        }
        
        // 2. Pobierz eventy jako powiadomienia - zoptymalizowane z where i limit
        const eventsCollection = collection(db, 'events');
        let eventsList: any[] = [];
        
        // Student widzi tylko swoje eventy - użyj zapytań z where zamiast pobierania wszystkich
        if (user.role === 'student') {
          // Firestore nie obsługuje OR w jednym zapytaniu, więc użyj dwóch równoległych zapytań
          const [assignedEventsSnapshot, studentsEventsSnapshot] = await Promise.all([
            getDocs(query(eventsCollection, where('assignedTo', 'array-contains', user.uid), limit(50))),
            getDocs(query(eventsCollection, where('students', 'array-contains', user.uid), limit(50)))
          ]);
          
          // Połącz i deduplikuj eventy
          const eventsMap = new Map();
          [...assignedEventsSnapshot.docs, ...studentsEventsSnapshot.docs].forEach(doc => {
            const ev = { id: doc.id, ...doc.data() };
            // Pomiń eventy, które już mają powiadomienie w notifications
            if (!eventIdsFromNotifications.has(ev.id)) {
              eventsMap.set(ev.id, ev);
            }
          });
          
          eventsList = Array.from(eventsMap.values());
        } else {
          // Dla innych ról pobierz wszystkie eventy (ale z limitem)
          const eventsSnapshot = await getDocs(query(eventsCollection, limit(100)));
          eventsList = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        // Sortuj po dacie malejąco
        eventsList.sort((a: any, b: any) => {
          const deadlineA = a.deadline || a.date;
          const deadlineB = b.deadline || b.date;
          return new Date(deadlineB).getTime() - new Date(deadlineA).getTime();
        });
        
        // Dodaj informację o przekroczonym terminie i wzbogac dane
        eventsList = eventsList.filter((ev: any) => {
          const eventDeadline = ev.deadline || ev.date;
          if (!eventDeadline) {
            return false; // Pomiń eventy bez daty
          }
          
          const deadline = new Date(eventDeadline);
          
          // Sprawdź czy data jest poprawna
          if (isNaN(deadline.getTime())) {
            return false;
          }
          
          // Usuń wydarzenia, które są starsze niż 7 dni PO terminie
          const sevenDaysAfterEvent = new Date(deadline.getTime() + 7 * 24 * 60 * 60 * 1000);
          if (sevenDaysAfterEvent < now) {
            return false;
          }
          
          return true;
        }).map((ev: any) => {
          const deadline = new Date(ev.deadline || ev.date);
          const isOverdue = deadline < now;
          const timeDiff = deadline.getTime() - now.getTime();
          const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
          
          // Określ priorytet na podstawie czasu do deadline
          let priority: 'low' | 'medium' | 'high' = 'low';
          if (isOverdue) priority = 'high';
          else if (daysDiff <= 3) priority = 'high';
          else if (daysDiff <= 7) priority = 'medium';
          
          // Określ typ powiadomienia na podstawie tytułu
          let type: 'assignment' | 'exam' | 'announcement' | 'grade' | 'course' = 'announcement';
          const title = ev.title?.toLowerCase() || '';
          if (title.includes('zadanie') || title.includes('assignment')) type = 'assignment';
          else if (title.includes('egzamin') || title.includes('exam') || title.includes('test')) type = 'exam';
          else if (title.includes('ocena') || title.includes('grade')) type = 'grade';
          else if (title.includes('kurs') || title.includes('course')) type = 'course';
          
          return {
            ...ev,
            isOverdue,
            priority,
            type,
            read: false
          };
        });
        
        // Połącz powiadomienia z notifications i eventy
        const combinedNotifications = [...allNotificationsList, ...eventsList];
        
        // Sortuj wszystkie powiadomienia po dacie malejąco
        combinedNotifications.sort((a: any, b: any) => {
          const dateA = new Date(a.deadline || a.date);
          const dateB = new Date(b.deadline || b.date);
          return dateB.getTime() - dateA.getTime();
        });
        
        // Ogranicz do 15 najnowszych
        const limitedNotifications = combinedNotifications.slice(0, 15);

        setNotifications(limitedNotifications as Notification[]);
        
        // Sprawdź, czy są nieprzeczytane
        const lastRead = localStorage.getItem('lastNotifRead');
        if (!lastRead || limitedNotifications.length > 0 && limitedNotifications[0].id !== lastRead) {
          setHasUnread(true);
        } else {
          setHasUnread(false);
        }
      } catch (error) {
        console.error('Error fetching dashboard notifications:', error);
      }
    };
    fetchNotifications();
    
    // Odświeżaj co 5 minut
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);


  // Funkcja do obsługi kliknięcia w powiadomienie - memoizowana
  const handleNotificationClick = useCallback((notification: Notification) => {
    // Zaznacz jako przeczytane
    setNotifications(prev => {
      const updated = prev.map(n => 
        n.id === notification.id ? { ...n, read: true } : n
      );
      // Sprawdź czy są nieprzeczytane powiadomienia
      const unreadCount = updated.filter(n => !n.read).length;
      setHasUnread(unreadCount > 1);
      return updated;
    });
    
    // Nawiguj do odpowiedniej strony
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    } else if (notification.courseId) {
      // Znajdź kurs i nawiguj do niego
      const course = assignedCourses.find(c => (c.firebase_id || c.id.toString()) === notification.courseId);
      if (course && course.slug) {
        router.push(`/courses/${course.slug}`);
      } else if (notification.courseId) {
        router.push(`/courses/${notification.courseId}`);
      }
    } else if (notification.type === 'grade') {
      router.push('/homelogin/grades');
    } else if (notification.type === 'course') {
      router.push('/homelogin/my-courses');
    }
    
    // Zamknij dropdown powiadomień
    setShowNotifications(false);
  }, [assignedCourses, router]);

  // Zaznacz powiadomienia jako przeczytane po otwarciu - memoizowana
  const handleNotifClick = useCallback(() => {
    setShowNotifications((prev) => !prev);
    if (notifications.length > 0) {
      localStorage.setItem('lastNotifRead', notifications[0].id);
      setHasUnread(false);
    }
  }, [notifications]);

  useEffect(() => {
    if (!showNotifications) return;
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);


  return (
    <>
      {/* Search Results Portal - rendered outside main container */}
      {searchResults.length > 0 && showSearchResults && (
        <div ref={searchRef} className="fixed top-20 bg-white/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl max-h-96 overflow-y-auto" style={{ 
          zIndex: 999999,
          left: `${searchPosition.left}px`,
          width: `${searchPosition.width}px`
        }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
            {/* Kolumna z kursami */}
            <div>
              <h3 className="text-sm font-bold text-[#4067EC] mb-4 pb-3 border-b border-white/20">
                Kursy ({searchResults.filter(r => r.type === 'course').length})
              </h3>
              <div className="space-y-3">
                {searchResults
                  .filter(result => result.type === 'course')
                  .map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center p-4 hover:bg-gradient-to-r hover:from-[#F1F4FE] hover:to-white cursor-pointer transition-all duration-200 rounded-xl border border-transparent hover:border-[#4067EC] hover:shadow-lg"
                      onClick={() => handleCourseClick(result.id)}
                    >
                      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-[#4067EC] to-[#5577FF] rounded-xl flex items-center justify-center mr-4 shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 text-sm truncate">{result.title}</div>
                        {result.subtitle && <div className="text-xs text-gray-500 truncate">{result.subtitle}</div>}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Kolumna z nauczycielami */}
            <div>
              <h3 className="text-sm font-bold text-[#4067EC] mb-4 pb-3 border-b border-white/20">
                Nauczyciele ({searchResults.filter(r => r.type === 'teacher').length})
              </h3>
              <div className="space-y-3">
                {searchResults
                  .filter(result => result.type === 'teacher')
                  .map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center p-4 hover:bg-gradient-to-r hover:from-[#F1F4FE] hover:to-white cursor-pointer transition-all duration-200 rounded-xl border border-transparent hover:border-[#4067EC] hover:shadow-lg"
                      onClick={() => handleTeacherClick(result.id)}
                    >
                      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center mr-4 overflow-hidden shadow-lg">
                        {result.photoURL ? (
                          <Image src={result.photoURL} alt={result.title} width={48} height={48} className="w-full h-full object-cover" />
                        ) : (
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 text-sm truncate">{result.title}</div>
                        {result.subtitle && <div className="text-xs text-gray-500 truncate">{result.subtitle}</div>}
                        {result.description && <div className="text-xs text-gray-700 truncate">{result.description}</div>}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Portal - rendered outside main container */}
      {showNotifications && (
        <div ref={notifRef} className="fixed top-20 right-6 w-80 bg-white/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden" style={{ zIndex: 999999 }}>
          <div className="p-4 border-b border-white/20 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Powiadomienia</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-white/20 px-3 py-1 rounded-full font-medium">
                  {notifications.filter(n => !n.read).length} nowych
                </span>
              </div>
            </div>
          </div>
          
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">Brak powiadomień</p>
              <p className="text-gray-400 text-sm mt-1">Wszystko jest na bieżąco! 🎉</p>
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {notifications.map((notif) => {
                const isUnread = !notif.read;
                
                // Różnorodne kolory dla różnych typów powiadomień
                const getNotificationColors = () => {
                  switch (notif.type) {
                    case 'assignment':
                      return {
                        bg: 'bg-blue-50',
                        border: 'border-l-blue-500',
                        icon: 'bg-blue-500',
                        text: 'text-blue-700'
                      };
                    case 'exam':
                      return {
                        bg: 'bg-red-50',
                        border: 'border-l-red-500',
                        icon: 'bg-red-500',
                        text: 'text-red-700'
                      };
                    case 'grade':
                      return {
                        bg: 'bg-green-50',
                        border: 'border-l-green-500',
                        icon: 'bg-green-500',
                        text: 'text-green-700'
                      };
                    case 'course':
                      return {
                        bg: 'bg-purple-50',
                        border: 'border-l-purple-500',
                        icon: 'bg-purple-500',
                        text: 'text-purple-700'
                      };
                    default:
                      return {
                        bg: 'bg-orange-50',
                        border: 'border-l-orange-500',
                        icon: 'bg-orange-500',
                        text: 'text-orange-700'
                      };
                  }
                };
                
                const colors = getNotificationColors();
                
                const getTypeIcon = () => {
                  switch (notif.type) {
                    case 'assignment':
                      return (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V6a2 2 0 012-2h2l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2z" />
                        </svg>
                      );
                    case 'exam':
                      return (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      );
                    case 'grade':
                      return (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      );
                    case 'course':
                      return (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      );
                    default:
                      return (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      );
                  }
                };
                
                return (
                  <li 
                    key={notif.id} 
                    className={`p-4 border-l-4 ${colors.border} ${colors.bg} hover:bg-white hover:shadow-lg transition-all duration-200 cursor-pointer group`}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-10 h-10 ${colors.icon} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                        {getTypeIcon()}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className={`font-bold text-sm ${isUnread ? 'text-gray-900' : 'text-gray-700'}`}>
                            {notif.title}
                          </h4>
                          {isUnread && (
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-500 mb-2">
                          <div className="flex items-center gap-2">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>
                              {new Date(notif.deadline).toLocaleString('pl-PL', { 
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {notif.isOverdue && (
                              <span className="text-red-600 font-bold text-xs">⚠️ Po terminie</span>
                            )}
                          </div>
                        </div>
                        
                        {notif.description && (
                          <p className="text-xs text-gray-600 line-clamp-2 mb-2">{notif.description}</p>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-3 py-1 rounded-full ${colors.text} bg-white/80 font-medium`}>
                            {notif.type === 'assignment' ? 'Zadanie' : 
                             notif.type === 'exam' ? 'Egzamin' : 
                             notif.type === 'grade' ? 'Ocena' : 
                             notif.type === 'course' ? 'Kurs' : 'Ogłoszenie'}
                          </span>
                          <span className="text-xs text-gray-400">Kliknij aby przejść →</span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          
          {notifications.length > 0 && (
            <div className="p-4 border-t border-white/20 bg-gray-50/50">
              <button 
                onClick={() => {
                  setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                  setHasUnread(false);
                }}
                className="w-full text-sm text-gray-600 hover:text-emerald-600 transition-colors font-medium"
              >
                Zaznacz wszystkie jako przeczytane
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        {/* Mobile menu button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-white/90 backdrop-blur-lg rounded-xl shadow-lg border border-white/20 hover:bg-white hover:shadow-xl transition-all duration-200"
        >
          <svg className="w-6 h-6 text-[#4067EC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white/90 backdrop-blur-xl border-r border-white/20 flex flex-col min-h-screen transition-transform duration-300 ease-in-out shadow-xl`} style={{height: '100vh'}}>
        <div className="flex items-center gap-3 px-6 py-6 justify-between bg-gradient-to-r from-[#4067EC] to-[#5577FF] text-white rounded-br-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Image src="/puzzleicon.png" alt="Logo" width={24} height={24} className="w-6 h-6 brightness-0 dark:brightness-100" />
            </div>
            <span className="text-lg font-bold">COGITO</span>
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          {sidebarLinks.map((item) => (
            <div key={item.label}>
              {item.href ? (
                <Link 
                  href={item.href} 
                  className="flex items-center text-gray-700 font-medium py-3 px-4 rounded-xl hover:bg-white hover:text-[#4067EC] hover:shadow-lg cursor-pointer transition-all duration-200 hover:scale-105 text-sm shadow-sm border border-transparent hover:border-[#4067EC]/20 group"
                  target={item.href.startsWith('http') ? "_blank" : undefined}
                  rel={item.href.startsWith('http') ? "noopener noreferrer" : undefined}
                >
                  <div className="w-8 h-8 bg-[#F1F4FE] rounded-lg flex items-center justify-center mr-3 group-hover:bg-[#4067EC] group-hover:text-white transition-all duration-200">
                    {item.icon}
                  </div>
                  <span className="truncate">{item.label}</span>
                  {item.href.startsWith('http') && (
                    <svg className="w-4 h-4 ml-auto text-gray-400 group-hover:text-[#4067EC]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  )}
                </Link>
              ) : (
                <div className="flex items-center text-gray-700 font-medium py-3 px-4 rounded-xl hover:bg-white hover:text-[#4067EC] hover:shadow-lg cursor-pointer transition-all duration-200 hover:scale-105 text-sm shadow-sm border border-transparent hover:border-[#4067EC]/20 group">
                  <div className="w-8 h-8 bg-[#F1F4FE] rounded-lg flex items-center justify-center mr-3 group-hover:bg-[#4067EC] group-hover:text-white transition-all duration-200">
                    {item.icon}
                  </div>
                  <span className="truncate">{item.label}</span>
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col w-full lg:w-auto bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-200">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 lg:px-8 py-4 sm:py-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-white/20 dark:border-gray-700/50 shadow-sm relative gap-3 sm:gap-4 transition-colors duration-200">
          <div className="relative w-full sm:w-[45%] md:w-[40%] lg:w-1/3" ref={searchRef}>
            <div className="flex">
              <input
                type="text"
                placeholder="Szukaj kursu lub nauczyciela..."
                className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-l-xl border border-white/30 dark:border-gray-600 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#4067EC] dark:focus:ring-blue-400 focus:bg-white dark:focus:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold pr-8 sm:pr-10 text-xs sm:text-sm shadow-sm transition-colors duration-200"
                style={{ fontSize: '16px' }}
                value={search}
                onChange={handleSearchChange}
                onFocus={handleSearchFocus}
              />
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setShowSearchResults(false);
                  setSearchResults([]);
                }}
                className="px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-[#4067EC] to-[#5577FF] text-white rounded-r-xl border border-[#4067EC] hover:from-[#3155d4] hover:to-[#4067EC] focus:outline-none focus:ring-2 focus:ring-[#4067EC] transition-all duration-200 shadow-sm hover:shadow-lg flex-shrink-0"
                aria-label="Wyczyść wyszukiwanie"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            

          </div>
          
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  className="relative p-3 rounded-xl bg-white/60 backdrop-blur-sm hover:bg-white hover:shadow-lg cursor-pointer transition-all duration-200 border border-white/20"
                  onClick={handleNotifClick}
                  aria-label="Powiadomienia"
                >
                  <svg className="w-6 h-6 text-[#4067EC]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 7.165 6 9.388 6 12v2.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  {hasUnread && (
                    <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                  )}
                </button>
              </div>
              <ThemeToggle />
              <div className="flex items-center gap-3 p-2 bg-white/60 backdrop-blur-sm rounded-xl border border-white/20 hover:bg-white hover:shadow-lg transition-all duration-200 cursor-pointer" onClick={() => router.push('/profile')}>
                <Image 
                  src="https://images.unsplash.com/photo-1511367461989-f85a21fda167?auto=format&fit=facearea&w=256&h=256&facepad=2" 
                  alt="Profile" 
                  width={32} 
                  height={32} 
                  className="w-8 h-8 rounded-full border-2 border-[#4067EC] object-cover" 
                />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 hidden sm:block">Profil</span>
              </div>
              <button onClick={logout} className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-sm hover:shadow-lg text-sm font-semibold">Wyloguj się</button>
            </div>
          </div>
        </header>
        
        {/* Dashboard grid */}
        <div className="flex-1 p-4 lg:p-6">
          {/* Main dashboard */}
          <section className="space-y-4 lg:space-y-6">
            {/* Progress & Chart */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Statystyki profilu - rozszerzona */}
              <div className="md:col-span-1">
                <a href="/profile/statistics" className="block bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-lg p-6 flex flex-col hover:shadow-xl transition-all duration-300 cursor-pointer border border-white/20 dark:border-gray-700/50 hover:border-[#4067EC] dark:hover:border-blue-400 h-full group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-gradient-to-r from-[#4067EC] to-[#5577FF] p-3 rounded-xl text-white shadow-lg">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">Statystyki profilu</div>
                        <div className="text-lg font-bold text-gray-800 dark:text-gray-200 group-hover:text-[#4067EC] dark:group-hover:text-blue-400 transition-colors">Zobacz szczegóły &rarr;</div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Śledź swój postęp w nauce, czas spędzony na platformie i osiągnięcia.</p>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-3 border border-blue-200 dark:border-blue-700/50">
                      <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Kursy</div>
                      <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{assignedCourses.length}</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-3 border border-green-200 dark:border-green-700/50">
                      <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">Aktywność</div>
                      <div className="text-xl font-bold text-green-700 dark:text-green-300">Wysoka</div>
                    </div>
                  </div>
                  <div className="h-24 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl p-4">
                    <svg viewBox="0 0 200 80" className="w-full h-20">
                      <rect x="20" y="40" width="20" height="30" fill="url(#gradient)" rx="4" />
                      <rect x="50" y="30" width="20" height="40" fill="url(#gradient)" rx="4" />
                      <rect x="80" y="20" width="20" height="50" fill="url(#gradient)" rx="4" />
                      <rect x="110" y="10" width="20" height="60" fill="url(#gradient)" rx="4" />
                      <rect x="140" y="25" width="20" height="45" fill="url(#gradient)" rx="4" />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" style={{stopColor: '#4067EC'}} />
                          <stop offset="100%" style={{stopColor: '#5577FF'}} />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </a>
              </div>

              {/* Ankiety - rozszerzona */}
              <div className="md:col-span-1">
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-lg p-6 h-full flex flex-col justify-between border border-white/20 dark:border-gray-700/50">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-3 rounded-xl text-white shadow-lg">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Ankiety</h2>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Oceń swoich nauczycieli</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Twoja opinia jest dla nas bardzo ważna! Pomóż nam rozwijać platformę i poprawiać jakość nauczania.</p>
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-4 mb-4 border border-orange-200 dark:border-orange-700/50">
                      <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-r from-[#4067EC] to-[#5577FF] p-2 rounded-lg text-white shadow-md">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Wypełnij ankiety</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Pomóż nam się rozwijać i poprawiać jakość edukacji</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-4">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Ankiety są anonimowe i bezpieczne</span>
                    </div>
                  </div>
                  <a 
                    href="/homelogin/ankiety" 
                    className="inline-flex items-center justify-center bg-gradient-to-r from-[#4067EC] to-[#5577FF] text-white px-4 py-3 rounded-xl font-semibold hover:from-[#3155d4] hover:to-[#4067EC] transition-all duration-200 hover:shadow-lg w-full group shadow-md"
                  >
                    <span className="text-white font-bold">Przejdź do ankiet</span>
                    <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            {/* Top Courses (przypisane do użytkownika) */}
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-lg p-6 border border-white/20 dark:border-gray-700/50">
              <Link 
                href={user?.role === 'teacher' ? '/homelogin/teacher/courses' : '/homelogin/my-courses'}
                className="flex items-center gap-3 mb-6 hover:opacity-80 transition-opacity duration-200 cursor-pointer"
              >
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-3 rounded-xl text-white shadow-lg">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Moje kursy</h2>
              </Link>
              
              {/* Wyszukiwarka i sortowanie kursów */}
              <div className="mb-6">
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                  {/* Wyszukiwarka */}
                  <div className="relative flex-1 max-w-md">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                      <input
                        type="text"
                        placeholder="Wyszukaj kursy..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-emerald-500 text-sm text-gray-900 dark:text-gray-200 transition-all duration-200 ease-in-out hover:border-gray-300 dark:hover:border-gray-500 bg-white/80 dark:bg-gray-700/80"
                        value={courseSearch}
                        onChange={useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
                          setCourseSearch(e.target.value);
                        }, [])}
                      />
                    </div>
                  </div>

                  {/* Sortowanie */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sortuj:</span>
                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 shadow-sm">
                      <button
                        onClick={() => handleCourseSortChange('title')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 flex items-center gap-1 ${
                          courseSortBy === 'title' 
                            ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-md transform scale-105' 
                            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        Tytuł
                        {courseSortBy === 'title' && (
                          courseSortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        onClick={() => handleCourseSortChange('category')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 flex items-center gap-1 ${
                          courseSortBy === 'category' 
                            ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-md transform scale-105' 
                            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        Kategoria
                        {courseSortBy === 'category' && (
                          courseSortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Informacja o liczbie kursów */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {courseSearch ? (
                      <>Znaleziono <span className="font-semibold text-emerald-600 dark:text-emerald-400">{filteredCourses.length}</span> kursów dla &quot;<span className="font-semibold">{courseSearch}</span>&quot;</>
                    ) : (
                      <>Wyświetlane <span className="font-semibold text-emerald-600 dark:text-emerald-400">{filteredCourses.length}</span> z <span className="font-semibold">{assignedCourses.length}</span> kursów</>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Sortowanie: {courseSortBy === 'title' ? 'Tytuł' : 'Kategoria'} ({courseSortOrder === 'asc' ? 'A-Z' : 'Z-A'})
                  </div>
                </div>
              </div>
              {loadingAssigned ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                  <span className="ml-3 text-emerald-600 font-medium">Ładowanie kursów...</span>
                </div>
              ) : filteredCourses.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <p className="text-gray-500 font-medium">Nie przypisano żadnych kursów.</p>
                  <p className="text-gray-400 text-sm mt-1">Skontaktuj się z nauczycielem, aby zostać dodanym do kursu.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {filteredCourses.map((course, index) => {
                    // Kolory - stała tablica poza komponentem dla lepszej wydajności
                    const colors = [
                      'from-emerald-500 to-emerald-600',
                      'from-orange-500 to-orange-600', 
                      'from-purple-500 to-purple-600',
                      'from-pink-500 to-pink-600',
                      'from-indigo-500 to-indigo-600',
                      'from-teal-500 to-teal-600'
                    ];
                    const colorClass = colors[index % colors.length];
                    
                    return (
                      <div key={course.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700 hover:shadow-xl dark:hover:shadow-gray-900/50 transition-all duration-300 group hover:border-gray-200 dark:hover:border-gray-600">
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`w-10 h-10 ${course.iconUrl ? 'bg-transparent' : `bg-gradient-to-r ${colorClass}`} rounded-lg flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-200 overflow-hidden`}>
                            {course.iconUrl ? (
                              <Image 
                                src={course.iconUrl} 
                                alt={course.title} 
                                width={40} 
                                height={40} 
                                className="w-full h-full object-contain p-1" 
                                loading="lazy" 
                              />
                            ) : (
                              <Image src="/thumb.png" alt={course.title} width={20} height={20} className="w-5 h-5 rounded" loading="lazy" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{course.title}</h3>
                            {course.category_name && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">{course.category_name}</p>
                            )}
                          </div>
                        </div>
                        <Link href={`/courses/${course.slug || course.id}`}>
                          <button className="w-full bg-gradient-to-r from-slate-600 to-slate-700 dark:from-slate-700 dark:to-slate-800 text-white px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 hover:from-slate-700 hover:to-slate-800 dark:hover:from-slate-800 dark:hover:to-slate-900 hover:shadow-lg group-hover:scale-105 border border-slate-500/20">
                            Otwórz kurs
                          </button>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Kalendarz */}
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-xl shadow-lg p-4 border border-white/20 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-gradient-to-r from-teal-500 to-teal-600 p-2 rounded-lg text-white shadow-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Kalendarz i Aktywności</h2>
              </div>
              <Suspense fallback={<div className="h-96 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />}>
                <Calendar />
              </Suspense>
            </div>
          </section>
        </div>
      </main>
    </div>
    </>
  );
}
