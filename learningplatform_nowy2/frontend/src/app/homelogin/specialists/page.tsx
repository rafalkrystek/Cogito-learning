"use client";
import { useState, useEffect, useCallback } from 'react';
import Image from "next/image";
import { db } from '@/config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

interface Specialist {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email: string;
  description?: string;
  profileImageUrl?: string;
  photoURL?: string;
  subjects?: string;
  experience?: string;
  education?: string;
  role: string;
  specialization?: string[];
  availability?: string;
  phone?: string;
  department?: string;
  qualifications?: string[];
}

export default function SpecialistsPage() {
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [filteredSpecialists, setFilteredSpecialists] = useState<Specialist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [sortBy, setSortBy] = useState('name');

  useEffect(() => {
    loadSpecialists();
  }, []);

  const filterAndSortSpecialists = useCallback(() => {
    let filtered = [...specialists];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(specialist =>
        specialist.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        specialist.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        specialist.subjects?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        specialist.department?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by role
    if (selectedRole) {
      filtered = filtered.filter(specialist => specialist.role === selectedRole);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          const nameA = a.displayName || `${a.firstName || ''} ${a.lastName || ''}`.trim() || '';
          const nameB = b.displayName || `${b.firstName || ''} ${b.lastName || ''}`.trim() || '';
          return nameA.localeCompare(nameB);
        case 'role':
          return a.role.localeCompare(b.role);
        case 'department':
          return (a.department || '').localeCompare(b.department || '');
        default:
          return 0;
      }
    });

    setFilteredSpecialists(filtered);
  }, [specialists, searchTerm, selectedRole, sortBy]);

  useEffect(() => {
    filterAndSortSpecialists();
  }, [filterAndSortSpecialists]);

  const loadSpecialists = async () => {
    try {
      console.log('Loading specialists from Firestore...');
      const usersCollection = collection(db, 'users');
      
      // Query for specialists (teachers and other staff, excluding instructors)
      const specialistRoles = ['teacher', 'psycholog', 'pedagog', 'logopeda', 'terapeuta', 'bibliotekarz', 'administrator'];
      const allSpecialists: Specialist[] = [];
      
      for (const role of specialistRoles) {
        const q = query(usersCollection, where('role', '==', role));
        const querySnapshot = await getDocs(q);
        
        console.log(`Found ${querySnapshot.size} ${role} specialists`);
        
        const roleSpecialists = querySnapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Specialist data:', { id: doc.id, ...data });
          return {
            id: doc.id,
            ...data,
            role: role
          } as Specialist;
        });
        
        allSpecialists.push(...roleSpecialists);
      }
      
      console.log('Processed all specialists:', allSpecialists);
      setSpecialists(allSpecialists);
    } catch (err) {
      console.error('Error loading specialists:', err);
      setError('Błąd ładowania specjalistów');
    } finally {
      setLoading(false);
    }
  };

  const getSpecialistTypeLabel = (role: string) => {
    switch (role) {
      case 'teacher': return 'Nauczyciel';
      case 'psycholog': return 'Psycholog';
      case 'pedagog': return 'Pedagog';
      case 'logopeda': return 'Logopeda';
      case 'terapeuta': return 'Terapeuta';
      case 'bibliotekarz': return 'Bibliotekarz';
      case 'administrator': return 'Administrator';
      default: return role;
    }
  };

  const getSpecialistTypeColor = (role: string) => {
    switch (role) {
      case 'teacher': return 'bg-blue-100 text-blue-800';
      case 'psycholog': return 'bg-purple-100 text-purple-800';
      case 'pedagog': return 'bg-green-100 text-green-800';
      case 'logopeda': return 'bg-orange-100 text-orange-800';
      case 'terapeuta': return 'bg-pink-100 text-pink-800';
      case 'bibliotekarz': return 'bg-indigo-100 text-indigo-800';
      case 'administrator': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
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
              Specjaliści
            </h1>
            
            <ThemeToggle />
          </div>
        </div>
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="flex justify-center items-center h-64">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#4067EC] border-r-transparent"></div>
            <span className="ml-3 text-gray-600">Ładowanie specjalistów...</span>
          </div>
        </main>
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
            Specjaliści
          </h1>
          
          <ThemeToggle />
        </div>
      </div>
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative">
            {error}
          </div>
        )}

        {/* Search and Filters */}
        <div className="mb-6 bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg p-6 border border-white/20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Wyszukiwarka</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Szukaj po nazwisku, emailu, przedmiocie..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC]"
                />
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filtruj po roli</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC]"
              >
                <option value="">Wszystkie role</option>
                <option value="teacher">Nauczyciele</option>
                <option value="psycholog">Psychologowie</option>
                <option value="pedagog">Pedagodzy</option>
                <option value="logopeda">Logopedzi</option>
                <option value="terapeuta">Terapeuci</option>
                <option value="bibliotekarz">Bibliotekarze</option>
                <option value="administrator">Administratorzy</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sortuj według</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC]"
              >
                <option value="name">Nazwisko</option>
                <option value="role">Rola</option>
                <option value="department">Dział</option>
              </select>
            </div>
          </div>

          {/* Results count */}
          <div className="mt-4 text-sm text-gray-600">
            Znaleziono: {filteredSpecialists.length} z {specialists.length} specjalistów
          </div>
        </div>
        
        {specialists.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Brak dostępnych specjalistów</p>
            <p className="text-gray-400 text-sm mt-2">Brak dostępnych specjalistów w systemie</p>
          </div>
        ) : filteredSpecialists.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Nie znaleziono specjalistów</p>
            <p className="text-gray-400 text-sm mt-2">Spróbuj zmienić kryteria wyszukiwania lub filtry</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredSpecialists.map((specialist) => (
              <div key={specialist.id} className="bg-white/90 backdrop-blur-xl rounded-xl shadow-lg p-3 hover:shadow-xl transition-all duration-300 border border-white/20 h-48 flex flex-col">
                {/* Profile Image */}
                <div className="flex flex-col items-center mb-3 flex-shrink-0">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-[#4067EC] mb-2">
                    {(specialist.profileImageUrl || specialist.photoURL) ? (
                      <Image 
                        src={specialist.profileImageUrl || specialist.photoURL || ''} 
                        alt={specialist.displayName || `${specialist.firstName} ${specialist.lastName}` || 'Specjalista'} 
                        width={48} 
                        height={48} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  <h3 className="font-semibold text-sm text-gray-800 text-center leading-tight">
                    {specialist.displayName || `${specialist.firstName || ''} ${specialist.lastName || ''}`.trim() || 'Brak nazwiska'}
                  </h3>
                  
                  <div className="text-center mt-1">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mb-1 ${getSpecialistTypeColor(specialist.role)}`}>
                      {getSpecialistTypeLabel(specialist.role)}
                    </span>
                    {specialist.subjects && (
                      <p className="text-xs text-[#4067EC] font-medium leading-tight">
                        {specialist.subjects.length > 20 
                          ? `${specialist.subjects.substring(0, 20)}...` 
                          : specialist.subjects
                        }
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Contact Info - Compact */}
                <div className="space-y-1 flex-grow">
                  <div className="flex items-center gap-2 text-xs">
                    <svg className="w-3 h-3 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-gray-600 truncate">{specialist.email}</span>
                  </div>
                  {specialist.phone && (
                    <div className="flex items-center gap-2 text-xs">
                      <svg className="w-3 h-3 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span className="text-gray-600">{specialist.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
