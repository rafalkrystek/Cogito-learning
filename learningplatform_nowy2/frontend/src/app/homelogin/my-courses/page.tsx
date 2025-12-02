"use client";
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import Image from "next/image";
import { HiOutlineDotsVertical } from "react-icons/hi";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../config/firebase";
import { useRouter } from 'next/navigation';
import Providers from '@/components/Providers';
import { ArrowLeft, Grid3X3, List, Search, X, BookOpen, Star, ArrowUp, ArrowDown } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

interface Course {
  id: number;
  title: string;
  description?: string;
  year_of_study?: number;
  subject?: string;
  is_active?: boolean;
  assignedUsers: string[];
  slug?: string;
  firebase_id?: string;
  thumbnail?: string;
  category_name?: string;
}

function MyCoursesPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [search, setSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [sortBy, setSortBy] = useState<'title' | 'subject' | 'date'>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const fetchCourses = async () => {
      try {
        const coursesCollection = collection(db, "courses");
        
        // Użyj query z where zamiast pobierania wszystkich kursów
        const [coursesByUid, coursesByEmail] = await Promise.all([
          getDocs(query(coursesCollection, where('assignedUsers', 'array-contains', user.uid))),
          user.email ? getDocs(query(coursesCollection, where('assignedUsers', 'array-contains', user.email))) : Promise.resolve({ docs: [] } as any)
        ]);
        
        // Połącz i deduplikuj kursy
        const coursesMap = new Map();
        [...coursesByUid.docs, ...coursesByEmail.docs].forEach(doc => {
          coursesMap.set(doc.id, {
            id: doc.id,
            firebase_id: doc.id,
            ...doc.data()
          } as unknown as Course);
        });
        
        const filtered = Array.from(coursesMap.values());
        setCourses(filtered);
        setFilteredCourses(filtered);
      } catch (error) {
        console.error('Error fetching courses:', error);
        setCourses([]);
        setFilteredCourses([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [user]);

  // Funkcja sortowania
  const sortCourses = useCallback((coursesToSort: Course[]) => {
    return [...coursesToSort].sort((a, b) => {
      let aValue: string | number = '';
      let bValue: string | number = '';
      
      switch (sortBy) {
        case 'title':
          aValue = a.title?.toLowerCase() || '';
          bValue = b.title?.toLowerCase() || '';
          break;
        case 'subject':
          aValue = a.subject?.toLowerCase() || a.category_name?.toLowerCase() || '';
          bValue = b.subject?.toLowerCase() || b.category_name?.toLowerCase() || '';
          break;
        case 'date':
          aValue = a.id || 0;
          bValue = b.id || 0;
          break;
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [sortBy, sortOrder]);

  // Automatyczne sortowanie gdy zmienia się sortBy lub sortOrder
  useEffect(() => {
    if (search) {
      const filtered = courses.filter(course => {
        const title = course.title?.toLowerCase() || '';
        const description = course.description?.toLowerCase() || '';
        const subject = course.subject?.toLowerCase() || '';
        const searchTerm = search.toLowerCase();
        
        return title.includes(searchTerm) || description.includes(searchTerm) || subject.includes(searchTerm);
      });
      setFilteredCourses(sortCourses(filtered));
    } else {
      setFilteredCourses(sortCourses(courses));
    }
  }, [sortBy, sortOrder, courses, search, sortCourses]);

  // Funkcja wyszukiwania
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    
    if (value.length === 0) {
      setFilteredCourses(sortCourses(courses));
      setShowSearchResults(false);
    } else {
      const filtered = courses.filter(course => {
        const title = course.title?.toLowerCase() || '';
        const description = course.description?.toLowerCase() || '';
        const subject = course.subject?.toLowerCase() || '';
        const searchTerm = value.toLowerCase();
        
        return title.includes(searchTerm) || description.includes(searchTerm) || subject.includes(searchTerm);
      });
      setFilteredCourses(sortCourses(filtered));
      setShowSearchResults(true);
    }
  };

  // Funkcja zmiany sortowania
  const handleSortChange = (newSortBy: 'title' | 'subject' | 'date') => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  };

  // Funkcja nawigacji do kursu
  const handleCourseClick = (course: Course) => {
    if (course.slug) {
      router.push(`/courses/${course.slug}`);
    } else {
      router.push(`/courses/${course.firebase_id || course.id}`);
    }
  };

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full">
      {/* Header z przyciskiem powrotu */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/homelogin')}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Powrót
          </button>
          
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Moje kursy
          </h1>
          
          {/* Kontrolki widoku */}
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="flex bg-gray-100 rounded-lg p-1 shadow-sm">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 ${
                  viewMode === 'grid' 
                    ? 'bg-white text-[#4067EC] shadow-md transform scale-105' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 ${
                  viewMode === 'list' 
                    ? 'bg-white text-[#4067EC] shadow-md transform scale-105' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Wyszukiwarka i sortowanie */}
      <div className="bg-white/60 backdrop-blur-sm border-b border-white/20 px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 items-center justify-between">
            {/* Wyszukiwarka */}
            <div className="relative flex-1 w-full lg:max-w-2xl" ref={searchRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Wyszukaj kursy..."
                  style={{ fontSize: '16px' }}
                  className="w-full pl-10 pr-10 py-2 sm:py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC] text-gray-900 transition-all duration-200 ease-in-out hover:border-gray-300 hover:shadow-sm bg-white/80 backdrop-blur-sm"
                  value={search}
                  onChange={handleSearchChange}
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setFilteredCourses(sortCourses(courses));
                      setShowSearchResults(false);
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 hover:scale-110 active:scale-95 transition-all duration-200 ease-in-out p-1 rounded-full hover:bg-gray-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Sortowanie */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Sortuj według:</span>
              <div className="flex bg-gray-100 rounded-lg p-1 shadow-sm">
                <button
                  onClick={() => handleSortChange('title')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 flex items-center gap-1 ${
                    sortBy === 'title' 
                      ? 'bg-white text-[#4067EC] shadow-md transform scale-105' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Tytuł
                  {sortBy === 'title' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  )}
                </button>
                <button
                  onClick={() => handleSortChange('subject')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 flex items-center gap-1 ${
                    sortBy === 'subject' 
                      ? 'bg-white text-[#4067EC] shadow-md transform scale-105' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Przedmiot
                  {sortBy === 'subject' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  )}
                </button>
                <button
                  onClick={() => handleSortChange('date')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 flex items-center gap-1 ${
                    sortBy === 'date' 
                      ? 'bg-white text-[#4067EC] shadow-md transform scale-105' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Data
                  {sortBy === 'date' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Główna zawartość */}
      <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-600 animate-pulse">Ładowanie kursów...</div>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-600 text-lg animate-fade-in">
              {search ? 'Nie znaleziono kursów pasujących do wyszukiwania.' : 'Nie zostały jeszcze przypisane do Ciebie żadne kursy.'}
            </div>
          </div>
        ) : (
          <>
            {/* Informacja o liczbie kursów */}
            <div className="mb-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {search ? (
                  <>Znaleziono <span className="font-semibold text-[#4067EC]">{filteredCourses.length}</span> kursów dla &quot;<span className="font-semibold">{search}</span>&quot;</>
                ) : (
                  <>Wyświetlane <span className="font-semibold text-[#4067EC]">{filteredCourses.length}</span> z <span className="font-semibold">{courses.length}</span> kursów</>
                )}
              </div>
              <div className="text-xs text-gray-500">
                Sortowanie: {sortBy === 'title' ? 'Tytuł' : sortBy === 'subject' ? 'Przedmiot' : 'Data'} ({sortOrder === 'asc' ? 'A-Z' : 'Z-A'})
              </div>
            </div>
          <div className={`${
            viewMode === 'grid' 
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6 lg:gap-8' 
              : 'space-y-4 lg:space-y-6'
          }`}>
            {filteredCourses.map((course, index) => (
              <div
                key={course.id}
                onClick={() => handleCourseClick(course)}
                className={`bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-xl hover:shadow-blue-100/50 transition-all duration-300 ease-in-out cursor-pointer border border-white/20 hover:border-[#4067EC]/30 group animate-fade-in-up ${
                  viewMode === 'grid' 
                    ? 'overflow-hidden hover:scale-105 active:scale-95' 
                    : 'flex items-center p-4 lg:p-6 hover:scale-[1.02] active:scale-[0.98]'
                }`}
                style={{
                  animationDelay: `${index * 50}ms`
                }}
              >
                {viewMode === 'grid' ? (
                  // Widok kafelków
                  <div className="h-full flex flex-col">
                    <div className="relative h-40 sm:h-48 lg:h-56 bg-gray-100 overflow-hidden">
                      <Image 
                        src={course.thumbnail || "/thumb.png"} 
                        alt={course.title || 'Course thumbnail'} 
                        fill
                        className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <BookOpen className="w-4 h-4 text-[#4067EC]" />
                      </div>
                    </div>
                    <div className="p-4 lg:p-6 flex-1 flex flex-col">
                      <h3 className="font-semibold text-base sm:text-lg lg:text-xl text-gray-900 mb-2 group-hover:text-[#4067EC] transition-colors duration-200" style={{ 
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {course.title}
                      </h3>
                      <p className="text-sm lg:text-base text-gray-600 mb-2 group-hover:text-gray-700 transition-colors duration-200 flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        {course.subject || course.category_name || '-'}
                      </p>
                      <p className="text-sm lg:text-base text-gray-500 mb-4 flex-1 group-hover:text-gray-600 transition-colors duration-200" style={{ 
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {course.description || 'Brak opisu'}
                      </p>
                      {/* Pasek postępu */}
                      <div className="mt-auto">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs lg:text-sm text-gray-600 group-hover:text-gray-700 transition-colors duration-200">Postęp</span>
                          <span className="text-xs lg:text-sm text-gray-600 group-hover:text-[#4067EC] transition-colors duration-200">0%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 lg:h-3 overflow-hidden">
                          <div className="bg-gradient-to-r from-[#4067EC] to-[#5577FF] h-2 lg:h-3 rounded-full transition-all duration-300 ease-in-out group-hover:from-[#3155d4] group-hover:to-[#4067EC]" style={{ width: '0%' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Widok listy
                  <>
                    <div className="relative w-20 h-16 sm:w-24 sm:h-20 lg:w-32 lg:h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 group-hover:shadow-md transition-shadow duration-200">
                      <Image 
                        src={course.thumbnail || "/thumb.png"} 
                        alt={course.title || 'Course thumbnail'} 
                        fill
                        className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                    <div className="flex-1 ml-4 lg:ml-6 min-w-0">
                      <h3 className="font-semibold text-base sm:text-lg lg:text-xl text-gray-900 mb-1 group-hover:text-[#4067EC] transition-colors duration-200">
                        {course.title}
                      </h3>
                      <p className="text-sm lg:text-base text-gray-600 mb-2 group-hover:text-gray-700 transition-colors duration-200 flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        {course.subject || course.category_name || '-'}
                      </p>
                      <p className="text-sm lg:text-base text-gray-500 mb-3 group-hover:text-gray-600 transition-colors duration-200" style={{ 
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {course.description || 'Brak opisu'}
                      </p>
                    {/* Pasek postępu */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 lg:h-3 overflow-hidden">
                          <div className="bg-gradient-to-r from-[#4067EC] to-[#5577FF] h-2 lg:h-3 rounded-full transition-all duration-300 ease-in-out group-hover:from-[#3155d4] group-hover:to-[#4067EC]" style={{ width: '0%' }}></div>
                      </div>
                        <span className="text-xs lg:text-sm text-gray-600 group-hover:text-[#4067EC] transition-colors duration-200">0% ukończenia</span>
                    </div>
                  </div>
                    <button className="ml-4 lg:ml-6 text-gray-400 hover:text-gray-700 hover:scale-110 active:scale-95 p-2 rounded-full transition-all duration-200 ease-in-out hover:bg-gray-100">
                      <HiOutlineDotsVertical size={20} />
                    </button>
                  </>
                )}
                </div>
            ))}
          </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function MyCoursesPage() {
  return (
    <Providers>
      <MyCoursesPageContent />
    </Providers>
  );
} 
