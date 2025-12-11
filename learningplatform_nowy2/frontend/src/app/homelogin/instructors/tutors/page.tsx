"use client";

import React, { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, DocumentData } from 'firebase/firestore';
import { db } from '@/config/firebase';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';

interface Tutor {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  subject?: string;
  description?: string;
  experience?: string;
  specialization?: string[];
  instructorType?: string;
  contactInfo?: {
    phone?: string;
    availability?: string;
  };
}

const TutorViewPage: React.FC = () => {
  const router = useRouter();
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTutors = async () => {
      try {
        setLoading(true);
        setError(null);
        const auth = getAuth();
        const user = auth.currentUser;
        
        if (!user) {
          setError('Użytkownik nie jest zalogowany.');
          setLoading(false);
          return;
        }

        // Pobierz dokument studenta
        const studentDocRef = doc(db, 'users', user.uid);
        const studentSnap = await getDoc(studentDocRef);
        
        if (!studentSnap.exists()) {
          setError('Nie znaleziono dokumentu studenta.');
          setLoading(false);
          return;
        }

        const studentData = studentSnap.data() as DocumentData;
        const primaryTutorId = studentData.primaryTutorId;
        const assignedTutors = studentData.assignedTutors || [];

        if (!primaryTutorId && assignedTutors.length === 0) {
          setError('Nie przypisano żadnych instruktorów.');
          setLoading(false);
          return;
        }

        // Pobierz wszystkich przypisanych instruktorów (nauczycieli, tutorów, wychowawców, nauczycieli wspomagających)
        const allTutorIds = [...new Set([primaryTutorId, ...assignedTutors])].filter(Boolean);
        const tutorsData: Tutor[] = [];

        for (const tutorId of allTutorIds) {
          try {
            const tutorDocRef = doc(db, 'users', tutorId);
            const tutorSnap = await getDoc(tutorDocRef);
            
            if (tutorSnap.exists()) {
              const tutorData = tutorSnap.data() as DocumentData;
              const instructorType = tutorData.role || 'teacher';
              
              tutorsData.push({
                id: tutorId,
                fullName: tutorData.fullName || tutorData.displayName || 'Brak nazwiska',
                email: tutorData.email || '',
                avatarUrl: tutorData.avatarUrl || tutorData.photoURL || '',
                subject: tutorData.subject || 'Ogólne',
                description: tutorData.description || 'Doświadczony instruktor z pasją do nauczania.',
                experience: tutorData.experience || '5+ lat',
                specialization: tutorData.specialization || ['Edukacja domowa', 'Indywidualne podejście'],
                instructorType: instructorType,
                contactInfo: {
                  phone: tutorData.phone || '',
                  availability: tutorData.availability || 'Pon-Pt 8:00-16:00'
                }
              });
            }
          } catch (err) {
            console.error(`Błąd podczas pobierania instruktora ${tutorId}:`, err);
          }
        }

        // Sortuj - główny instruktor pierwszy
        const sortedTutors = tutorsData.sort((a, b) => {
          if (a.id === primaryTutorId) return -1;
          if (b.id === primaryTutorId) return 1;
          return 0;
        });

        setTutors(sortedTutors);
        setLoading(false);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Nie udało się pobrać informacji o nauczycielach.');
        }
        setLoading(false);
      }
    };

    fetchTutors();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#4067EC] mx-auto mb-4"></div>
              <p className="text-[#4067EC] font-semibold text-lg">Ładowanie instruktorów...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg p-8 border border-white/20 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Błąd</h2>
            <p className="text-gray-600">{error}</p>
            <Link 
              href="/homelogin"
              className="inline-flex items-center mt-4 px-6 py-3 bg-gradient-to-r from-[#4067EC] to-[#5577FF] text-white font-semibold rounded-xl hover:from-[#3155d4] hover:to-[#4067EC] transition-all duration-200 hover:shadow-lg"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Powrót do panelu
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (tutors.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg p-8 border border-white/20 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Brak przypisanych instruktorów</h2>
            <p className="text-gray-600 mb-4">Nie masz jeszcze przypisanych instruktorów. Skontaktuj się z administratorem platformy.</p>
            <Link 
              href="/homelogin"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#4067EC] to-[#5577FF] text-white font-semibold rounded-xl hover:from-[#3155d4] hover:to-[#4067EC] transition-all duration-200 hover:shadow-lg"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Powrót do panelu
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6 w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <Link 
                href="/homelogin"
                className="p-3 bg-white/90 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 hover:bg-white hover:shadow-xl transition-all duration-200"
              >
                <svg className="w-6 h-6 text-[#4067EC]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Moi Instruktorzy</h1>
                <p className="text-gray-600">Zespół instruktorów wspierających Twoją edukację domową</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Instructors Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {tutors.map((tutor, index) => {
            const isPrimary = index === 0;
            const colors = [
              'from-[#4067EC] to-[#5577FF]',
              'from-emerald-500 to-emerald-600',
              'from-orange-500 to-orange-600',
              'from-purple-500 to-purple-600',
              'from-pink-500 to-pink-600',
              'from-teal-500 to-teal-600'
            ];
            const colorClass = colors[index % colors.length];
            
            return (
              <div 
                key={tutor.id} 
                onClick={() => router.push(`/homelogin/student/teacher/${tutor.id}`)}
                className={`bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 group cursor-pointer ${
                  isPrimary ? 'ring-2 ring-[#4067EC] ring-opacity-50' : ''
                }`}
              >
                {/* Header */}
                <div className={`p-6 ${isPrimary ? 'bg-gradient-to-r from-[#4067EC] to-[#5577FF] text-white rounded-t-2xl' : 'bg-gradient-to-r from-gray-50 to-gray-100'}`}>
                  <div className="flex items-center gap-4">
                    {tutor.avatarUrl ? (
                      <Image 
                        src={tutor.avatarUrl} 
                        alt={tutor.fullName} 
                        width={64} 
                        height={64} 
                        className="rounded-full object-cover border-2 border-white/20 shadow-lg" 
                      />
                    ) : (
                      <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${colorClass} flex items-center justify-center text-2xl font-bold text-white shadow-lg`}>
                        {tutor.fullName[0]}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold">{tutor.fullName}</h3>
                        {isPrimary && (
                          <span className="px-2 py-1 bg-white/20 rounded-full text-xs font-medium">
                            Główny
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {tutor.instructorType && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            tutor.instructorType === 'tutor' ? 'bg-white/20 text-white' :
                            tutor.instructorType === 'wychowawca' ? 'bg-white/20 text-white' :
                            tutor.instructorType === 'nauczyciel_wspomagajacy' ? 'bg-white/20 text-white' :
                            'bg-white/20 text-white'
                          }`}>
                            {tutor.instructorType === 'tutor' ? 'Tutor' :
                             tutor.instructorType === 'wychowawca' ? 'Wychowawca' :
                             tutor.instructorType === 'nauczyciel_wspomagajacy' ? 'Nauczyciel wspomagający' :
                             tutor.instructorType === 'teacher' ? 'Nauczyciel' : tutor.instructorType}
                          </span>
                        )}
                        <p className="text-sm opacity-90">{tutor.subject}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  {/* Description */}
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-800 mb-2">O instruktorze</h4>
                    <p className="text-gray-600 text-sm leading-relaxed">{tutor.description}</p>
                  </div>

                  {/* Experience & Specialization */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Doświadczenie</h5>
                      <p className="text-sm font-medium text-gray-800">{tutor.experience}</p>
                    </div>
                    <div>
                      <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Dostępność</h5>
                      <p className="text-sm font-medium text-gray-800">{tutor.contactInfo?.availability}</p>
                    </div>
                  </div>

                  {/* Specializations */}
                  {tutor.specialization && tutor.specialization.length > 0 && (
                    <div className="mb-6">
                      <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Specjalizacje</h5>
                      <div className="flex flex-wrap gap-2">
                        {tutor.specialization.map((spec, idx) => (
                          <span 
                            key={idx}
                            className="px-3 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200"
                          >
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contact Info */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="text-gray-700">{tutor.email}</span>
                    </div>
                    {tutor.contactInfo?.phone && (
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                        <span className="text-gray-700">{tutor.contactInfo.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button className="flex-1 bg-gradient-to-r from-[#4067EC] to-[#5577FF] text-white px-4 py-3 rounded-xl font-semibold hover:from-[#3155d4] hover:to-[#4067EC] transition-all duration-200 hover:shadow-lg group-hover:scale-105">
                      <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Wiadomość
                    </button>
                    <button className="px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all duration-200 hover:shadow-md">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Additional Info */}
        <div className="mt-8 bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg p-6 border border-white/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-3 rounded-xl text-white shadow-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800">Współpraca z instruktorami</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h4 className="font-semibold text-gray-800 mb-2">Komunikacja</h4>
              <p className="text-sm text-gray-600">Używaj czatu do komunikacji z instruktorami</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="font-semibold text-gray-800 mb-2">Wsparcie</h4>
              <p className="text-sm text-gray-600">Instruktorzy są dostępni w godzinach pracy</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h4 className="font-semibold text-gray-800 mb-2">Materiały</h4>
              <p className="text-sm text-gray-600">Dostęp do materiałów edukacyjnych</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorViewPage; 
