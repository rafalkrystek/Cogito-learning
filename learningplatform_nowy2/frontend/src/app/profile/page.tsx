"use client";
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db, storage } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Providers from '@/components/Providers';
import ThemeToggle from '@/components/ThemeToggle';
import Link from 'next/link';
import { ArrowLeft, BarChart3, LogOut, Camera, User, Mail, GraduationCap, Shield, BookOpen, Award, Trophy } from 'lucide-react';

function ProfilePageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [userClass, setUserClass] = useState('');
  const [, setUserClasses] = useState<string[]>([]);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [photoURL, setPhotoURL] = useState('');
  const [, setLoading] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef(null);
  const [learningData, setLearningData] = useState<any>(null);
  const [grades, setGrades] = useState<any[]>([]);
  const [topBadges, setTopBadges] = useState<any[]>([]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      setLoading(true);
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        
        setDisplayName(data.displayName || '');
        setEmail(data.email || '');
        setUserClass(data.class || '');
        setUserClasses(data.classes || []);
        setPhotoURL(data.photoURL || '');
        
        // Pobierz nazwy klas
        if (data.classes && data.classes.length > 0) {
          const classesRef = collection(db, 'classes');
          const classDocs = await getDocs(classesRef);
          const names: string[] = [];
          
          classDocs.forEach(doc => {
            const classData = doc.data();
            if (data.classes.includes(doc.id)) {
              const className = classData.name || classData.title || `Klasa ${doc.id}`;
              names.push(className);
            }
          });
          
          setClassNames(names);
        } else {
          setClassNames([]);
        }
      }
      setLoading(false);
    };
    fetchUserData();
  }, [user]);

  // Pobierz dane do obliczenia odznak
  useEffect(() => {
    const fetchBadgeData = async () => {
      if (!user?.uid) return;

      try {
        // Pobierz dane nauki
        const userTimeDoc = await getDoc(doc(db, 'userLearningTime', user.uid));
        if (userTimeDoc.exists()) {
          setLearningData(userTimeDoc.data());
        }

        // Pobierz oceny
        const [gradesByUid, gradesByEmail, gradesByStudentId] = await Promise.all([
          getDocs(query(collection(db, 'grades'), where('user_id', '==', user.uid), limit(100))),
          user.email ? getDocs(query(collection(db, 'grades'), where('studentEmail', '==', user.email), limit(100))) : Promise.resolve({ docs: [] } as any),
          getDocs(query(collection(db, 'grades'), where('studentId', '==', user.uid), limit(100)))
        ]);

        const allGrades = [
          ...gradesByUid.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })),
          ...gradesByEmail.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })),
          ...gradesByStudentId.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))
        ];
        const uniqueGrades = allGrades.filter((grade, index, self) =>
          index === self.findIndex(g => g.id === grade.id)
        );
        setGrades(uniqueGrades);
      } catch (error) {
        console.error('Error fetching badge data:', error);
      }
    };

    fetchBadgeData();
  }, [user]);

  // Oblicz odznaki
  useEffect(() => {
    if (!learningData && grades.length === 0) return;

    const calculateBadges = () => {
      const totalMinutes = learningData?.totalMinutes || 0;
      const totalHours = totalMinutes / 60;
      const daysActive = learningData ? Object.keys(learningData.dailyStats || {}).length : 0;
      
      // Oblicz średnią ocen
      const normalizedGrades = grades.map(grade => {
        let value = 0;
        if (typeof grade.value === 'number') {
          value = grade.value;
        } else if (typeof grade.value_grade === 'number') {
          value = grade.value_grade;
        } else if (typeof grade.grade === 'number') {
          value = grade.grade;
        } else if (typeof grade.grade === 'string') {
          value = parseFloat(grade.grade);
        }
        
        // Jeśli mamy procent, skonwertuj na ocenę (1-5)
        if (value === 0 && grade.percentage) {
          const percentage = typeof grade.percentage === 'number' ? grade.percentage : parseFloat(String(grade.percentage));
          if (percentage >= 90) value = 5;
          else if (percentage >= 75) value = 4;
          else if (percentage >= 60) value = 3;
          else if (percentage >= 45) value = 2;
          else value = 1;
        }
        
        value = Math.max(1, Math.min(5, Math.round(value)));
        return { ...grade, normalizedValue: value };
      });
      const averageGrade = normalizedGrades.length > 0 
        ? normalizedGrades.reduce((acc, g) => acc + g.normalizedValue, 0) / normalizedGrades.length 
        : 0;
      const totalGrades = normalizedGrades.length;

      // Oblicz streak
      const calculateStreak = () => {
        if (!learningData?.dailyStats) return 0;
        const sortedDates = Object.keys(learningData.dailyStats)
          .map(date => new Date(date))
          .sort((a, b) => b.getTime() - a.getTime());
        if (sortedDates.length === 0) return 0;
        let streak = 1;
        for (let i = 0; i < sortedDates.length - 1; i++) {
          const current = new Date(sortedDates[i]);
          current.setHours(0, 0, 0, 0);
          const next = new Date(sortedDates[i + 1]);
          next.setHours(0, 0, 0, 0);
          const diffDays = Math.floor((current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) streak++;
          else break;
        }
        return streak;
      };

      const streak = calculateStreak();
      const calculateLevel = (value: number, thresholds: number[]): number => {
        for (let i = thresholds.length - 1; i >= 0; i--) {
          if (value >= thresholds[i]) return i;
        }
        return 0;
      };

      const badges = [
        {
          id: 'time-master',
          name: 'Mistrz Czasu',
          icon: '⏰',
          currentLevel: calculateLevel(totalHours, [0, 10, 50, 100, 200]),
          currentProgress: Math.round(totalHours),
          levels: [
            { name: 'Brąz', threshold: 0, gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 10, gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 50, gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 100, gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 200, gradient: 'from-blue-500 to-blue-600' }
          ]
        },
        {
          id: 'discipline',
          name: 'Dyscyplina',
          icon: '🔥',
          currentLevel: calculateLevel(streak, [0, 3, 7, 14, 30]),
          currentProgress: streak,
          levels: [
            { name: 'Brąz', threshold: 0, gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 3, gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 7, gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 14, gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 30, gradient: 'from-blue-500 to-blue-600' }
          ]
        },
        {
          id: 'perfectionist',
          name: 'Perfekcjonista',
          icon: '⭐',
          currentLevel: calculateLevel(averageGrade, [0, 3, 3.5, 4, 4.5]),
          currentProgress: Math.round(averageGrade * 10) / 10,
          levels: [
            { name: 'Brąz', threshold: 0, gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 3, gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 3.5, gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 4, gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 4.5, gradient: 'from-blue-500 to-blue-600' }
          ]
        },
        {
          id: 'explorer',
          name: 'Eksplorator',
          icon: '🗺️',
          currentLevel: calculateLevel(daysActive, [0, 5, 15, 30, 60]),
          currentProgress: daysActive,
          levels: [
            { name: 'Brąz', threshold: 0, gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 5, gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 15, gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 30, gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 60, gradient: 'from-blue-500 to-blue-600' }
          ]
        },
        {
          id: 'scholar',
          name: 'Uczony',
          icon: '📚',
          currentLevel: calculateLevel(totalGrades, [0, 5, 15, 30, 50]),
          currentProgress: totalGrades,
          levels: [
            { name: 'Brąz', threshold: 0, gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 5, gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 15, gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 30, gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 50, gradient: 'from-blue-500 to-blue-600' }
          ]
        },
        {
          id: 'daily-learner',
          name: 'Dzień po Dniu',
          icon: '📅',
          currentLevel: calculateLevel(
            daysActive > 0 ? Math.round(totalMinutes / daysActive) : 0,
            [0, 30, 60, 120, 180]
          ),
          currentProgress: daysActive > 0 ? Math.round(totalMinutes / daysActive) : 0,
          levels: [
            { name: 'Brąz', threshold: 0, gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 30, gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 60, gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 120, gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 180, gradient: 'from-blue-500 to-blue-600' }
          ]
        }
      ];

      // Posortuj według poziomu (najwyższe pierwsze) i weź 3 najlepsze
      const sorted = badges
        .sort((a, b) => b.currentLevel - a.currentLevel || b.currentProgress - a.currentProgress)
        .slice(0, 3);
      
      setTopBadges(sorted);
    };

    calculateBadges();
  }, [learningData, grades]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      setUploadError('Proszę wybrać plik obrazu (JPG, PNG)');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Plik jest za duży. Maksymalny rozmiar to 5MB.');
      return;
    }
    
    try {
      setUploading(true);
      setUploadError(null);
      setUploadSuccess(false);
      
          const storageRef = ref(storage, `profile_photos/${user.uid}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
      
      setPhotoURL(url);
      setUploadSuccess(true);
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: unknown) {
      console.error('Error uploading photo:', error);
        setUploadError('Błąd podczas przesyłania zdjęcia. Spróbuj ponownie.');
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoClick = () => {
    if (fileInputRef.current) {
      (fileInputRef.current as HTMLInputElement).click();
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('firebaseToken');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('lastActivity');
    // Kompatybilność wsteczna
    localStorage.removeItem('firebaseToken');
    localStorage.removeItem('token');
    router.push('/login');
  };

  const handleChangePassword = () => {
    router.push('/forgot-password');
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full">
      {/* Header z przyciskiem powrotu */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/homelogin')}
            className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm text-gray-700 rounded-lg hover:bg-white hover:shadow-lg transition-all duration-200 ease-in-out border border-white/20"
          >
            <ArrowLeft className="w-4 h-4" />
            Powrót do strony głównej
          </button>
          
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Mój profil
          </h1>
          
          {/* Theme Toggle - po prawej stronie */}
          <ThemeToggle />
        </div>
        </div>

      {/* Główna zawartość */}
      <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 h-full">
          
          {/* Lewa kolumna - Profil */}
          <div className="lg:col-span-1">
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 lg:p-8 h-fit">
              {/* Zdjęcie profilowe */}
              <div className="flex flex-col items-center mb-6 lg:mb-8">
                <div className="relative group mb-4" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
                  <div className="w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 rounded-full overflow-hidden border-4 border-white shadow-xl">
              <Image
                src={photoURL || "/puzzleicon.png"}
                alt="Profile picture"
                      width={160}
                      height={160}
                      className="w-full h-full object-cover"
                    />
                  </div>
              <input
                type="file"
                accept="image/jpeg,image/png"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handlePhotoChange}
              />
              {hovered && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full cursor-pointer transition-all duration-200" onClick={handlePhotoClick}>
                      <Camera className="w-6 h-6 text-white" />
                </div>
              )}
            </div>
                
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 text-center mb-2">
                  {displayName || 'Brak imienia i nazwiska'}
                </h2>
                <p className="text-gray-600 text-center text-sm sm:text-base mb-2">
                  {email || 'Brak adresu email'}
                </p>
                
                {/* Wyświetl klasy */}
                {classNames.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1 mb-4">
                    {classNames.map((className, index) => (
                      <span key={index} className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                        {className}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Status uploadu */}
            {uploading && (
                  <div className="mt-4 text-blue-600 font-semibold text-sm sm:text-base animate-pulse">
                    Przesyłanie zdjęcia...
                  </div>
            )}
            {uploadSuccess && (
                  <div className="mt-4 text-green-600 font-semibold text-sm sm:text-base">
                    Zdjęcie zostało zaktualizowane!
                  </div>
            )}
            {uploadError && (
                  <div className="mt-4 text-red-600 font-semibold text-sm sm:text-base">
                    {uploadError}
                  </div>
                )}

                
              </div>

              {/* Szybkie akcje */}
              <div className="space-y-3">
                <Link 
                  href="/profile/statistics" 
                  className="flex items-center gap-3 w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 ease-in-out shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                >
                  <BarChart3 className="w-5 h-5 text-white" />
                  <span className="font-semibold text-white">Statystyki nauki</span>
                </Link>
                
                <Link 
                  href={user?.role === 'student' ? '/homelogin/my-courses' : 
                        user?.role === 'teacher' ? '/homelogin/teacher/courses' : 
                        user?.role === 'parent' ? '/homelogin/parent/courses' : 
                        '/homelogin/my-courses'} 
                  className="flex items-center gap-3 w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 ease-in-out shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                >
                  <BookOpen className="w-5 h-5 text-white" />
                  <span className="font-semibold text-white">Moje kursy</span>
                </Link>
                
                <Link 
                  href="/homelogin/grades" 
                  className="flex items-center gap-3 w-full px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all duration-200 ease-in-out shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Award className="w-5 h-5 text-white" />
                  <span className="font-semibold text-white">Dziennik ocen</span>
                </Link>
                
                <button 
                  onClick={handleChangePassword}
                  className="flex items-center gap-3 w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-200 ease-in-out shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Shield className="w-5 h-5" />
                  <span className="font-semibold">Zmień hasło</span>
                </button>
                
                
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all duration-200 ease-in-out shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-semibold">Wyloguj się</span>
                </button>
              </div>
            </div>
          </div>

          {/* Prawa kolumna - Informacje */}
          <div className="lg:col-span-2">
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 lg:p-8 h-fit">
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-6 lg:mb-8">
                Informacje osobiste
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                {/* Karta - Imię i nazwisko */}
                <div className="bg-white/90 backdrop-blur-xl rounded-xl p-4 lg:p-6 border border-gray-200 hover:shadow-lg transition-all duration-200 ease-in-out hover:scale-[1.02]">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm sm:text-base lg:text-lg">Imię i nazwisko</h4>
                  </div>
                                     <p className="text-gray-700 text-sm sm:text-base lg:text-lg font-medium">
                     {displayName || 'Brak imienia i nazwiska'}
                   </p>
                </div>

                {/* Karta - Email */}
                <div className="bg-white/90 backdrop-blur-xl rounded-xl p-4 lg:p-6 border border-gray-200 hover:shadow-lg transition-all duration-200 ease-in-out hover:scale-[1.02]">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                      <Mail className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm sm:text-base lg:text-lg">Email</h4>
                  </div>
                  <p className="text-gray-700 text-sm sm:text-base lg:text-lg font-medium">
                    {email || 'Brak adresu email'}
                  </p>
                </div>

                {/* Karta - Klasa/Grupa */}
                <div className="bg-white/90 backdrop-blur-xl rounded-xl p-4 lg:p-6 border border-gray-200 hover:shadow-lg transition-all duration-200 ease-in-out hover:scale-[1.02]">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm sm:text-base lg:text-lg">Klasa/Grupa</h4>
                  </div>
                  <div className="text-gray-700 text-sm sm:text-base lg:text-lg font-medium">
                    {classNames.length > 0 ? (
                      <div className="space-y-1">
                        {classNames.map((className, index) => (
                          <div key={index} className="bg-purple-100 text-purple-800 px-2 py-1 rounded-md text-xs font-medium">
                            {className}
                          </div>
                        ))}
                      </div>
                    ) : userClass ? (
                      <span>{userClass}</span>
                    ) : (
                      <span className="text-gray-400">Brak przypisanych klas</span>
                    )}
                  </div>
                </div>


                {/* Karta - Status konta */}
                <div className="bg-white/90 backdrop-blur-xl rounded-xl p-4 lg:p-6 border border-gray-200 hover:shadow-lg transition-all duration-200 ease-in-out hover:scale-[1.02]">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm sm:text-base lg:text-lg">Status konta</h4>
                  </div>
                  <p className="text-gray-700 text-sm sm:text-base lg:text-lg font-medium">
                    Aktywne
                  </p>
                </div>
              </div>

              {/* Sekcja z 3 najwyższymi odznakami */}
              {topBadges.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                    <Trophy className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-yellow-500" />
                    Moje najwyższe odznaki
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
                    {topBadges.map((badge) => {
                      const currentLevelData = badge.levels[badge.currentLevel];
                      return (
                        <div
                          key={badge.id}
                          className={`relative bg-gradient-to-br ${currentLevelData.gradient} rounded-xl p-4 lg:p-6 border-2 border-white/30 hover:border-white/50 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl`}
                        >
                          {/* Poziom odznaki */}
                          <div className="absolute top-2 right-2">
                            <div className="px-2 py-1 rounded-full text-xs font-bold text-white bg-white/20 backdrop-blur-sm">
                              {currentLevelData.name}
                            </div>
                          </div>

                          {/* Ikona */}
                          <div className="flex justify-center mb-3">
                            <div className="text-4xl lg:text-5xl">
                              {badge.icon}
                            </div>
                          </div>

                          {/* Nazwa */}
                          <h4 className="text-base lg:text-lg font-bold text-white mb-1 text-center">
                            {badge.name}
                          </h4>

                          {/* Poziom */}
                          <p className="text-xs lg:text-sm text-white/90 text-center">
                            Poziom {badge.currentLevel + 1} / {badge.levels.length}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Link do pełnych statystyk */}
                  <div className="mt-6 text-center">
                    <Link
                      href="/profile/statistics"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <Trophy className="w-4 h-4" />
                      <span className="font-semibold">Zobacz wszystkie odznaki</span>
                    </Link>
                  </div>
                </div>
              )}
              
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Providers>
      <ProfilePageContent />
    </Providers>
  );
} 