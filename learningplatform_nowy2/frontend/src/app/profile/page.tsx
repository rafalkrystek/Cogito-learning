"use client";
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db, storage } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Providers from '@/components/Providers';
import ThemeToggle from '@/components/ThemeToggle';
import { ArrowLeft, BarChart3, LogOut, User, Mail, GraduationCap, Shield, BookOpen, Award, Trophy, Phone, Edit2, Save, X } from 'lucide-react';

// Import new components
import ProfileHeader from '@/components/Profile/ProfileHeader';
import StatCard from '@/components/Profile/StatCard';
import BadgeCard from '@/components/Profile/BadgeCard';
import InfoCard from '@/components/Profile/InfoCard';
import ActionButton from '@/components/Profile/ActionButton';
import Modal from '@/components/Profile/Modal';

function ProfilePageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [userClass, setUserClass] = useState('');
  const [phone, setPhone] = useState('');
  const [classNames, setClassNames] = useState<string[]>([]);
  const [photoURL, setPhotoURL] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // const fileInputRef = useRef<HTMLInputElement>(null); // Zakomentowane - nie używane
  const [learningData, setLearningData] = useState<any>(null);
  const [grades, setGrades] = useState<any[]>([]);
  const [topBadges, setTopBadges] = useState<any[]>([]);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<any>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [coursesCount, setCoursesCount] = useState(0);

  // Check if user can edit (only students can edit their own profile)
  const canEdit = user?.role === 'student';

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
        setPhone(data.phone || '');
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

  // Pobierz kursy przypisane do użytkownika
  useEffect(() => {
    const fetchCourses = async () => {
      if (!user) return;
      
      try {
        // Pobierz dane użytkownika, aby uzyskać klasy
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          setCoursesCount(0);
          return;
        }
        
        const userData = userDoc.data();
        const userClassesList = userData.classes || [];
        
        const coursesCollection = collection(db, 'courses');
        
        // Pobierz kursy przypisane bezpośrednio do użytkownika
        const [coursesByUid, coursesByEmail] = await Promise.all([
          getDocs(query(coursesCollection, where('assignedUsers', 'array-contains', user.uid))),
          user.email ? getDocs(query(coursesCollection, where('assignedUsers', 'array-contains', user.email))) : Promise.resolve({ docs: [] } as any)
        ]);
        
        // Połącz i deduplikuj kursy
        const coursesMap = new Map();
        [...coursesByUid.docs, ...coursesByEmail.docs].forEach(doc => {
          coursesMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
        
        // Sprawdź kursy przypisane do klas (jeśli użytkownik ma klasy)
        if (userClassesList && Array.isArray(userClassesList) && userClassesList.length > 0) {
          const classQueries = userClassesList.map((classId: string) =>
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
        
        setCoursesCount(coursesMap.size);
      } catch (error) {
        console.error('Error fetching courses:', error);
        setCoursesCount(0);
      }
    };
    
    fetchCourses();
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
          description: 'Czas spędzony na nauce',
          currentLevel: calculateLevel(totalHours, [0, 10, 50, 100, 200]),
          currentProgress: Math.round(totalHours),
          nextLevelThreshold: [10, 50, 100, 200, 200][calculateLevel(totalHours, [0, 10, 50, 100, 200])],
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
          description: 'Dni z rzędu z aktywnością',
          currentLevel: calculateLevel(streak, [0, 3, 7, 14, 30]),
          currentProgress: streak,
          nextLevelThreshold: [3, 7, 14, 30, 30][calculateLevel(streak, [0, 3, 7, 14, 30])],
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
          description: 'Średnia ocen',
          currentLevel: calculateLevel(averageGrade, [0, 3, 3.5, 4, 4.5]),
          currentProgress: Math.round(averageGrade * 10) / 10,
          nextLevelThreshold: [3, 3.5, 4, 4.5, 5][calculateLevel(averageGrade, [0, 3, 3.5, 4, 4.5])],
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
          description: 'Dni aktywności',
          currentLevel: calculateLevel(daysActive, [0, 5, 15, 30, 60]),
          currentProgress: daysActive,
          nextLevelThreshold: [5, 15, 30, 60, 60][calculateLevel(daysActive, [0, 5, 15, 30, 60])],
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
          description: 'Liczba otrzymanych ocen',
          currentLevel: calculateLevel(totalGrades, [0, 5, 15, 30, 50]),
          currentProgress: totalGrades,
          nextLevelThreshold: [5, 15, 30, 50, 50][calculateLevel(totalGrades, [0, 5, 15, 30, 50])],
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
          description: 'Średnia minut dziennie',
          currentLevel: calculateLevel(
            daysActive > 0 ? Math.round(totalMinutes / daysActive) : 0,
            [0, 30, 60, 120, 180]
          ),
          currentProgress: daysActive > 0 ? Math.round(totalMinutes / daysActive) : 0,
          nextLevelThreshold: [30, 60, 120, 180, 180][calculateLevel(
            daysActive > 0 ? Math.round(totalMinutes / daysActive) : 0,
            [0, 30, 60, 120, 180]
          )],
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

  const handleLogout = () => {
    sessionStorage.removeItem('firebaseToken');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('lastActivity');
    localStorage.removeItem('firebaseToken');
    localStorage.removeItem('token');
    router.push('/login');
  };

  const handleChangePassword = () => {
    router.push('/forgot-password');
  };

  const formatPhoneNumber = (value: string): string => {
    const cleaned = value.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) return cleaned;
    if (cleaned.startsWith('0')) return '+48' + cleaned.substring(1);
    if (cleaned.startsWith('48')) return '+' + cleaned;
    return '+48' + cleaned;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cleaned = value.replace(/[^\d+\s-]/g, '');
    setPhone(cleaned);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    let formattedPhone = phone.trim();
    if (formattedPhone) {
      formattedPhone = formatPhoneNumber(formattedPhone);
      const phoneRegex = /^\+48\d{9}$/;
      if (!phoneRegex.test(formattedPhone)) {
        setSaveMessage({ 
          type: 'error', 
          text: 'Nieprawidłowy format numeru telefonu. Użyj formatu: +48123456789 lub 123456789' 
        });
        setTimeout(() => setSaveMessage(null), 5000);
        return;
      }
    }
    
    try {
      setSaveMessage(null);
      const updateData: any = {
        displayName,
        class: userClass
      };
      
      if (formattedPhone) {
        updateData.phone = formattedPhone;
      } else {
        updateData.phone = '';
      }
      
      await updateDoc(doc(db, 'users', user.uid), updateData);
      setPhone(formattedPhone);
      setSaveMessage({ 
        type: 'success', 
        text: 'Profil został zaktualizowany pomyślnie!' 
      });
      setIsEditing(false);
      setTimeout(() => setSaveMessage(null), 5000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setSaveMessage({ 
        type: 'error', 
        text: 'Błąd podczas aktualizacji profilu: ' + (error instanceof Error ? error.message : 'Nieznany błąd')
      });
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  // Calculate statistics
  const totalHours = learningData ? Math.round(learningData.totalMinutes / 60) : 0;
  const daysActive = learningData ? Object.keys(learningData.dailyStats || {}).length : 0;
  
  // Oblicz średnią ocen - normalizuj wartości do skali 1-5
  const averageGrade = grades.length > 0 
    ? (() => {
        const normalizedGrades = grades.map(g => {
          let value = 0;
          // Sprawdź różne formaty wartości oceny
          if (typeof g.value === 'number') {
            value = g.value;
          } else if (typeof g.value_grade === 'number') {
            value = g.value_grade;
          } else if (typeof g.grade === 'number') {
            value = g.grade;
          } else if (typeof g.grade === 'string') {
            // Obsługa stringów jak "5+", "4-", "3", itp.
            const cleaned = g.grade.replace(/[+-]/g, '');
            value = parseFloat(cleaned) || 0;
            // Jeśli jest "+" dodaj 0.3, jeśli "-" odejmij 0.3
            if (g.grade.includes('+')) value += 0.3;
            if (g.grade.includes('-')) value -= 0.3;
          } else if (typeof g.value === 'string') {
            const cleaned = g.value.replace(/[+-]/g, '');
            value = parseFloat(cleaned) || 0;
            if (g.value.includes('+')) value += 0.3;
            if (g.value.includes('-')) value -= 0.3;
          }
          
          // Jeśli mamy procent, skonwertuj na ocenę (1-5)
          if (value === 0 && g.percentage) {
            const percentage = typeof g.percentage === 'number' ? g.percentage : parseFloat(String(g.percentage));
            if (percentage >= 90) value = 5;
            else if (percentage >= 75) value = 4;
            else if (percentage >= 60) value = 3;
            else if (percentage >= 45) value = 2;
            else value = 1;
          }
          
          // Ogranicz do zakresu 1-5
          value = Math.max(1, Math.min(5, value));
          return value;
        }).filter(v => v > 0); // Usuń nieprawidłowe wartości
        
        return normalizedGrades.length > 0
          ? normalizedGrades.reduce((acc, v) => acc + v, 0) / normalizedGrades.length
          : 0;
      })()
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-200 w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8 py-4 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/homelogin')}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Powrót</span>
          </button>
          
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Mój profil
          </h1>
          
          <ThemeToggle />
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 w-full">
        {/* Profile Header */}
        <div className="mb-8">
          <ProfileHeader
            photoURL={photoURL}
            displayName={displayName}
            email={email}
            classNames={classNames}
            onPhotoChange={handlePhotoChange}
            uploading={uploading}
            uploadSuccess={uploadSuccess}
            uploadError={uploadError}
            canEdit={canEdit}
          />
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
          <StatCard
            icon={BookOpen}
            label="Kursy"
            value={coursesCount}
            gradient="from-blue-500 to-blue-600"
            iconBg="bg-blue-500"
            onClick={() => setShowStatsModal(true)}
          />
          <StatCard
            icon={Award}
            label="Średnia"
            value={averageGrade > 0 ? averageGrade.toFixed(1) : '0.0'}
            gradient="from-green-500 to-green-600"
            iconBg="bg-green-500"
          />
          <StatCard
            icon={BarChart3}
            label="Godziny nauki"
            value={totalHours}
            sublabel="Łącznie"
            gradient="from-purple-500 to-purple-600"
            iconBg="bg-purple-500"
          />
          <StatCard
            icon={Trophy}
            label="Dni aktywności"
            value={daysActive}
            gradient="from-amber-500 to-amber-600"
            iconBg="bg-amber-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left Column - Quick Actions */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-gray-700 p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Szybkie akcje</h2>
              <div className="space-y-3">
                <ActionButton
                  icon={BarChart3}
                  label="Statystyki nauki"
                  href="/profile/statistics"
                  gradient="from-blue-500 to-purple-600"
                  hoverGradient="from-blue-600 to-purple-700"
                />
                <ActionButton
                  icon={BookOpen}
                  label="Moje kursy"
                  href={user?.role === 'student' ? '/homelogin/my-courses' : 
                        user?.role === 'teacher' ? '/homelogin/teacher/courses' : 
                        user?.role === 'parent' ? '/homelogin/parent/courses' : 
                        '/homelogin/my-courses'}
                  gradient="from-green-500 to-emerald-600"
                  hoverGradient="from-green-600 to-emerald-700"
                />
                <ActionButton
                  icon={Award}
                  label="Dziennik ocen"
                  href="/homelogin/grades"
                  gradient="from-amber-500 to-orange-600"
                  hoverGradient="from-amber-600 to-orange-700"
                />
                {canEdit && (
                  <>
                    <ActionButton
                      icon={Shield}
                      label="Zmień hasło"
                      onClick={handleChangePassword}
                      gradient="from-gray-500 to-gray-600"
                      hoverGradient="from-gray-600 to-gray-700"
                    />
                    <ActionButton
                      icon={LogOut}
                      label="Wyloguj się"
                      onClick={handleLogout}
                      gradient="from-red-500 to-red-600"
                      hoverGradient="from-red-600 to-red-700"
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Informacje osobiste</h2>
                {canEdit && (
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    {isEditing ? (
                      <>
                        <X className="w-4 h-4" />
                        Anuluj
                      </>
                    ) : (
                      <>
                        <Edit2 className="w-4 h-4" />
                        Edytuj
                      </>
                    )}
                  </button>
                )}
              </div>

              {!isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoCard
                    icon={User}
                    label="Imię i nazwisko"
                    value={displayName || 'Brak imienia i nazwiska'}
                    iconBg="bg-blue-500"
                    editable={canEdit}
                    onClick={canEdit ? () => setIsEditing(true) : undefined}
                  />
                  <InfoCard
                    icon={Mail}
                    label="Email"
                    value={email || 'Brak adresu email'}
                    iconBg="bg-green-500"
                  />
                  <InfoCard
                    icon={GraduationCap}
                    label="Klasa/Grupa"
                    value={classNames.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {classNames.map((name, idx) => (
                          <span key={idx} className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-md text-xs font-medium">
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : userClass || 'Brak przypisanych klas'}
                    iconBg="bg-purple-500"
                    editable={canEdit}
                    onClick={canEdit ? () => setIsEditing(true) : undefined}
                  />
                  <InfoCard
                    icon={Phone}
                    label="Numer telefonu"
                    value={phone || 'Nie podano'}
                    iconBg="bg-orange-500"
                    editable={canEdit}
                    onClick={canEdit ? () => setIsEditing(true) : undefined}
                  />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Imię i nazwisko
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Wprowadź imię i nazwisko"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        disabled
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                        placeholder="Email (nie można zmienić)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Klasa
                      </label>
                      <input
                        type="text"
                        value={userClass}
                        onChange={(e) => setUserClass(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Wprowadź klasę"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Numer telefonu <span className="text-gray-500 text-xs">(opcjonalnie)</span>
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={handlePhoneChange}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="+48123456789 lub 123456789"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Numer telefonu jest używany do wysyłania powiadomień SMS o nowych wydarzeniach w kalendarzu.
                      </p>
                    </div>
                  </div>

                  {saveMessage && (
                    <div className={`p-4 rounded-lg ${
                      saveMessage.type === 'success' 
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400' 
                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                    }`}>
                      <div className="flex items-center gap-2">
                        {saveMessage.type === 'success' ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        <span>{saveMessage.text}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <button
                      onClick={handleSaveProfile}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Zapisz zmiany
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                    >
                      Anuluj
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Top Badges */}
            {topBadges.length > 0 && (
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <Trophy className="w-7 h-7 text-yellow-500" />
                    Moje najwyższe odznaki
                  </h2>
                  <button
                    onClick={() => setShowBadgeModal(true)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Zobacz wszystkie
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
                  {topBadges.map((badge) => (
                    <BadgeCard
                      key={badge.id}
                      {...badge}
                      onClick={() => {
                        setSelectedBadge(badge);
                        setShowBadgeModal(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Badge Modal */}
      <Modal
        isOpen={showBadgeModal}
        onClose={() => {
          setShowBadgeModal(false);
          setSelectedBadge(null);
        }}
        title={selectedBadge ? selectedBadge.name : 'Wszystkie odznaki'}
        size="lg"
      >
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400">
            Pełna lista odznak dostępna w sekcji statystyk.
          </p>
          <button
            onClick={() => {
              setShowBadgeModal(false);
              router.push('/profile/statistics');
            }}
            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Przejdź do statystyk
          </button>
        </div>
      </Modal>

      {/* Stats Modal */}
      <Modal
        isOpen={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        title="Szczegółowe statystyki"
        size="lg"
      >
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Szczegółowe statystyki dostępne w dedykowanej sekcji.
          </p>
          <button
            onClick={() => {
              setShowStatsModal(false);
              router.push('/profile/statistics');
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Przejdź do statystyk
          </button>
        </div>
      </Modal>
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
