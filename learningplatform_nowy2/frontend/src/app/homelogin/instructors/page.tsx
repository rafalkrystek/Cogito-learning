"use client";
import { useState, useEffect } from 'react';
import Image from "next/image";
import Link from "next/link";
import { db } from '@/config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

interface Instructor {
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
  instructorType?: string;
  specialization?: string[];
  availability?: string;
  phone?: string;
}

export default function InstructorsPage() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadInstructors();
  }, []);

  const loadInstructors = async () => {
    try {
      console.log('Loading instructors from Firestore...');
      const usersCollection = collection(db, 'users');
      
      // Query for only new instructor roles (exclude regular teachers)
      const instructorRoles = ['tutor', 'wychowawca', 'nauczyciel_wspomagajacy'];
      const allInstructors: Instructor[] = [];
      
      for (const role of instructorRoles) {
        const q = query(usersCollection, where('role', '==', role));
        const querySnapshot = await getDocs(q);
        
        console.log(`Found ${querySnapshot.size} ${role} instructors`);
        
        const roleInstructors = querySnapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Instructor data:', { id: doc.id, ...data });
          return {
            id: doc.id,
            ...data,
            instructorType: role // Add instructor type
          } as Instructor;
        });
        
        allInstructors.push(...roleInstructors);
      }
      
      console.log('Processed all instructors:', allInstructors);
      setInstructors(allInstructors);
    } catch (err) {
      console.error('Error loading instructors:', err);
      setError('Błąd ładowania instruktorów');
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full">
        {/* Header z przyciskiem powrotu */}
        <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => window.location.href = '/homelogin'}
              className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              Powrót
            </button>
            
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Instruktorzy i Tutorzy
            </h1>
            
            <ThemeToggle />
            
            <div className="w-20"></div>
          </div>
        </div>
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="flex justify-center items-center h-64">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#4067EC] border-r-transparent"></div>
            <span className="ml-3 text-gray-600">Ładowanie instruktorów...</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full">
      {/* Header z przyciskiem powrotu */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => window.location.href = '/homelogin'}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Powrót
          </button>
          
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Instruktorzy Edukacji Domowej
          </h1>
          
          <ThemeToggle />
          
          <Link
            href="/homelogin/instructors/tutors"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 ease-in-out border border-blue-600 shadow-lg hover:shadow-xl"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Moi Instruktorzy
          </Link>
        </div>
      </div>
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative">
            {error}
          </div>
        )}
        
        {instructors.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Brak dostępnych instruktorów edukacji domowej</p>
            <p className="text-gray-400 text-sm mt-2">Brak dostępnych instruktorów w systemie</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {instructors.map((instructor) => (
              <div key={instructor.id} className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 border border-white/20">
                {/* Profile Image */}
                <div className="flex flex-col items-center mb-4">
                  <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-[#4067EC] mb-4">
                    {(instructor.profileImageUrl || instructor.photoURL) ? (
                      <Image 
                        src={instructor.profileImageUrl || instructor.photoURL || ''} 
                        alt={instructor.displayName || `${instructor.firstName} ${instructor.lastName}` || 'Instruktor'} 
                        width={96} 
                        height={96} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  <h3 className="font-semibold text-xl text-gray-800 text-center">
                    {instructor.displayName || `${instructor.firstName || ''} ${instructor.lastName || ''}`.trim() || 'Brak nazwiska'}
                  </h3>
                  
                  <div className="text-center mt-1">
                    {instructor.instructorType && (
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-1 ${
                        instructor.instructorType === 'tutor' ? 'bg-blue-100 text-blue-800' :
                        instructor.instructorType === 'wychowawca' ? 'bg-green-100 text-green-800' :
                        instructor.instructorType === 'nauczyciel_wspomagajacy' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {instructor.instructorType === 'tutor' ? 'Tutor' :
                         instructor.instructorType === 'wychowawca' ? 'Wychowawca' :
                         instructor.instructorType === 'nauczyciel_wspomagajacy' ? 'Nauczyciel wspomagający' :
                         instructor.instructorType === 'teacher' ? 'Nauczyciel' : instructor.instructorType}
                      </span>
                    )}
                    {instructor.subjects && (
                      <p className="text-sm text-[#4067EC] font-medium">
                        {instructor.subjects}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Description */}
                {instructor.description && (
                  <div className="mb-4">
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {instructor.description.length > 150 
                        ? `${instructor.description.substring(0, 150)}...` 
                        : instructor.description
                      }
                    </p>
                  </div>
                )}
                
                {/* Experience & Education */}
                <div className="space-y-3 mb-6">
                  {instructor.experience && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800 mb-1">Doświadczenie:</h4>
                      <p className="text-xs text-gray-600">
                        {instructor.experience.length > 100 
                          ? `${instructor.experience.substring(0, 100)}...` 
                          : instructor.experience
                        }
                      </p>
                    </div>
                  )}
                  
                  {instructor.education && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800 mb-1">Wykształcenie:</h4>
                      <p className="text-xs text-gray-600">
                        {instructor.education.length > 100 
                          ? `${instructor.education.substring(0, 100)}...` 
                          : instructor.education
                        }
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Contact Button */}
                <div className="flex justify-center">
                  <Link 
                    href={`/homelogin/instructors/profile/${instructor.id}`}
                    className="bg-[#4067EC] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[#3155d4] transition-colors duration-200"
                    onClick={() => console.log('Clicking on instructor profile:', instructor.id, 'URL:', `/homelogin/instructors/profile/${instructor.id}`)}
                  >
                    Zobacz pełny profil
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
} 