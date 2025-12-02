'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, MessageCircle, Phone, Mail, Clock, Star, User, AlertCircle, Award, Calendar } from 'lucide-react';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import { useAuth } from '../../../../context/AuthContext';

interface Achievement {
  id: string;
  title: string;
  description: string;
  date: string;
  icon: string;
}

interface Tutor {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  subject?: string;
  description?: string;
  experience?: string;
  specialization?: string[];
  contactInfo?: {
    phone?: string;
    availability?: string;
  };
  isPrimary?: boolean;
  activeCourses?: number;
  totalStudents?: number;
  averageRating?: number;
  achievements?: Achievement[];
}

function StudentTutorsPageContent() {
  const { user } = useAuth();
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    const fetchTutors = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Pobieranie tutorów dla ucznia:', user.uid);
        
        // Pobierz dokument studenta
        const studentDocRef = doc(db, 'users', user.uid);
        const studentSnap = await getDoc(studentDocRef);
        
        if (!studentSnap.exists()) {
          setError('Nie znaleziono dokumentu studenta.');
          return;
        }

        const studentData = studentSnap.data();
        const primaryTutorId = studentData.primaryTutorId;
        const assignedTutors = studentData.assignedTutors || [];

        if (!primaryTutorId && assignedTutors.length === 0) {
          setError('Nie przypisano żadnych tutorów. Skontaktuj się z administratorem.');
          return;
        }

        // Pobierz wszystkich przypisanych tutorów
        const allTutorIds = [...new Set([primaryTutorId, ...assignedTutors])].filter(Boolean);
        const tutorsData: Tutor[] = [];

        for (const tutorId of allTutorIds) {
          try {
            const tutorDocRef = doc(db, 'users', tutorId);
            const tutorSnap = await getDoc(tutorDocRef);
            
            if (tutorSnap.exists()) {
              const tutorData = tutorSnap.data();
              
              // Oblicz statystyki z Firebase jeśli nie są w dokumencie
              let activeCourses = tutorData.activeCourses || 0;
              let totalStudents = tutorData.totalStudents || 0;
              let averageRating = tutorData.averageRating || 0;
              
              // Jeśli statystyki nie są zaktualizowane (starsze niż 1 godzina) lub nie istnieją, oblicz je
              const statsUpdatedAt = tutorData.statsUpdatedAt;
              const shouldRecalculate = !statsUpdatedAt || 
                (new Date().getTime() - new Date(statsUpdatedAt).getTime()) > 3600000; // 1 godzina
              
              if (shouldRecalculate && tutorData.email) {
                try {
                  // Pobierz kursy nauczyciela
                  const coursesCollection = collection(db, 'courses');
                  const [coursesByEmail, coursesByUid, coursesByTeacherEmail] = await Promise.all([
                    getDocs(query(coursesCollection, where('created_by', '==', tutorData.email))),
                    getDocs(query(coursesCollection, where('created_by', '==', tutorId))),
                    getDocs(query(coursesCollection, where('teacherEmail', '==', tutorData.email)))
                  ]);
                  
                  const coursesMap = new Map();
                  [coursesByEmail, coursesByUid, coursesByTeacherEmail].forEach(snapshot => {
                    snapshot.docs.forEach(doc => {
                      coursesMap.set(doc.id, { id: doc.id, ...doc.data() });
                    });
                  });
                  activeCourses = coursesMap.size;
                  
                  // Pobierz uczniów
                  const allAssignedUsers = new Set<string>();
                  coursesMap.forEach((course: any) => {
                    if (course.assignedUsers && Array.isArray(course.assignedUsers)) {
                      course.assignedUsers.forEach((userId: string) => allAssignedUsers.add(userId));
                    }
                  });
                  
                  const studentsCollection = collection(db, 'users');
                  const uniqueStudents = new Set<string>();
                  
                  // Dla każdego przypisanego użytkownika sprawdź czy istnieje jako student
                  for (const userId of allAssignedUsers) {
                    try {
                      let studentDoc;
                      if (userId.includes('@')) {
                        // Jeśli to email, szukaj po email
                        const emailQuery = query(studentsCollection, where("email", "==", userId), where("role", "==", "student"));
                        const emailSnapshot = await getDocs(emailQuery);
                        if (!emailSnapshot.empty) {
                          studentDoc = emailSnapshot.docs[0];
                        }
                      } else {
                        // Jeśli to ID, sprawdź bezpośrednio
                        const userDocRef = doc(db, 'users', userId);
                        const userDocSnap = await getDoc(userDocRef);
                        if (userDocSnap.exists() && userDocSnap.data().role === 'student') {
                          studentDoc = userDocSnap;
                        }
                      }
                      
                      if (studentDoc) {
                        uniqueStudents.add(studentDoc.id);
                      }
                    } catch (error) {
                      console.error(`Błąd podczas pobierania ucznia ${userId}:`, error);
                    }
                  }
                  
                  totalStudents = uniqueStudents.size;
                  
                  // Pobierz średnią ocenę z ankiet
                  const surveysCollection = collection(db, 'teacherSurveys');
                  const surveysQuery = query(surveysCollection, where('teacherId', '==', tutorId));
                  const surveysSnapshot = await getDocs(surveysQuery);
                  
                  if (!surveysSnapshot.empty) {
                    let totalScore = 0;
                    let count = 0;
                    
                    surveysSnapshot.docs.forEach(doc => {
                      const data = doc.data();
                      if (data.averageScore && typeof data.averageScore === 'number') {
                        totalScore += data.averageScore;
                        count++;
                      } else if (data.responses) {
                        const scores = Object.values(data.responses).filter((score: any) => typeof score === 'number');
                        if (scores.length > 0) {
                          const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
                          totalScore += avg;
                          count++;
                        }
                      }
                    });
                    
                    if (count > 0) {
                      averageRating = totalScore / count;
                    }
                  }
                } catch (error) {
                  console.error(`Błąd podczas obliczania statystyk dla tutora ${tutorId}:`, error);
                }
              }
              
              // Mock achievements - można później pobrać z Firestore
              const mockAchievements: Achievement[] = [
                {
                  id: '1',
                  title: 'Mistrz Edukacji',
                  description: 'Za przeprowadzenie 100+ lekcji',
                  date: '10.01.2024',
                  icon: '🏆'
                },
                {
                  id: '2',
                  title: 'Mentor Roku',
                  description: 'Za wysokie oceny od uczniów',
                  date: '05.01.2024',
                  icon: '⭐'
                },
                {
                  id: '3',
                  title: 'Innowator',
                  description: 'Za wprowadzenie nowych metod nauczania',
                  date: '15.12.2023',
                  icon: '💡'
                }
              ];
              
              tutorsData.push({
                id: tutorId,
                fullName: tutorData.fullName || tutorData.displayName || 'Brak nazwiska',
                email: tutorData.email || '',
                avatarUrl: tutorData.avatarUrl || tutorData.photoURL || '',
                subject: tutorData.subject || 'Ogólne',
                description: tutorData.description || 'Doświadczony nauczyciel z pasją do nauczania.',
                experience: tutorData.experience || '5+ lat',
                specialization: tutorData.specialization || ['Edukacja domowa', 'Indywidualne podejście'],
                contactInfo: {
                  phone: tutorData.phone || '',
                  availability: tutorData.availability || 'Pon-Pt 8:00-16:00'
                },
                isPrimary: tutorId === primaryTutorId,
                activeCourses,
                totalStudents,
                averageRating,
                achievements: tutorData.achievements || mockAchievements
              });
            }
          } catch (err) {
            console.error(`Błąd podczas pobierania tutora ${tutorId}:`, err);
          }
        }

        // Sortuj - główny tutor pierwszy
        const sortedTutors = tutorsData.sort((a, b) => {
          if (a.isPrimary) return -1;
          if (b.isPrimary) return 1;
          return 0;
        });

        setTutors(sortedTutors);
        console.log(`Znaleziono ${sortedTutors.length} tutorów`);
        
      } catch (err) {
        console.error('Błąd podczas pobierania tutorów:', err);
        setError('Nie udało się pobrać informacji o tutorach.');
      } finally {
        setLoading(false);
      }
    };

    fetchTutors();
  }, [user]);

  const handleContactTutor = (tutor: Tutor) => {
    // TODO: Implementować system wiadomości
    console.log('Kontakt z tutorem:', tutor);
    alert(`Funkcja kontaktu z tutorem ${tutor.fullName} będzie wkrótce dostępna!`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6FB] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#4067EC] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Ładowanie tutorów...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F4F6FB] p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Błąd</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.href = '/homelogin'}
              className="px-6 py-3 bg-[#4067EC] text-white rounded-lg hover:bg-[#3050b3] transition"
            >
              Powrót do panelu
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (tutors.length === 0) {
    return (
      <div className="min-h-screen bg-[#F4F6FB] p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Brak przypisanych tutorów</h2>
            <p className="text-gray-600 mb-4">Nie masz jeszcze przypisanych tutorów. Skontaktuj się z administratorem platformy.</p>
            <button
              onClick={() => window.location.href = '/homelogin'}
              className="px-6 py-3 bg-[#4067EC] text-white rounded-lg hover:bg-[#3050b3] transition"
            >
              Powrót do panelu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6FB] w-full">
      {/* Header */}
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
            Moi Tutorzy
          </h1>
          
          <div className="w-20"></div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="max-w-7xl mx-auto">
          {/* Info Card */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Star className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Wsparcie edukacyjne</h2>
                <p className="text-gray-600">Twoi tutorzy są dostępni, aby pomóc Ci w nauce</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-blue-600" />
                <span className="text-gray-700">Komunikacja przez czat</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-green-600" />
                <span className="text-gray-700">Dostępność w godzinach pracy</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-purple-600" />
                <span className="text-gray-700">Indywidualne podejście</span>
              </div>
            </div>
          </div>

          {/* Tutors Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {tutors.map((tutor, index) => {
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
                  className={`bg-white rounded-xl shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 group ${
                    tutor.isPrimary ? 'ring-2 ring-[#4067EC] ring-opacity-50' : ''
                  }`}
                >
                  {/* Header */}
                  <div className={`p-6 ${tutor.isPrimary ? 'bg-gradient-to-r from-[#4067EC] to-[#5577FF] text-white rounded-t-xl' : 'bg-gradient-to-r from-gray-50 to-gray-100'}`}>
                    <div className="flex items-center gap-4">
                      {tutor.avatarUrl ? (
                        <img 
                          src={tutor.avatarUrl} 
                          alt={tutor.fullName} 
                          className="w-16 h-16 rounded-full object-cover border-2 border-white/20 shadow-lg"
                        />
                      ) : (
                        <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${colorClass} flex items-center justify-center text-2xl font-bold text-white shadow-lg`}>
                          {tutor.fullName[0]}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-xl font-bold">{tutor.fullName}</h3>
                          {tutor.isPrimary && (
                            <span className="px-2 py-1 bg-white/20 rounded-full text-xs font-medium">
                              Główny
                            </span>
                          )}
                        </div>
                        <p className="text-sm opacity-90">{tutor.subject}</p>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    {/* Description */}
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-800 mb-2">O tutorze</h4>
                      <p className="text-gray-600 text-sm leading-relaxed">{tutor.description}</p>
                    </div>

                    {/* Stats */}
                    {(tutor.activeCourses !== undefined || tutor.totalStudents !== undefined || tutor.averageRating !== undefined) && (
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">{tutor.activeCourses || 0}</div>
                          <div className="text-xs text-gray-600 mt-1">Kursy</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">{tutor.totalStudents || 0}</div>
                          <div className="text-xs text-gray-600 mt-1">Uczniów</div>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">{(tutor.averageRating || 0).toFixed(1)}</div>
                          <div className="text-xs text-gray-600 mt-1">Ocena</div>
                        </div>
                      </div>
                    )}

                    {/* Experience & Availability */}
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
                          <Mail className="w-4 h-4 text-gray-600" />
                        </div>
                        <span className="text-gray-700">{tutor.email}</span>
                      </div>
                      {tutor.contactInfo?.phone && (
                        <div className="flex items-center gap-3 text-sm">
                          <div className="w-8 h-8 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                            <Phone className="w-4 h-4 text-gray-600" />
                          </div>
                          <span className="text-gray-700">{tutor.contactInfo.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Achievements */}
                    {tutor.achievements && tutor.achievements.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                            <Award className="w-5 h-5 text-yellow-600" />
                            Osiągnięcia
                          </h4>
                          <span className="text-xs text-gray-500">{tutor.achievements.length} odznak</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {tutor.achievements.slice(0, 3).map((achievement) => (
                            <div 
                              key={achievement.id} 
                              className="flex items-start gap-3 p-4 bg-gradient-to-r from-gray-50 via-blue-50 to-purple-50 rounded-xl hover:from-blue-100 hover:via-purple-100 hover:to-pink-100 transition-all duration-300 border-2 border-gray-200 hover:border-blue-400"
                            >
                              <div className="text-3xl">{achievement.icon}</div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h5 className="font-bold text-sm text-gray-900">{achievement.title}</h5>
                                </div>
                                <p className="text-xs text-gray-600 mb-2">{achievement.description}</p>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3 w-3 text-gray-400" />
                                  <p className="text-xs font-medium text-gray-500">{achievement.date}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleContactTutor(tutor)}
                        className="flex-1 bg-gradient-to-r from-[#4067EC] to-[#5577FF] text-white px-4 py-3 rounded-xl font-semibold hover:from-[#3155d4] hover:to-[#4067EC] transition-all duration-200 hover:shadow-lg group-hover:scale-105 flex items-center justify-center gap-2"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Skontaktuj się
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Help Section */}
          <div className="mt-8 bg-white rounded-xl shadow-lg p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Potrzebujesz pomocy?</h3>
                <p className="text-gray-600">Jeśli masz problemy z dostępem do tutorów, skontaktuj się z administratorem</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <MessageCircle className="w-6 h-6 text-blue-600" />
                </div>
                <h4 className="font-semibold text-gray-800 mb-2">Komunikacja</h4>
                <p className="text-gray-600">Używaj czatu do komunikacji z tutorami</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-6 h-6 text-emerald-600" />
                </div>
                <h4 className="font-semibold text-gray-800 mb-2">Dostępność</h4>
                <p className="text-gray-600">Tutorzy są dostępni w godzinach pracy</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <User className="w-6 h-6 text-purple-600" />
                </div>
                <h4 className="font-semibold text-gray-800 mb-2">Wsparcie</h4>
                <p className="text-gray-600">Indywidualne podejście do każdego ucznia</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudentTutorsPage() {
  return <StudentTutorsPageContent />;
}






