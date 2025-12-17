'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import Providers from '@/components/Providers';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
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

interface Material {
  id: string;
  title: string;
  description: string;
  subject: string;
  courseId: string;
  courseTitle: string;
  fileUrl?: string;
  type: 'document' | 'video' | 'link' | 'other';
  createdAt: string;
  teacherName: string;
}

function StudentMaterialsContent() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchMaterials = useCallback(async () => {
    if (!user) return;
    
    const cacheKey = `student_materials_${user.uid}`;
    const cached = getSessionCache<Material[]>(cacheKey);
    
    if (cached) {
      setMaterials(cached);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // OPTYMALIZACJA: Pobierz tylko kursy ucznia używając where, nie wszystkie kursy!
      const userCourses = await measureAsync('StudentMaterials:fetchCourses', async () => {
        const coursesCollection = collection(db, 'courses');
        
        // Równoległe zapytania dla uid i email
        const [coursesByUid, coursesByEmail] = await Promise.all([
          getDocs(query(coursesCollection, where('assignedUsers', 'array-contains', user.uid))),
          user.email ? getDocs(query(coursesCollection, where('assignedUsers', 'array-contains', user.email))) : Promise.resolve({ docs: [] } as any)
        ]);
        
        // Połącz i deduplikuj
        const coursesMap = new Map();
        [...coursesByUid.docs, ...coursesByEmail.docs].forEach(doc => {
          coursesMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
        
        // Sprawdź kursy przypisane do klas
        if ((user as any).classes && Array.isArray((user as any).classes) && (user as any).classes.length > 0) {
          const classQueries = (user as any).classes.map((classId: string) =>
            getDocs(query(coursesCollection, where('assignedClasses', 'array-contains', classId)))
          );
          const classSnapshots = await Promise.all(classQueries);
          classSnapshots.forEach(snapshot => {
            snapshot.docs.forEach((doc: any) => {
              if (!coursesMap.has(doc.id)) {
                coursesMap.set(doc.id, { id: doc.id, ...doc.data() });
              }
            });
          });
        }
        
        return Array.from(coursesMap.values());
      });

      const courseIds = userCourses.map((c: any) => c.id);
      
      if (courseIds.length === 0) {
        setMaterials([]);
        setLoading(false);
        return;
      }

      // OPTYMALIZACJA: Pobierz tylko materiały z kursów ucznia używając where z 'in'
      // Firestore 'in' może mieć max 10 elementów, więc chunkujemy
      const materialsList = await measureAsync('StudentMaterials:fetchMaterials', async () => {
        const materialsCollection = collection(db, 'materials');
        const chunks: string[][] = [];
        for (let i = 0; i < courseIds.length; i += 10) {
          chunks.push(courseIds.slice(i, i + 10));
        }
        
        const materialQueries = chunks.map(chunk =>
          getDocs(query(materialsCollection, where('courseId', 'in', chunk)))
        );
        
        const materialSnapshots = await Promise.all(materialQueries);
        return materialSnapshots.flatMap(snapshot =>
          snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material))
        );
      });

      setMaterials(materialsList);
      setSessionCache(cacheKey, materialsList);
    } catch (error) {
      console.error('Error fetching materials:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  // Memoized filtered materials
  const filteredMaterials = useMemo(() => {
    return materials.filter(material => {
      const matchesSubject = selectedSubject === 'all' || material.subject === selectedSubject;
      const matchesSearch = material.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           material.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSubject && matchesSearch;
    });
  }, [materials, selectedSubject, searchTerm]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const materialsPerPage = 12; // Responsive

  const paginatedMaterials = useMemo(() => {
    const startIndex = (currentPage - 1) * materialsPerPage;
    return filteredMaterials.slice(startIndex, startIndex + materialsPerPage);
  }, [filteredMaterials, currentPage, materialsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredMaterials.length / materialsPerPage);
  }, [filteredMaterials.length, materialsPerPage]);

  // Memoized subjects
  const subjects = useMemo(() => {
    return ['all', ...Array.from(new Set(materials.map(m => m.subject)))];
  }, [materials]);

  const getMaterialIcon = (type: string) => {
    switch (type) {
      case 'document': return '📄';
      case 'video': return '🎥';
      case 'link': return '🔗';
      default: return '📚';
    }
  };

  const getMaterialTypeLabel = (type: string) => {
    switch (type) {
      case 'document': return 'Dokument';
      case 'video': return 'Wideo';
      case 'link': return 'Link';
      default: return 'Inne';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6FB] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#4067EC] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Ładowanie materiałów...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Header z przyciskiem powrotu */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => window.location.href = '/homelogin'}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Powrót</span>
          </button>
          
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Materiały edukacyjne
          </h1>
          
          <div className="w-20"></div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="bg-white/90 backdrop-blur-xl w-full max-w-6xl mx-auto p-4 md:p-6 rounded-2xl shadow-lg border border-white/20">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Materiały edukacyjne <span className="inline-block">📚</span></h2>
          <p className="text-gray-600 mb-6">Dostępne materiały z Twoich kursów</p>
        
        {/* Filtry i wyszukiwanie */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Wyszukaj materiały..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-transparent"
            />
          </div>
          
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-transparent"
          >
            {subjects.map(subject => (
              <option key={subject} value={subject}>
                {subject === 'all' ? 'Wszystkie przedmioty' : subject}
              </option>
            ))}
          </select>
        </div>

        {filteredMaterials.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">Brak materiałów</h3>
            <p className="text-gray-500">
              {materials.length === 0 
                ? 'Nie masz jeszcze przypisanych materiałów do swoich kursów.'
                : 'Nie znaleziono materiałów spełniających kryteria wyszukiwania.'
              }
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {paginatedMaterials.map((material) => (
              <div key={material.id} className="bg-white/90 backdrop-blur-xl rounded-xl p-4 md:p-6 border border-white/20 hover:border-[#4067EC] transition-all duration-300 hover:shadow-lg">
                <div className="flex items-start gap-3 mb-4">
                  <div className="text-3xl">{getMaterialIcon(material.type)}</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-800 mb-2 line-clamp-2">
                      {material.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-3">
                      {material.description}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium">Przedmiot:</span>
                    <span className="px-2 py-1 bg-[#4067EC] text-white rounded-full text-xs">
                      {material.subject}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium">Kurs:</span>
                    <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded-full text-xs">
                      {material.courseTitle}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium">Typ:</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                      {getMaterialTypeLabel(material.type)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium">Nauczyciel:</span>
                    <span className="text-gray-700">{material.teacherName}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium">Data:</span>
                    <span className="text-gray-700">
                      {new Date(material.createdAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '/')}
                    </span>
                  </div>
                </div>
                
                {material.fileUrl && (
                  <Link
                    href={material.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-[#4067EC] text-white py-2 px-4 rounded-lg font-medium hover:bg-[#3050b3] transition-colors text-center block"
                  >
                    Otwórz materiał
                  </Link>
                )}
              </div>
              ))}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-[#4067EC] text-white rounded-lg hover:bg-[#3050b3] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Poprzednia
                </button>
                <span className="px-4 py-2 text-gray-700">
                  Strona {currentPage} z {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-[#4067EC] text-white rounded-lg hover:bg-[#3050b3] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Następna
                </button>
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}

export default function StudentMaterialsPage() {
  return (
    <Providers>
      <StudentMaterialsContent />
    </Providers>
  );
} 