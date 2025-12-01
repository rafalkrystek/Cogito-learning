"use client";
import { useState, useEffect, useCallback } from "react";
// Usunięte nieużywane importy Firebase Storage
import { db } from '../../../../config/firebase';
import Link from "next/link";
import { useAuth } from '@/context/AuthContext';
import { BookOpen, FileText, Edit, Trash2, Plus } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string;
  year_of_study: number;
  subject: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  pdfUrls: string[];
  links: string[];
  slug: string;
  created_by?: string;
  teacherEmail?: string;
  assignedUsers?: string[];
  sections?: unknown[];
  courseType?: 'obowiązkowy' | 'fakultatywny';
}

// Usunięte SUBJECTS - nieużywane po usunięciu formularza tworzenia kursów

export default function TeacherCourses() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 20,
    total_pages: 1,
    count: 0
  });
  const [, setSuccess] = useState<string | null>(null);
  const [deletingCourse, setDeletingCourse] = useState<string | null>(null);
  
  // States for editing course title
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);
  
  // States for creating new course
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [newCourse, setNewCourse] = useState({
    title: '',
    description: '',
    subject: '',
    year_of_study: 1,
    instructor_name: '',
    category_name: '',
    courseType: 'obowiązkowy' as 'obowiązkowy' | 'fakultatywny'
  });
  const [creatingCourse, setCreatingCourse] = useState(false);
  
  // States for copying course
  const [showCopyCourseModal, setShowCopyCourseModal] = useState(false);
  const [copyCourseSearchTerm, setCopyCourseSearchTerm] = useState('');
  const [copyCourseSortBy, setCopyCourseSortBy] = useState<'title' | 'created_at' | 'subject'>('title');
  const [copyCourseSortOrder, setCopyCourseSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // State dla wyszukiwarki i filtrowania
  const [searchTerm, setSearchTerm] = useState('');
  const [courseTypeFilter, setCourseTypeFilter] = useState<'wszystkie' | 'obowiązkowy' | 'fakultatywny'>('wszystkie');
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);

  

  // Cache'owanie kursów w localStorage - tylko dla kolejnych odświeżeń
  const cacheKey = 'teacher_courses_cache';
  const cacheExpiry = 2 * 60 * 1000; // 2 minuty (krótszy czas)

  const getCachedCourses = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < cacheExpiry) {
        return data;
      }
    }
    return null;
  }, [cacheKey, cacheExpiry]);

  const setCachedCourses = (data: { results: Course[]; pagination: { page: number; page_size: number; total_pages: number; count: number; }; }) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  };

  const clearCache = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(cacheKey);
    }
  }, [cacheKey]);

  // Funkcja filtrowania kursów
  const filterCourses = useCallback((courses: Course[], search: string, typeFilter: 'wszystkie' | 'obowiązkowy' | 'fakultatywny') => {
    console.log('🔍 [DEBUG] filterCourses called with:', {
      totalCourses: courses.length,
      search,
      typeFilter,
      coursesData: courses.map(c => ({
        id: c.id,
        title: c.title,
        courseType: c.courseType,
        hasCourseType: !!c.courseType
      }))
    });
    
    let filtered = courses;
    
    // Filtrowanie według typu kursu
    if (typeFilter !== 'wszystkie') {
      const beforeFilter = filtered.length;
      filtered = filtered.filter(course => {
        const courseType = course.courseType || 'obowiązkowy';
        const matches = courseType === typeFilter;
        console.log(`🔍 [DEBUG] Course "${course.title}" - courseType: "${courseType}", filter: "${typeFilter}", matches: ${matches}`);
        return matches;
      });
      console.log(`🔍 [DEBUG] Type filter "${typeFilter}": ${beforeFilter} -> ${filtered.length} courses`);
    }
    
    // Filtrowanie według wyszukiwania
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      const beforeSearch = filtered.length;
      filtered = filtered.filter(course => 
        course.title.toLowerCase().includes(searchLower) ||
        course.description.toLowerCase().includes(searchLower) ||
        course.subject.toLowerCase().includes(searchLower) ||
        course.year_of_study.toString().includes(searchLower)
      );
      console.log(`🔍 [DEBUG] Search "${search}": ${beforeSearch} -> ${filtered.length} courses`);
    }
    
    console.log('🔍 [DEBUG] Final filtered courses:', filtered.map(c => ({
      id: c.id,
      title: c.title,
      courseType: c.courseType || 'obowiązkowy'
    })));
    
    return filtered;
  }, []);

  const fetchCourses = useCallback(async (page = 1, useCache = true, retryCount = 0) => {
    console.log(`[DEBUG] fetchCourses called - page: ${page}, useCache: ${useCache}, retryCount: ${retryCount}`);
    
    setLoading(true);
    setError(null);
    
    // Sprawdź cache tylko dla kolejnych odświeżeń, nie przy pierwszym ładowaniu
    if (page === 1 && useCache) {
      const cached = getCachedCourses();
      if (cached) {
        console.log('[DEBUG] Using cached courses');
        setCourses(cached.results || cached);
        setPagination(cached.pagination || {
          page: 1,
          page_size: 20,
          total_pages: 1,
          count: cached.results?.length || cached.length || 0
        });
        setLoading(false);
        return;
      }
    }
    
    try {
      console.log('[DEBUG] Fetching courses from Firestore...');
      
      // Pobierz kursy bezpośrednio z Firestore
      const { collection, getDocs, query, where } = await import('firebase/firestore');
      const coursesCollection = collection(db, 'courses');
      
      // Pobierz tylko kursy przypisane do zalogowanego nauczyciela
      const teacherEmail = user?.email;
      console.log('[DEBUG] Teacher email:', teacherEmail);
      
      if (!teacherEmail) {
        setError('Nie można zidentyfikować nauczyciela');
        setLoading(false);
        return;
      }
      
      // Użyj query z where zamiast pobierania wszystkich kursów
      const [coursesByEmail, coursesByCreatedBy] = await Promise.all([
        getDocs(query(coursesCollection, where('teacherEmail', '==', teacherEmail))),
        getDocs(query(coursesCollection, where('created_by', '==', teacherEmail)))
      ]);
      
      // Połącz i deduplikuj kursy
      const coursesMap = new Map();
      [coursesByEmail, coursesByCreatedBy].forEach(snapshot => {
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          coursesMap.set(doc.id, {
            id: data.id || doc.id,
            title: data.title || '',
            description: data.description || '',
            year_of_study: data.year_of_study || data.year || 1,
            subject: data.subject || '',
            is_active: data.is_active !== undefined ? data.is_active : true,
            created_at: data.created_at || new Date().toISOString(),
            updated_at: data.updated_at || new Date().toISOString(),
            pdfUrls: data.pdfUrls || [],
            links: data.links || [],
            slug: data.slug || '',
            created_by: data.created_by || null,
            teacherEmail: data.teacherEmail || '',
            assignedUsers: data.assignedUsers || [],
            sections: data.sections || [],
            courseType: data.courseType || 'obowiązkowy'
          });
        });
      });
      
      const firestoreCourses = Array.from(coursesMap.values());
      
      console.log('📥 [DEBUG] Firestore courses loaded:', firestoreCourses.length);
      console.log('📥 [DEBUG] Teacher courses with courseType:', firestoreCourses.map(c => ({ 
        title: c.title, 
        teacherEmail: c.teacherEmail,
        courseType: c.courseType,
        hasCourseType: !!c.courseType
      })));
      
      // Sortuj po dacie utworzenia (najnowsze pierwsze)
      const sortedCourses = firestoreCourses.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      // Paginacja po stronie klienta
      const pageSize = 20;
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedCourses = sortedCourses.slice(startIndex, endIndex);
      
      const paginationData = {
        page: page,
        page_size: pageSize,
        total_pages: Math.ceil(sortedCourses.length / pageSize),
        count: sortedCourses.length
      };
      
      console.log('[DEBUG] Pagination data:', paginationData);
      console.log('[DEBUG] Courses for current page:', paginatedCourses.length);
      
      setCourses(paginatedCourses);
      setPagination(paginationData);
      
      // Cache'uj tylko pierwszą stronę
      if (page === 1) {
        console.log('[DEBUG] Caching first page data');
        setCachedCourses({
          results: paginatedCourses,
          pagination: paginationData
        });
      }
      
      console.log('[DEBUG] Courses loaded successfully from Firestore');
    } catch (err) {
      console.error('[DEBUG] Error fetching courses from Firestore:', err);
      
      // Retry logic dla błędów sieciowych
      if (retryCount < 2) {
        console.log(`[DEBUG] Retrying... Attempt ${retryCount + 1}`);
        setTimeout(() => {
          fetchCourses(page, useCache, retryCount + 1);
        }, 1000 * (retryCount + 1)); // Exponential backoff
        return;
      }
      
      if (err instanceof Error) {
        setError(`Failed to load courses from Firestore: ${err.message}`);
      } else {
        setError('Failed to load courses from Firestore');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.email, setLoading, setError, setCourses, setPagination, getCachedCourses]);

  useEffect(() => {
    // Natychmiastowe pobranie kursów bez cache'owania przy pierwszym ładowaniu
    fetchCourses(1, false);
  }, [fetchCourses]);

  // Usunięte funkcje związane z tworzeniem kursów - tylko admin może tworzyć kursy

  // Funkcja sprawdzająca czy nauczyciel może usunąć kurs
  const canDeleteCourse = useCallback((course: Course) => {
    if (isAdmin) return true; // Admin może usunąć każdy kurs
    if (!user?.email) return false;
    
    // Nauczyciel może usunąć kurs, który sam utworzył
    return course.created_by === user.email || course.teacherEmail === user.email;
  }, [isAdmin, user?.email]);

  const handleDeleteCourse = useCallback(async (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    const confirmMessage = isAdmin 
      ? 'Czy na pewno chcesz usunąć ten kurs? Ta operacja jest nieodwracalna.'
      : 'Czy na pewno chcesz usunąć swój kurs? Ta operacja jest nieodwracalna.';
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setDeletingCourse(courseId);
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'courses', courseId));
      
      const successMessage = isAdmin 
        ? 'Kurs został pomyślnie usunięty'
        : 'Twój kurs został pomyślnie usunięty';
      
      setSuccess(successMessage);
      clearCache();
      fetchCourses(pagination.page, false);
    } catch (error) {
      console.error('Error deleting course:', error);
      setError('Błąd podczas usuwania kursu');
    } finally {
      setDeletingCourse(null);
    }
  }, [setDeletingCourse, setSuccess, clearCache, fetchCourses, pagination.page, setError, courses, isAdmin]);

  // Funkcja do aktualizacji nazwy kursu
  const handleUpdateCourseTitle = useCallback(async (courseId: string) => {
    if (!newTitle.trim()) {
      setError('Nazwa kursu nie może być pusta');
      return;
    }

    setIsUpdatingTitle(true);
    try {
      const { updateDoc, doc, serverTimestamp } = await import('firebase/firestore');
      const courseRef = doc(db, 'courses', courseId);
      
      await updateDoc(courseRef, {
        title: newTitle.trim(),
        updated_at: serverTimestamp()
      });
      
      setSuccess('Nazwa kursu została zaktualizowana');
      setEditingCourseId(null);
      setNewTitle('');
      clearCache();
      fetchCourses(pagination.page, false);
    } catch (error) {
      console.error('Error updating course title:', error);
      setError('Błąd podczas aktualizacji nazwy kursu');
    } finally {
      setIsUpdatingTitle(false);
    }
  }, [newTitle, clearCache, fetchCourses, pagination.page, setError, setSuccess]);

  // Funkcja do rozpoczęcia edycji nazwy kursu
  const handleStartEditTitle = useCallback((course: Course) => {
    setEditingCourseId(course.id);
    setNewTitle(course.title);
  }, []);

  // Funkcja do anulowania edycji nazwy kursu
  const handleCancelEditTitle = useCallback(() => {
    setEditingCourseId(null);
    setNewTitle('');
  }, []);


  // Function to create new course
  const handleCreateCourse = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newCourse.title.trim() || !newCourse.description.trim() || !newCourse.subject.trim() || !newCourse.instructor_name.trim() || !newCourse.category_name.trim()) {
      setError('Wypełnij wszystkie wymagane pola');
      return;
    }
    
    if (!user?.email) {
      setError('Nie można zidentyfikować użytkownika');
      return;
    }
    
    setCreatingCourse(true);
    setError(null);
    
    try {
      console.log('Creating new course:', newCourse);
      
      // Sprawdź czy kurs o takiej samej nazwie już istnieje
      const firestoreModule = await import('firebase/firestore');
      const coursesRef = firestoreModule.collection(db, 'courses');
      const titleQuery = firestoreModule.query(coursesRef, firestoreModule.where('title', '==', newCourse.title.trim()));
      const titleSnapshot = await firestoreModule.getDocs(titleQuery);
      
      if (!titleSnapshot.empty) {
        setError('Kurs o takiej nazwie już istnieje. Musisz wybrać inną nazwę.');
        setCreatingCourse(false);
        return;
      }
      
      // Generate slug from title
      const generateSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Remove double hyphens
          .trim();
      };
      
      const slug = generateSlug(newCourse.title);
      
      const courseData = {
        title: newCourse.title.trim(),
        description: newCourse.description.trim(),
        subject: newCourse.subject.trim(),
        year_of_study: newCourse.year_of_study,
        teacherEmail: user.email,
        instructor_name: newCourse.instructor_name.trim(),
        category_name: newCourse.category_name.trim(),
        courseType: newCourse.courseType,
        created_by: user.email,
        assignedUsers: [],
        sections: [],
        pdfUrls: [],
        links: [],
        slug: slug,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('💾 [DEBUG] Saving course data to Firestore:', {
        ...courseData,
        courseType: courseData.courseType,
        courseTypeType: typeof courseData.courseType
      });
      
      const docRef = await firestoreModule.addDoc(firestoreModule.collection(db, 'courses'), courseData);
      
      console.log('Course created successfully with ID:', docRef.id);
      
      setSuccess('Kurs został pomyślnie utworzony!');
      setShowCreateCourse(false);
      setNewCourse({
        title: '',
        description: '',
        subject: '',
        year_of_study: 1,
        instructor_name: '',
        category_name: '',
        courseType: 'obowiązkowy'
      });
      
      // Refresh courses list
      clearCache();
      fetchCourses(1, false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (error) {
      console.error('Error creating course:', error);
      setError('Błąd podczas tworzenia kursu. Spróbuj ponownie.');
    } finally {
      setCreatingCourse(false);
    }
  }, [newCourse, user, clearCache, fetchCourses]);

  // Function to copy course
  const handleCopyCourse = useCallback(async (sourceCourseId: string) => {
    if (!user?.email) {
      setError('Nie można zidentyfikować użytkownika');
      return;
    }

    setCreatingCourse(true);
    setError(null);
    setShowCopyCourseModal(false);

    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const sourceCourseRef = doc(db, 'courses', sourceCourseId);
      const sourceCourseSnap = await getDoc(sourceCourseRef);

      if (!sourceCourseSnap.exists()) {
        setError('Kurs źródłowy nie został znaleziony');
        return;
      }

      const sourceCourseData = sourceCourseSnap.data();
      
      console.log('📋 [DEBUG] Copying course:', {
        sourceCourseId: sourceCourseId,
        sourceTitle: sourceCourseData.title,
        sourceAssignedUsers: sourceCourseData.assignedUsers || [],
        sourceAssignedClasses: sourceCourseData.assignedClasses || [],
        sourceTeacherEmail: sourceCourseData.teacherEmail,
        sourceCreatedBy: sourceCourseData.created_by
      });
      
      // Generate slug from title
      const generateSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
      };

      // Wymuś nową nazwę - dodaj " (Kopia)" jeśli nie ma
      let newTitle = sourceCourseData.title.includes(' (Kopia)')
        ? sourceCourseData.title.replace(' (Kopia)', '') + ' (Kopia 2)'
        : sourceCourseData.title + ' (Kopia)';
      
      // Sprawdź czy kurs o takiej nazwie już istnieje i znajdź unikalną nazwę
      const firestoreModuleCopy = await import('firebase/firestore');
      const coursesRef = firestoreModuleCopy.collection(db, 'courses');
      let counter = 2;
      let titleQuery = firestoreModuleCopy.query(coursesRef, firestoreModuleCopy.where('title', '==', newTitle));
      let titleSnapshot = await firestoreModuleCopy.getDocs(titleQuery);
      
      while (!titleSnapshot.empty) {
        const baseTitle = sourceCourseData.title.includes(' (Kopia)')
          ? sourceCourseData.title.replace(/ \(Kopia.*\)$/, '')
          : sourceCourseData.title;
        newTitle = `${baseTitle} (Kopia ${counter})`;
        counter++;
        titleQuery = firestoreModuleCopy.query(coursesRef, firestoreModuleCopy.where('title', '==', newTitle));
        titleSnapshot = await firestoreModuleCopy.getDocs(titleQuery);
        
        // Zabezpieczenie przed nieskończoną pętlą
        if (counter > 100) {
          newTitle = `${baseTitle} (Kopia ${Date.now()})`;
          break;
        }
      }
      
      const slug = generateSlug(newTitle);

      // Kopiuj dane kursu, ale z nową nazwą i czystymi danymi
      // WAŻNE: Nie kopiujemy ID - Firestore automatycznie utworzy nowe ID przy addDoc
      const courseData = {
        title: newTitle,
        description: sourceCourseData.description || '',
        subject: sourceCourseData.subject || '',
        year_of_study: sourceCourseData.year_of_study || 1,
        teacherEmail: user.email,
        instructor_name: sourceCourseData.instructor_name || '',
        category_name: sourceCourseData.category_name || '',
        courseType: sourceCourseData.courseType || 'obowiązkowy',
        created_by: user.email,
        assignedUsers: [], // Nowy kurs nie ma przypisanych użytkowników - MUSI być przypisany ponownie
        assignedClasses: sourceCourseData.assignedClasses ? [...sourceCourseData.assignedClasses] : [], // Kopiuj klasy
        sections: sourceCourseData.sections ? JSON.parse(JSON.stringify(sourceCourseData.sections)) : [], // Głęboka kopia sekcji
        pdfUrls: sourceCourseData.pdfUrls ? [...sourceCourseData.pdfUrls] : [],
        links: sourceCourseData.links ? [...sourceCourseData.links] : [],
        slug: slug,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('💾 [DEBUG] New course data to be saved:', {
        title: courseData.title,
        assignedUsers: courseData.assignedUsers,
        assignedClasses: courseData.assignedClasses,
        teacherEmail: courseData.teacherEmail,
        createdBy: courseData.created_by,
        slug: courseData.slug
      });

      // Usuń submissions z sekcji typu assignment (nowy kurs nie powinien mieć starych zgłoszeń)
      if (courseData.sections && Array.isArray(courseData.sections)) {
        courseData.sections = courseData.sections.map((section: any) => {
          if (section.type === 'assignment' && section.submissions) {
            return { ...section, submissions: [] };
          }
          return section;
        });
      }

      // Tworzymy NOWY dokument z NOWYM ID - addDoc automatycznie tworzy nowe ID
      const docRef = await firestoreModuleCopy.addDoc(firestoreModuleCopy.collection(db, 'courses'), courseData);
      
      console.log('✅ [DEBUG] Course copied successfully!', {
        oldCourseId: sourceCourseId,
        oldTitle: sourceCourseData.title,
        newCourseId: docRef.id,
        newTitle: newTitle,
        assignedUsers: courseData.assignedUsers,
        assignedClasses: courseData.assignedClasses,
        teacherEmail: courseData.teacherEmail
      });
      
      // Zweryfikuj, że nowy kurs został utworzony z nowym ID
      const verifyDoc = await firestoreModuleCopy.getDoc(firestoreModuleCopy.doc(db, 'courses', docRef.id));
      if (verifyDoc.exists()) {
        const verifyData = verifyDoc.data();
        console.log('✅ [DEBUG] Verification - New course exists:', {
          id: docRef.id,
          title: verifyData.title,
          assignedUsers: verifyData.assignedUsers,
          assignedClasses: verifyData.assignedClasses
        });
      } else {
        console.error('❌ [DEBUG] Verification failed - New course does not exist!');
      }

      setSuccess('Kurs został pomyślnie skopiowany!');
      
      // Wypełnij formularz danymi skopiowanego kursu (ale z nową nazwą)
      setNewCourse({
        title: newTitle,
        description: courseData.description,
        subject: courseData.subject,
        year_of_study: courseData.year_of_study,
        instructor_name: courseData.instructor_name,
        category_name: courseData.category_name,
        courseType: courseData.courseType as 'obowiązkowy' | 'fakultatywny'
      });
      
      setShowCreateCourse(true);
      
      // Refresh courses list
      clearCache();
      fetchCourses(1, false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (error) {
      console.error('Error copying course:', error);
      setError('Błąd podczas kopiowania kursu. Spróbuj ponownie.');
    } finally {
      setCreatingCourse(false);
    }
  }, [user, clearCache, fetchCourses]);


  // Filtruj kursy gdy zmienia się searchTerm, courseTypeFilter lub courses
  useEffect(() => {
    console.log('🔄 [DEBUG] useEffect filterCourses triggered:', {
      coursesLength: courses.length,
      searchTerm,
      courseTypeFilter,
      coursesData: courses.map(c => ({
        id: c.id,
        title: c.title,
        courseType: c.courseType
      }))
    });
    
    const filtered = filterCourses(courses, searchTerm, courseTypeFilter);
    console.log('🔄 [DEBUG] Setting filteredCourses:', filtered.length);
    setFilteredCourses(filtered);
  }, [courses, searchTerm, courseTypeFilter, filterCourses]);

  return (
    <div className="min-h-screen bg-blue-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/30 p-8 mb-8 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {isAdmin ? 'Wszystkie kursy' : 'Moje kursy'}
              </h1>
              <p className="text-gray-600 mt-1">Zarządzaj swoimi kursami i materiałami dydaktycznymi</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {/* Add Course Button - only for teachers */}
            {!isAdmin && (
              <button
                onClick={() => setShowCreateCourse(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
              >
                <Plus className="h-5 w-5" />
                Dodaj kurs
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/30 p-6 shadow-lg">
          
          {/* Stats and Search */}
          <div className="mb-6 flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{courses.length}</div>
                <div className="text-sm text-gray-600">Łącznie kursów</div>
              </div>
              {searchTerm && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{filteredCourses.length}</div>
                  <div className="text-sm text-gray-600">Znalezionych</div>
                </div>
              )}
            </div>
            
            {/* Search */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Wyszukaj kursy po tytule, opisie, przedmiocie..."
                className="block w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Filter by course type */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Filtruj według typu:</span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                Aktualny: {courseTypeFilter} | 
                Wszystkie: {courses.length} | 
                Obowiązkowe: {courses.filter(c => (c.courseType || 'obowiązkowy') === 'obowiązkowy').length} | 
                Fakultatywne: {courses.filter(c => (c.courseType || 'obowiązkowy') === 'fakultatywny').length}
              </span>
              <div className="flex bg-gray-100 rounded-lg p-1 shadow-sm">
                <button
                  onClick={() => {
                    console.log('🔘 [DEBUG] Wszystkie button clicked');
                    setCourseTypeFilter('wszystkie');
                  }}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 ${
                    courseTypeFilter === 'wszystkie' 
                      ? 'bg-white text-blue-600 shadow-md transform scale-105' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Wszystkie
                </button>
                <button
                  onClick={() => {
                    console.log('🔘 [DEBUG] Obowiązkowe button clicked');
                    setCourseTypeFilter('obowiązkowy');
                  }}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 ${
                    courseTypeFilter === 'obowiązkowy' 
                      ? 'bg-white text-red-600 shadow-md transform scale-105' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Obowiązkowe
                </button>
                <button
                  onClick={() => {
                    console.log('🔘 [DEBUG] Fakultatywne button clicked');
                    setCourseTypeFilter('fakultatywny');
                  }}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 ${
                    courseTypeFilter === 'fakultatywny' 
                      ? 'bg-white text-blue-600 shadow-md transform scale-105' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Fakultatywne
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-3 text-gray-600">Ładowanie kursów...</p>
              <p className="text-sm text-gray-500 mt-1">To może potrwać kilka sekund</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg mb-6">{error}</div>
          ) : (
            <>
              <div className="max-h-[700px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 mb-8 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                {filteredCourses.map((course) => (
                  <div key={`${course.id}-${course.updated_at || course.created_at}`} className="bg-white/90 backdrop-blur-sm rounded-2xl border border-white/30 p-4 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 transform hover:-translate-y-1 group h-80 flex flex-col">
                    {/* Course Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <BookOpen className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex gap-1">
                        {canDeleteCourse(course) && (
                          <>
                            <button
                              onClick={() => handleStartEditTitle(course)}
                              className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                              title="Edytuj nazwę kursu"
                            >
                              <Edit className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteCourse(course.id.toString())}
                              disabled={deletingCourse === course.id.toString()}
                              className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                              title="Usuń kurs"
                            >
                              {deletingCourse === course.id.toString() ? (
                                <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Course Info */}
                    <div className="mb-4 flex-1 min-h-0">
                      <h3 className="text-lg font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {course.title}
                      </h3>
                      <div className="flex items-center gap-2 mb-4">
                        <p className="text-xs text-gray-600 font-medium">Rok {course.year_of_study} • {course.subject}</p>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          (course.courseType || 'obowiązkowy') === 'obowiązkowy' 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {(course.courseType || 'obowiązkowy') === 'obowiązkowy' ? 'Obowiązkowy' : 'Fakultatywny'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Course Stats */}
                    <div className="mb-6 flex-shrink-0">
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="text-xs text-gray-600 font-medium">Sekcje</span>
                        <span className="text-sm font-bold text-blue-600">{course.sections?.length || 0}</span>
                      </div>
                    </div>
                    
                    {/* Admin Info */}
                    {isAdmin && course.created_by && (
                      <div className="text-xs text-gray-500 mb-4 p-2 bg-gray-50 rounded">
                        Nauczyciel: {course.created_by}
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-auto flex-shrink-0 h-10">
                      <button 
                        onClick={() => window.location.href = `/homelogin/teacher/courses/${course.id}`}
                        className="flex-1 bg-blue-600 text-white py-2 px-2 rounded-lg hover:bg-blue-700 transition-all duration-300 font-medium text-xs shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                      >
                        Zarządzaj
                      </button>
                      <Link 
                        href={`/courses/${course.slug}`}
                        className="w-10 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-all duration-300 border border-green-200 hover:border-green-300 font-medium flex items-center justify-center"
                      >
                        <FileText className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Paginacja */}
              {pagination.total_pages > 1 && (
                <div className="flex justify-center items-center space-x-2 mb-6">
                  <button
                    onClick={() => fetchCourses(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Poprzednia
                  </button>
                  
                  <span className="px-4 py-2 text-sm text-gray-700">
                    Strona {pagination.page} z {pagination.total_pages} ({pagination.count} kursów)
                  </span>
                  
                  <button
                    onClick={() => fetchCourses(pagination.page + 1)}
                    disabled={pagination.page >= pagination.total_pages}
                    className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Następna
                  </button>
                </div>
              )}
            </>
          )}

        </div>
      </div>
      
      {/* Create Course Modal */}
      {showCreateCourse && (
        <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-xl font-bold">+</span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Utwórz nowy kurs</h2>
                </div>
                <button
                  onClick={() => setShowCreateCourse(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors group"
                >
                  <span className="text-gray-500 group-hover:text-gray-700 text-lg font-medium">×</span>
                </button>
              </div>
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              <form onSubmit={handleCreateCourse} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tytuł kursu *
                  </label>
                  <input
                    type="text"
                    value={newCourse.title}
                    onChange={(e) => setNewCourse(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Wprowadź tytuł kursu"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Opis kursu *
                  </label>
                  <textarea
                    value={newCourse.description}
                    onChange={(e) => setNewCourse(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Wprowadź opis kursu"
                    rows={3}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Przedmiot *
                  </label>
                  <input
                    type="text"
                    value={newCourse.subject}
                    onChange={(e) => setNewCourse(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="np. Matematyka, Historia, Fizyka"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rok nauczania
                  </label>
                  <select
                    value={newCourse.year_of_study}
                    onChange={(e) => setNewCourse(prev => ({ ...prev, year_of_study: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={1}>Rok 1</option>
                    <option value={2}>Rok 2</option>
                    <option value={3}>Rok 3</option>
                    <option value={4}>Rok 4</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Imię i nazwisko nauczyciela *
                  </label>
                  <input
                    type="text"
                    value={newCourse.instructor_name}
                    onChange={(e) => setNewCourse(prev => ({ ...prev, instructor_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="np. Dr. Anna Kowalska"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kategoria kursu *
                  </label>
                  <input
                    type="text"
                    value={newCourse.category_name}
                    onChange={(e) => setNewCourse(prev => ({ ...prev, category_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="np. Nauki ścisłe, Humanistyczne, Języki"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Typ kursu *
                  </label>
                  <select
                    value={newCourse.courseType}
                    onChange={(e) => setNewCourse(prev => ({ ...prev, courseType: e.target.value as 'obowiązkowy' | 'fakultatywny' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="obowiązkowy">Obowiązkowy</option>
                    <option value="fakultatywny">Fakultatywny</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {newCourse.courseType === 'obowiązkowy' 
                      ? 'Kurs obowiązkowy - uczniowie muszą go ukończyć' 
                      : 'Kurs fakultatywny - uczniowie mogą go wybrać opcjonalnie'
                    }
                  </p>
                </div>
                
                <div className="pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateCourse(false);
                      setShowCopyCourseModal(true);
                    }}
                    className="w-full mb-3 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <BookOpen className="w-4 h-4" />
                    Dodaj na podstawie innego kursu
                  </button>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={creatingCourse}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingCourse ? (
                      <div className="flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Tworzenie...
                      </div>
                    ) : (
                      'Utwórz kurs'
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setShowCreateCourse(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                  >
                    Anuluj
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal wyboru kursu do skopiowania */}
      {showCopyCourseModal && (
        <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Wybierz kurs do skopiowania</h2>
                </div>
                <button
                  onClick={() => {
                    setShowCopyCourseModal(false);
                    setCopyCourseSearchTerm('');
                  }}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors group"
                >
                  <span className="text-gray-500 group-hover:text-gray-700 text-lg font-medium">×</span>
                </button>
              </div>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {/* Wyszukiwarka i sortowanie */}
              <div className="mb-4 space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={copyCourseSearchTerm}
                    onChange={(e) => setCopyCourseSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Szukaj kursu po nazwie, przedmiocie..."
                  />
                  <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                </div>
                
                <div className="flex gap-3">
                  <select
                    value={copyCourseSortBy}
                    onChange={(e) => setCopyCourseSortBy(e.target.value as 'title' | 'created_at' | 'subject')}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="title">Sortuj według nazwy</option>
                    <option value="created_at">Sortuj według daty utworzenia</option>
                    <option value="subject">Sortuj według przedmiotu</option>
                  </select>
                  <button
                    onClick={() => setCopyCourseSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {copyCourseSortOrder === 'asc' ? '↑ Rosnąco' : '↓ Malejąco'}
                  </button>
                </div>
              </div>

              {/* Lista kursów */}
              <div className="space-y-2">
                {(() => {
                  // Filtruj i sortuj kursy
                  let filtered = courses.filter(course => {
                    const searchLower = copyCourseSearchTerm.toLowerCase();
                    const titleMatch = course.title?.toLowerCase().includes(searchLower);
                    const subjectMatch = course.subject?.toLowerCase().includes(searchLower);
                    const descriptionMatch = course.description?.toLowerCase().includes(searchLower);
                    return titleMatch || subjectMatch || descriptionMatch;
                  });

                  // Sortuj
                  filtered.sort((a, b) => {
                    let aValue: any;
                    let bValue: any;

                    if (copyCourseSortBy === 'title') {
                      aValue = a.title?.toLowerCase() || '';
                      bValue = b.title?.toLowerCase() || '';
                    } else if (copyCourseSortBy === 'created_at') {
                      aValue = new Date(a.created_at || 0).getTime();
                      bValue = new Date(b.created_at || 0).getTime();
                    } else if (copyCourseSortBy === 'subject') {
                      aValue = a.subject?.toLowerCase() || '';
                      bValue = b.subject?.toLowerCase() || '';
                    }

                    if (copyCourseSortOrder === 'asc') {
                      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
                    } else {
                      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
                    }
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        {copyCourseSearchTerm ? 'Nie znaleziono kursów pasujących do wyszukiwania' : 'Brak dostępnych kursów'}
                      </div>
                    );
                  }

                  return filtered.map((course) => (
                    <div
                      key={course.id}
                      onClick={() => handleCopyCourse(course.id)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">{course.title}</h3>
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{course.description}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>{course.subject}</span>
                            <span>•</span>
                            <span>Rok {course.year_of_study}</span>
                            {course.sections && (
                              <>
                                <span>•</span>
                                <span>{course.sections.length} sekcji</span>
                              </>
                            )}
                          </div>
                        </div>
                        <button className="ml-4 px-3 py-1 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                          Skopiuj
                        </button>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal do edycji nazwy kursu */}
      {editingCourseId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Edytuj nazwę kursu</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nowa nazwa kursu *
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                placeholder="Wprowadź nową nazwę kursu"
                maxLength={100}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleUpdateCourseTitle(editingCourseId)}
                disabled={isUpdatingTitle || !newTitle.trim()}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-blue-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdatingTitle ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Zapisywanie...
                  </div>
                ) : (
                  'Zapisz zmiany'
                )}
              </button>
              
              <button
                onClick={handleCancelEditTitle}
                disabled={isUpdatingTitle}
                className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-xl font-semibold hover:bg-gray-300 transition-all duration-300 disabled:opacity-50"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 