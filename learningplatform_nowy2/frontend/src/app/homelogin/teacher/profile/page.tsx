"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { User, Mail, Phone, Calendar, Award, BookOpen, Users, Lock, Eye, EyeOff, RefreshCw, Star, TrendingUp, Activity, Target, Zap, Camera, ArrowLeft, CheckCircle, XCircle, Trophy } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { auth, db, storage } from '@/config/firebase';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import Image from 'next/image';


interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  currentLevel: number;
  currentProgress: number;
  nextLevelThreshold: number;
  levels: {
    name: string;
    threshold: number;
    color: string;
    gradient: string;
  }[];
}

// Komponent karty odznaki dla nauczyciela
function TeacherBadgeCard({ badge }: { badge: Badge }) {
  const [isHovered, setIsHovered] = useState(false);
  const currentLevelData = badge.levels[badge.currentLevel];
  const progressPercentage = badge.nextLevelThreshold > 0 
    ? Math.min(100, (badge.currentProgress / badge.nextLevelThreshold) * 100)
    : 100;

  return (
    <div
      className={`relative bg-gradient-to-br ${currentLevelData.gradient} rounded-xl p-4 border-2 border-white/30 hover:border-white/50 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl cursor-pointer`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Poziom odznaki */}
      <div className="absolute top-2 right-2">
        <div className="px-2 py-1 rounded-full text-xs font-bold text-white bg-white/20 backdrop-blur-sm">
          {currentLevelData.name}
        </div>
      </div>

      {/* Ikona */}
      <div className="flex justify-center mb-3">
        <div className={`text-4xl transform transition-transform duration-300 ${isHovered ? 'scale-125 rotate-12' : ''}`}>
          {badge.icon}
        </div>
      </div>

      {/* Nazwa */}
      <h4 className="text-base font-bold text-white mb-1 text-center">
        {badge.name}
      </h4>

      {/* Opis */}
      <p className="text-xs text-white/90 text-center mb-2">
        {badge.description}
      </p>

      {/* Poziom */}
      <p className="text-xs text-white/80 text-center mb-2">
        Poziom {badge.currentLevel + 1} / {badge.levels.length}
      </p>

      {/* Pasek postępu */}
      {badge.currentLevel < badge.levels.length - 1 ? (
        <div className="space-y-1">
          <div className="w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 bg-white/40"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-xs text-white/80 text-center">
            {Math.round(badge.currentProgress)} / {badge.nextLevelThreshold}
          </p>
        </div>
      ) : (
        <div className="text-center">
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-white/20 rounded-full">
            <Trophy className="w-3 h-3 text-yellow-300" />
            <span className="text-xs font-semibold text-white">Maksymalny poziom!</span>
          </div>
        </div>
      )}

      {/* Tooltip z wszystkimi poziomami */}
      {isHovered && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white rounded-lg p-4 shadow-xl z-10">
          <div className="text-xs font-semibold mb-2">Wszystkie poziomy:</div>
          <div className="space-y-1">
            {badge.levels.map((level, idx) => (
              <div
                key={idx}
                className={`text-xs flex items-center justify-between ${
                  idx === badge.currentLevel ? 'font-bold' : idx < badge.currentLevel ? 'opacity-75' : 'opacity-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={idx <= badge.currentLevel ? level.color : 'text-gray-500'}>
                    {level.name}
                  </span>
                </span>
                <span className="text-gray-400">{typeof level.threshold === 'number' ? Math.round(level.threshold) : level.threshold}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ProfileData {
  displayName: string;
  email: string;
  phone: string;
  activeCourses: number;
  totalStudents: number;
  averageRating: number;
  totalLessons: number;
}

export default function TeacherProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'stats' | 'password'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [photoURL, setPhotoURL] = useState('');
  const [uploading, setUploading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Profile data state - start with empty values
  const [profileData, setProfileData] = useState<ProfileData>({
    displayName: '',
    email: '',
    phone: '',
    activeCourses: 0,
    totalStudents: 0,
    averageRating: 0,
    totalLessons: 0
  });

  // Editable profile data
  const [editableProfile, setEditableProfile] = useState<ProfileData>(profileData);

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Messages
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [badges, setBadges] = useState<Badge[]>([]);
  const [teacherStats, setTeacherStats] = useState({
    totalCourses: 0,
    totalStudents: 0,
    averageRating: 0,
    totalLessons: 0,
    totalGrades: 0,
    activeDays: 0
  });

  const loadUserData = useCallback(async () => {
    if (user) {
      try {
        // Get displayName and email from Firebase Auth
        const currentUser = auth.currentUser;
        if (currentUser) {
          const displayName = currentUser.displayName || '';
          const email = currentUser.email || '';
          
          // Get additional data from Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const userData = userDoc.data();
          
          // Priorytet: Firestore > Firebase Auth > pusty string
          const photoUrl = userData?.photoURL || currentUser.photoURL || '';
          console.log('Loading photoURL:', { 
            firestore: userData?.photoURL, 
            auth: currentUser.photoURL, 
            final: photoUrl 
          });
          
          setPhotoURL(photoUrl);
          
          setProfileData(prev => ({
            ...prev,
            displayName,
            email,
            phone: userData?.phone || '',
            activeCourses: userData?.activeCourses || 0,
            totalStudents: userData?.totalStudents || 0,
            averageRating: userData?.averageRating || 0,
            totalLessons: userData?.totalLessons || 0
          }));
          
          setEditableProfile(prev => ({
            ...prev,
            displayName,
            email,
            phone: userData?.phone || ''
          }));
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    }
    setTimeout(() => setLoading(false), 500);
  }, [user]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Proszę wybrać plik obrazu (JPG, PNG)' });
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Plik jest za duży. Maksymalny rozmiar to 5MB.' });
      return;
    }
    
    try {
      setUploading(true);
      setMessage(null);
      
      console.log('Starting photo upload for user:', user.uid);
      
      // Upload to Firebase Storage
      const storageRef = ref(storage, `profile_photos/${user.uid}`);
      console.log('Uploading to storage:', storageRef.fullPath);
      
      await uploadBytes(storageRef, file);
      console.log('File uploaded successfully');
      
      // Get download URL
      const url = await getDownloadURL(storageRef);
      console.log('Download URL obtained:', url);
      
      // Update Firestore
      await updateDoc(doc(db, 'users', user.uid), { 
        photoURL: url,
        updated_at: new Date().toISOString()
      });
      console.log('Firestore updated with photoURL');
      
      // Update Firebase Auth profile
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: url });
        console.log('Firebase Auth profile updated');
      }
      
      // Update local state immediately
      setPhotoURL(url);
      
      // Reload user data to ensure consistency
      await loadUserData();
      
      setMessage({ type: 'success', text: 'Zdjęcie profilowe zostało zaktualizowane!' });
      
      // Optional: reload page after 2 seconds to ensure everything is synced
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      let errorMessage = 'Błąd podczas przesyłania zdjęcia. Spróbuj ponownie.';
      
      if (error.code === 'storage/unauthorized') {
        errorMessage = 'Brak uprawnień do przesyłania zdjęć. Skontaktuj się z administratorem.';
      } else if (error.code === 'storage/quota-exceeded') {
        errorMessage = 'Przekroczono limit przestrzeni. Skontaktuj się z administratorem.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const loadTeacherStats = useCallback(async () => {
    if (!user?.uid || !user?.email) return;
    
    setLoadingStats(true);
    try {
      console.log('Obliczanie statystyk nauczyciela z Firebase...');
      
      // 1. Pobierz kursy nauczyciela
      const coursesCollection = collection(db, 'courses');
      const [coursesByEmail, coursesByUid, coursesByTeacherEmail] = await Promise.all([
        getDocs(query(coursesCollection, where('created_by', '==', user.email))),
        getDocs(query(coursesCollection, where('created_by', '==', user.uid))),
        getDocs(query(coursesCollection, where('teacherEmail', '==', user.email)))
      ]);
      
      // Połącz i deduplikuj kursy
      const coursesMap = new Map();
      [coursesByEmail, coursesByUid, coursesByTeacherEmail].forEach(snapshot => {
        snapshot.docs.forEach(doc => {
          coursesMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
      });
      const courses = Array.from(coursesMap.values());
      const activeCourses = courses.length;
      
      console.log(`Znaleziono ${activeCourses} kursów`);
      
      // 2. Pobierz wszystkich uczniów przypisanych do kursów nauczyciela
      const allAssignedUsers = new Set<string>();
      courses.forEach((course: any) => {
        if (course.assignedUsers && Array.isArray(course.assignedUsers)) {
          course.assignedUsers.forEach((userId: string) => allAssignedUsers.add(userId));
        }
      });
      
      // 3. Pobierz dane uczniów
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
      
      const totalStudents = uniqueStudents.size;
      
      console.log(`Znaleziono ${totalStudents} unikalnych uczniów`);
      
      // 4. Oblicz średnią ocenę z ankiet nauczyciela
      let averageRating = 0;
      try {
        const surveysCollection = collection(db, 'teacherSurveys');
        const surveysQuery = query(surveysCollection, where('teacherId', '==', user.uid));
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
              // Oblicz średnią z responses
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
        console.error('Błąd podczas pobierania ankiet:', error);
      }
      
      console.log(`Średnia ocena: ${averageRating.toFixed(1)}`);
      
      // 5. Oblicz liczbę lekcji i materiałów
      let totalLessons = 0;
      courses.forEach((course: any) => {
        if (course.sections && Array.isArray(course.sections)) {
          course.sections.forEach((section: any) => {
            if (section.subsections && section.subsections.length > 0) {
              totalLessons += section.subsections.length;
            } else if (section.contents && section.contents.length > 0) {
              totalLessons += 1;
            }
          });
        }
      });
      
      // 6. Pobierz liczbę wystawionych ocen
      let totalGrades = 0;
      try {
        const gradesCollection = collection(db, 'grades');
        const gradesQuery = query(gradesCollection, where('teacherId', '==', user.uid));
        const gradesSnapshot = await getDocs(gradesQuery);
        totalGrades = gradesSnapshot.docs.length;
      } catch (error) {
        console.error('Błąd podczas pobierania ocen:', error);
      }
      
      // 8. Pobierz liczbę aktywnych dni (jeśli istnieje userLearningTime dla nauczyciela)
      let activeDays = 0;
      try {
        const learningTimeDoc = await getDoc(doc(db, 'userLearningTime', user.uid));
        if (learningTimeDoc.exists()) {
          const data = learningTimeDoc.data();
          if (data.dailyStats) {
            activeDays = Object.keys(data.dailyStats).length;
          }
        }
      } catch (error) {
        console.error('Błąd podczas pobierania aktywności:', error);
      }
      
      // Zaktualizuj statystyki
      setProfileData(prev => ({
        ...prev,
        activeCourses,
        totalStudents,
        averageRating,
        totalLessons
      }));
      
      // Zaktualizuj rozszerzone statystyki dla odznak
      setTeacherStats({
        totalCourses: activeCourses,
        totalStudents,
        averageRating,
        totalLessons,
        totalGrades,
        activeDays
      });
      
      // Opcjonalnie: zapisz statystyki do dokumentu użytkownika
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          activeCourses,
          totalStudents,
          averageRating,
          totalLessons,
          statsUpdatedAt: new Date().toISOString()
        });
        console.log('Statystyki zapisane do Firestore');
      } catch (error) {
        console.error('Błąd podczas zapisywania statystyk:', error);
      }
      
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoadingStats(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserData();
    loadTeacherStats();
  }, [user, loadUserData, loadTeacherStats]);

  // Oblicz odznaki na podstawie statystyk nauczyciela
  useEffect(() => {
    const calculateBadges = () => {
      const { totalCourses, totalStudents, averageRating, totalLessons, totalGrades, activeDays } = teacherStats;

      const calculateLevel = (value: number, thresholds: number[]): number => {
        for (let i = thresholds.length - 1; i >= 0; i--) {
          if (value >= thresholds[i]) return i;
        }
        return 0;
      };

      const calculatedBadges: Badge[] = [
        {
          id: 'education-master',
          name: 'Mistrz Edukacji',
          description: 'Za liczbę utworzonych kursów',
          icon: '📚',
          currentLevel: calculateLevel(totalCourses, [0, 3, 10, 20, 50]),
          currentProgress: totalCourses,
          nextLevelThreshold: [3, 10, 20, 50, 100][Math.min(calculateLevel(totalCourses, [0, 3, 10, 20, 50]) + 1, 4)] || 100,
          levels: [
            { name: 'Brąz', threshold: 0, color: 'bg-amber-700', gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 3, color: 'bg-gray-400', gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 10, color: 'bg-yellow-500', gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 20, color: 'bg-cyan-400', gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 50, color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' }
          ]
        },
        {
          id: 'mentor',
          name: 'Mentor',
          description: 'Za liczbę uczniów',
          icon: '👥',
          currentLevel: calculateLevel(totalStudents, [0, 5, 20, 50, 100]),
          currentProgress: totalStudents,
          nextLevelThreshold: [5, 20, 50, 100, 200][Math.min(calculateLevel(totalStudents, [0, 5, 20, 50, 100]) + 1, 4)] || 200,
          levels: [
            { name: 'Brąz', threshold: 0, color: 'bg-amber-700', gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 5, color: 'bg-gray-400', gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 20, color: 'bg-yellow-500', gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 50, color: 'bg-cyan-400', gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 100, color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' }
          ]
        },
        {
          id: 'expert',
          name: 'Ekspert',
          description: 'Za wysoką średnią ocenę od uczniów',
          icon: '⭐',
          currentLevel: calculateLevel(averageRating, [0, 3.5, 4, 4.5, 4.8]),
          currentProgress: Math.round(averageRating * 10) / 10,
          nextLevelThreshold: [3.5, 4, 4.5, 4.8, 5][Math.min(calculateLevel(averageRating, [0, 3.5, 4, 4.5, 4.8]) + 1, 4)] || 5,
          levels: [
            { name: 'Brąz', threshold: 0, color: 'bg-amber-700', gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 3.5, color: 'bg-gray-400', gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 4, color: 'bg-yellow-500', gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 4.5, color: 'bg-cyan-400', gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 4.8, color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' }
          ]
        },
        {
          id: 'content-creator',
          name: 'Twórca Treści',
          description: 'Za liczbę utworzonych lekcji',
          icon: '✍️',
          currentLevel: calculateLevel(totalLessons, [0, 10, 30, 50, 100]),
          currentProgress: totalLessons,
          nextLevelThreshold: [10, 30, 50, 100, 200][Math.min(calculateLevel(totalLessons, [0, 10, 30, 50, 100]) + 1, 4)] || 200,
          levels: [
            { name: 'Brąz', threshold: 0, color: 'bg-amber-700', gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 10, color: 'bg-gray-400', gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 30, color: 'bg-yellow-500', gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 50, color: 'bg-cyan-400', gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 100, color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' }
          ]
        },
        {
          id: 'active-teacher',
          name: 'Aktywny Nauczyciel',
          description: 'Za liczbę dni aktywności',
          icon: '🔥',
          currentLevel: calculateLevel(activeDays, [0, 7, 30, 60, 120]),
          currentProgress: activeDays,
          nextLevelThreshold: [7, 30, 60, 120, 180][Math.min(calculateLevel(activeDays, [0, 7, 30, 60, 120]) + 1, 4)] || 180,
          levels: [
            { name: 'Brąz', threshold: 0, color: 'bg-amber-700', gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 7, color: 'bg-gray-400', gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 30, color: 'bg-yellow-500', gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 60, color: 'bg-cyan-400', gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 120, color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' }
          ]
        },
        {
          id: 'fair-judge',
          name: 'Sprawiedliwy Sędzia',
          description: 'Za liczbę wystawionych ocen',
          icon: '⚖️',
          currentLevel: calculateLevel(totalGrades, [0, 10, 50, 100, 200]),
          currentProgress: totalGrades,
          nextLevelThreshold: [10, 50, 100, 200, 500][Math.min(calculateLevel(totalGrades, [0, 10, 50, 100, 200]) + 1, 4)] || 500,
          levels: [
            { name: 'Brąz', threshold: 0, color: 'bg-amber-700', gradient: 'from-amber-700 to-amber-800' },
            { name: 'Srebro', threshold: 10, color: 'bg-gray-400', gradient: 'from-gray-400 to-gray-500' },
            { name: 'Złoto', threshold: 50, color: 'bg-yellow-500', gradient: 'from-yellow-500 to-yellow-600' },
            { name: 'Platyna', threshold: 100, color: 'bg-cyan-400', gradient: 'from-cyan-400 to-cyan-500' },
            { name: 'Diament', threshold: 200, color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' }
          ]
        }
      ];

      // Posortuj według poziomu (najwyższe pierwsze)
      const sorted = calculatedBadges.sort((a, b) => b.currentLevel - a.currentLevel || b.currentProgress - a.currentProgress);
      setBadges(sorted);
    };

    calculateBadges();
  }, [teacherStats]);

  const handleEdit = () => {
    setIsEditing(true);
    setEditableProfile(profileData);
    setMessage(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditableProfile(profileData);
    setMessage(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      // Validate data
      if (!editableProfile.displayName.trim()) {
        throw new Error('Imię i nazwisko nie może być puste');
      }

      if (!editableProfile.phone.trim()) {
        throw new Error('Telefon nie może być pusty');
      }

      // Update displayName in Firebase Auth
      const currentUser = auth.currentUser;
      if (currentUser) {
        await updateProfile(currentUser, {
          displayName: editableProfile.displayName
        });
      }

      // Update additional data in Firestore
      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), {
          displayName: editableProfile.displayName,
          phone: editableProfile.phone
        });
      }

      // Update local state
      setProfileData(prev => ({
        ...prev,
        displayName: editableProfile.displayName,
        phone: editableProfile.phone
      }));
      
      setIsEditing(false);
      setMessage({ type: 'success', text: 'Profil został zaktualizowany pomyślnie!' });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Wystąpił błąd podczas zapisywania' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Nowe hasła nie są identyczne' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Nowe hasło musi mieć co najmniej 6 znaków' });
      return;
    }

    setIsChangingPassword(true);
    setMessage(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error('Użytkownik nie jest zalogowany lub brakuje emaila');
      }

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        passwordData.currentPassword
      );
      
      await reauthenticateWithCredential(currentUser, credential);
      
      // Update password
      await updatePassword(currentUser, passwordData.newPassword);
      
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setMessage({ type: 'success', text: 'Hasło zostało zmienione pomyślnie!' });
    } catch (error) {
      let errorMessage = 'Wystąpił błąd podczas zmiany hasła';
      
      if (error instanceof Error) {
        if (error.message.includes('wrong-password')) {
          errorMessage = 'Aktualne hasło jest nieprawidłowe';
        } else if (error.message.includes('weak-password')) {
          errorMessage = 'Nowe hasło jest zbyt słabe';
        } else {
          errorMessage = error.message;
        }
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsChangingPassword(false);
    }
  };

  useEffect(() => {
    // Załaduj statystyki przy pierwszym załadowaniu i gdy przełączamy na zakładkę stats
    if (activeTab === 'stats') {
      loadTeacherStats();
    }
  }, [activeTab, loadTeacherStats]);

  // Załaduj statystyki również przy pierwszym załadowaniu profilu (dla podglądu)
  useEffect(() => {
    if (user && previewMode) {
      loadTeacherStats();
    }
  }, [user, previewMode, loadTeacherStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4 mb-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/homelogin/teacher')}
            className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm text-gray-700 rounded-lg hover:bg-white hover:shadow-lg transition-all duration-200 ease-in-out border border-white/20"
          >
            <ArrowLeft className="w-4 h-4" />
            Powrót do panelu
          </button>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {previewMode ? 'Podgląd Profilu (Widok Ucznia)' : 'Mój Profil'}
          </h1>
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ease-in-out border ${
              previewMode
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-500 hover:from-purple-700 hover:to-pink-700'
                : 'bg-white/60 backdrop-blur-sm text-gray-700 border-white/20 hover:bg-white hover:shadow-lg'
            }`}
          >
            <Eye className="w-4 h-4" />
            {previewMode ? 'Wróć do edycji' : 'Podgląd jak uczeń'}
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
        {previewMode ? (
          /* Preview Mode - Student View */
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg border border-white/20">
              {/* Header */}
              <div className="p-6 bg-gradient-to-r from-[#4067EC] to-[#5577FF] text-white rounded-t-xl">
                <div className="flex items-center gap-4">
                  {photoURL ? (
                    <img 
                      src={photoURL} 
                      alt={profileData.displayName} 
                      className="w-16 h-16 rounded-full object-cover border-2 border-white/20 shadow-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                      {profileData.displayName[0] || 'N'}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-bold">{profileData.displayName || 'Nauczyciel'}</h3>
                      <span className="px-2 py-1 bg-white/20 rounded-full text-xs font-medium">
                        Nauczyciel
                      </span>
                    </div>
                    <p className="text-sm opacity-90">Doświadczony nauczyciel z pasją do nauczania</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Description */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-800 mb-2">O nauczycielu</h4>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Doświadczony nauczyciel z pasją do nauczania. Specjalizuje się w indywidualnym podejściu do każdego ucznia.
                  </p>
                </div>

                {/* Experience & Availability */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Doświadczenie</h5>
                    <p className="text-sm font-medium text-gray-800">5+ lat</p>
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Dostępność</h5>
                    <p className="text-sm font-medium text-gray-800">Pon-Pt 8:00-16:00</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{profileData.activeCourses}</div>
                    <div className="text-xs text-gray-600 mt-1">Kursy</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{profileData.totalStudents}</div>
                    <div className="text-xs text-gray-600 mt-1">Uczniów</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{profileData.averageRating.toFixed(1)}</div>
                    <div className="text-xs text-gray-600 mt-1">Ocena</div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                      <Mail className="w-4 h-4 text-gray-600" />
                    </div>
                    <span className="text-gray-700">{profileData.email}</span>
                  </div>
                  {profileData.phone && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                        <Phone className="w-4 h-4 text-gray-600" />
                      </div>
                      <span className="text-gray-700">{profileData.phone}</span>
                    </div>
                  )}
                </div>

                {/* Achievements */}
                {badges && badges.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-600" />
                        Odznaki
                      </h4>
                      <span className="text-xs text-gray-500">{badges.length} odznak</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {badges.slice(0, 4).map((badge) => (
                        <TeacherBadgeCard key={badge.id} badge={badge} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Info Banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Uwaga:</strong> To jest podgląd profilu tak, jak widzi go uczeń. Wszystkie informacje są tylko do odczytu.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Profile Header Card */}
            <div className="relative overflow-hidden bg-white rounded-2xl shadow-xl border border-gray-200">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 opacity-10"></div>
          <div className="relative p-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Profile Photo */}
              <div className="relative group">
                <div
                  className={`relative w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-2xl transition-all duration-300 ${
                    hovered && !previewMode ? 'ring-4 ring-blue-400 scale-105' : ''
                  }`}
                  onMouseEnter={() => !previewMode && setHovered(true)}
                  onMouseLeave={() => !previewMode && setHovered(false)}
                  onClick={!previewMode ? handlePhotoClick : undefined}
                  style={previewMode ? { cursor: 'default' } : {}}
                >
                  {photoURL ? (
                    <Image
                      src={photoURL}
                      alt="Profile"
                      fill
                      className="object-cover"
                      unoptimized
                      onError={() => {
                        console.error('Error loading image:', photoURL);
                        setPhotoURL('');
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <User className="h-16 w-16 text-white" />
                    </div>
                  )}
                  {!previewMode && (
                    <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-300 ${
                      hovered ? 'opacity-100' : 'opacity-0'
                    }`}>
                      <Camera className="h-8 w-8 text-white" />
                    </div>
                  )}
                </div>
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                {!previewMode && (
                  <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                  <h2 className="text-3xl font-bold text-gray-900">{profileData.displayName || 'Nauczyciel'}</h2>
                  <div className="flex items-center gap-2 px-3 py-1 bg-green-100 rounded-full">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-green-700">Online</span>
                  </div>
                </div>
                <p className="text-gray-600 text-lg mb-4 flex items-center justify-center md:justify-start gap-2">
                  <Mail className="h-4 w-4" />
                  {profileData.email}
                </p>
                <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                  <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{profileData.activeCourses}</div>
                      <div className="text-xs text-gray-600">Aktywne kursy</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg">
                    <Users className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="text-2xl font-bold text-green-600">{profileData.totalStudents}</div>
                      <div className="text-xs text-gray-600">Uczniów</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-lg">
                    <Star className="h-5 w-5 text-purple-600" />
                    <div>
                      <div className="text-2xl font-bold text-purple-600">{profileData.averageRating.toFixed(1)}</div>
                      <div className="text-xs text-gray-600">Średnia ocen</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Message Display */}
        {!previewMode && message && (
          <div className={`p-4 rounded-xl shadow-lg border-2 flex items-center gap-3 animate-in slide-in-from-top-5 ${
            message.type === 'success' 
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 text-green-800' 
              : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-300 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
            ) : (
              <XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        {/* Tabs */}
        {!previewMode && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-2">
          <nav className="flex space-x-2">
            {[
              { key: 'profile', label: 'Informacje Podstawowe', icon: User },
              { key: 'stats', label: 'Statystyki', icon: TrendingUp },
              { key: 'password', label: 'Zmiana Hasła', icon: Lock }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as 'profile' | 'stats' | 'password')}
                  className={`flex items-center gap-2 py-3 px-6 rounded-lg font-medium text-sm transition-all duration-300 ${
                    activeTab === tab.key
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
        )}

        {!previewMode && activeTab === 'profile' && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Profile Info */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  Dane Profilowe
                </h3>
                {!isEditing ? (
                  <button 
                    onClick={handleEdit}
                    className="group text-sm bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-medium shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2"
                  >
                    <User className="h-4 w-4 group-hover:animate-bounce" />
                    Edytuj Profil
                  </button>
                ) : (
                  <div className="flex gap-3">
                    <button 
                      onClick={handleCancel}
                      className="text-sm bg-gradient-to-r from-gray-500 to-gray-600 text-white px-4 py-2 rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 font-medium shadow-lg hover:shadow-xl hover:scale-105"
                    >
                      Anuluj
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="group">
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    Imię i Nazwisko
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={isEditing ? editableProfile.displayName : profileData.displayName}
                      onChange={(e) => isEditing && setEditableProfile(prev => ({ ...prev, displayName: e.target.value }))}
                      className={`w-full border-2 rounded-xl px-4 py-3.5 text-lg focus:outline-none focus:ring-4 transition-all duration-300 ${
                        isEditing 
                          ? 'border-blue-300 bg-white focus:ring-blue-100 focus:border-blue-500 hover:border-blue-400' 
                          : 'border-gray-200 bg-gray-50'
                      }`}
                      readOnly={!isEditing}
                    />
                    {isEditing && (
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="group">
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <Mail className="h-4 w-4 text-green-600" />
                    </div>
                    Email
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={profileData.email}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-lg bg-gray-50 focus:outline-none"
                      readOnly
                    />
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      <Lock className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Email nie może być zmieniony
                  </span>
                </div>

                <div className="group">
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Phone className="h-4 w-4 text-purple-600" />
                    </div>
                    Telefon
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={isEditing ? editableProfile.phone : profileData.phone}
                      onChange={(e) => isEditing && setEditableProfile(prev => ({ ...prev, phone: e.target.value }))}
                      className={`w-full border-2 rounded-xl px-4 py-3.5 text-lg focus:outline-none focus:ring-4 transition-all duration-300 ${
                        isEditing 
                          ? 'border-purple-300 bg-white focus:ring-purple-100 focus:border-purple-500 hover:border-purple-400' 
                          : 'border-gray-200 bg-gray-50'
                      }`}
                      readOnly={!isEditing}
                      placeholder="+48 XXX XXX XXX"
                    />
                    {isEditing && (
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isEditing && (
                <div className="mt-8 pt-6 border-t-2 border-gray-200">
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 px-6 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-xl hover:shadow-2xl hover:scale-105 flex items-center justify-center gap-3 text-lg"
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Zapisywanie...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        Zapisz zmiany
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Recent Achievements */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
                    <Award className="h-6 w-6 text-white" />
                  </div>
                  Ostatnie Osiągnięcia
                </h3>
                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
                  <Trophy className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm font-semibold text-yellow-700">{badges.length} odznak</span>
                </div>
              </div>
              {badges.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {badges.map((badge) => (
                    <TeacherBadgeCard key={badge.id} badge={badge} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">Brak odznak - zacznij tworzyć kursy i uczyć uczniów!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {!previewMode && activeTab === 'password' && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
              <div className="flex items-center mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mr-4">
                  <Lock className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Zmiana Hasła</h3>
                  <p className="text-gray-600">Zaktualizuj swoje hasło do konta</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-blue-600" />
                    Aktualne hasło
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-lg focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-300"
                      placeholder="Wprowadź aktualne hasło"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center hover:opacity-70 transition-opacity"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-green-600" />
                    Nowe hasło
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-lg focus:outline-none focus:ring-4 focus:ring-green-100 focus:border-green-500 transition-all duration-300"
                      placeholder="Wprowadź nowe hasło"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center hover:opacity-70 transition-opacity"
                    >
                      {showNewPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Minimum 6 znaków
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-purple-600" />
                    Potwierdź nowe hasło
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-lg focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all duration-300"
                      placeholder="Potwierdź nowe hasło"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center hover:opacity-70 transition-opacity"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handlePasswordChange}
                  disabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mt-6 font-semibold shadow-xl hover:shadow-2xl hover:scale-105 flex items-center justify-center gap-3 text-lg"
                >
                  {isChangingPassword ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Zmienianie hasła...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      Zmień hasło
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {!previewMode && activeTab === 'stats' && (
          <div>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                Statystyki Nauczyciela
              </h3>
              <button
                onClick={loadTeacherStats}
                disabled={loadingStats}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 font-semibold shadow-lg hover:shadow-xl hover:scale-105"
              >
                <RefreshCw className={`h-5 w-5 ${loadingStats ? 'animate-spin' : ''}`} />
                Odśwież
              </button>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="group bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-100 rounded-2xl shadow-xl border-2 border-blue-200 p-8 text-center hover:shadow-2xl transition-all duration-300 hover:scale-105">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:animate-bounce shadow-lg">
                  <BookOpen className="h-8 w-8 text-white" />
                </div>
                <div className="text-4xl font-bold text-blue-600 mb-2">{profileData.activeCourses}</div>
                <div className="text-base text-blue-700 font-semibold mb-3">Aktywne Kursy</div>
                <div className="flex items-center justify-center mt-2 px-3 py-1.5 bg-green-100 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                  <span className="text-xs font-semibold text-green-700">+2 w tym miesiącu</span>
                </div>
              </div>

              <div className="group bg-gradient-to-br from-green-50 via-emerald-100 to-teal-100 rounded-2xl shadow-xl border-2 border-green-200 p-8 text-center hover:shadow-2xl transition-all duration-300 hover:scale-105">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:animate-bounce shadow-lg">
                  <Users className="h-8 w-8 text-white" />
                </div>
                <div className="text-4xl font-bold text-green-600 mb-2">{profileData.totalStudents}</div>
                <div className="text-base text-green-700 font-semibold mb-3">Uczniów</div>
                <div className="flex items-center justify-center mt-2 px-3 py-1.5 bg-blue-100 rounded-lg">
                  <Activity className="h-4 w-4 text-blue-600 mr-1" />
                  <span className="text-xs font-semibold text-blue-700">Aktywni uczniowie</span>
                </div>
              </div>

              <div className="group bg-gradient-to-br from-purple-50 via-purple-100 to-pink-100 rounded-2xl shadow-xl border-2 border-purple-200 p-8 text-center hover:shadow-2xl transition-all duration-300 hover:scale-105">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:animate-bounce shadow-lg">
                  <Calendar className="h-8 w-8 text-white" />
                </div>
                <div className="text-4xl font-bold text-purple-600 mb-2">{profileData.totalLessons}</div>
                <div className="text-base text-purple-700 font-semibold mb-3">Przeprowadzonych Lekcji</div>
                <div className="flex items-center justify-center mt-2 px-3 py-1.5 bg-orange-100 rounded-lg">
                  <Target className="h-4 w-4 text-orange-600 mr-1" />
                  <span className="text-xs font-semibold text-orange-700">Cel: 150 lekcji</span>
                </div>
              </div>

              <div className="group bg-gradient-to-br from-yellow-50 via-amber-100 to-orange-100 rounded-2xl shadow-xl border-2 border-yellow-200 p-8 text-center hover:shadow-2xl transition-all duration-300 hover:scale-105">
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:animate-bounce shadow-lg">
                  <Star className="h-8 w-8 text-white" />
                </div>
                <div className="text-4xl font-bold text-yellow-600 mb-2">{profileData.averageRating.toFixed(1)}</div>
                <div className="text-base text-yellow-700 font-semibold mb-3">Średnia Ocen Uczniów</div>
                <div className="flex items-center justify-center mt-2 px-3 py-1.5 bg-pink-100 rounded-lg">
                  <Zap className="h-4 w-4 text-pink-600 mr-1" />
                  <span className="text-xs font-semibold text-pink-700">Wysoka ocena!</span>
                </div>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}