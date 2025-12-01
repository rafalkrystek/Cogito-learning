"use client";
import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../config/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  UserCredential,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
} from 'firebase/firestore';

export type UserRole = 'student' | 'teacher' | 'admin' | 'parent';

export type User = {
  uid: string;
  email: string;
  role: UserRole;
  displayName?: string | null;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  error: string | null;
  register: (email: string, password: string, displayName: string, role: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<void>;
  loginWithApproval: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
  getCurrentUserRole: () => Promise<UserRole | null>;
  isAuthenticated: boolean;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  // Logout user
  const logout = useCallback(async () => {
    try {
      // Wyloguj z Firebase
      await signOut(auth);
      
      // Wyczyść wszystkie dane z sessionStorage związane z autoryzacją
      sessionStorage.removeItem('firebaseToken');
      sessionStorage.removeItem('lastActivity');
      sessionStorage.removeItem('token');
      
      // Wyczyść cache danych użytkownika z sessionStorage
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('userData_')) {
          sessionStorage.removeItem(key);
        }
      });
      
      // Wyczyść również localStorage dla kompatybilności wstecznej
      localStorage.removeItem('firebaseToken');
      localStorage.removeItem('token');
      localStorage.removeItem('rememberedEmail');
      localStorage.removeItem('rememberedPassword');
      localStorage.removeItem('tokenExpiry');
      
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('userData_')) {
          localStorage.removeItem(key);
        }
      });
      
      // Resetuj stan użytkownika
      setUser(null);
      setIsAuthenticated(false);
      
      // Przekieruj do strony logowania
      router.push('/login');
      
      // Wymuś odświeżenie strony aby wyczyścić wszystkie cache
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }, [router]);

  // Automatyczne wylogowanie po 30 minutach nieaktywności
  useEffect(() => {
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minut w milisekundach
    let inactivityTimer: NodeJS.Timeout;

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      
      // Zapisz timestamp ostatniej aktywności
      sessionStorage.setItem('lastActivity', Date.now().toString());
      
      // Ustaw nowy timer
      inactivityTimer = setTimeout(async () => {
        console.warn('⏰ Automatyczne wylogowanie z powodu nieaktywności (30 min)');
        await logout();
      }, INACTIVITY_TIMEOUT);
    };

    // Sprawdź czy użytkownik jest zalogowany
    if (isAuthenticated) {
      // Sprawdź ostatnią aktywność przy załadowaniu strony
      const lastActivity = sessionStorage.getItem('lastActivity');
      if (lastActivity) {
        const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
        if (timeSinceLastActivity > INACTIVITY_TIMEOUT) {
          console.warn('⏰ Sesja wygasła - wylogowanie');
          // logout(); // TODO: Fix circular dependency
          return;
        }
      }

      // Nasłuchuj na aktywność użytkownika
      const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
      events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer);
      });

      // Uruchom timer
      resetInactivityTimer();

      // Cleanup
      return () => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        events.forEach(event => {
          document.removeEventListener(event, resetInactivityTimer);
        });
      };
    }
  }, [isAuthenticated, logout]);

  // Update useEffect to use logout
  useEffect(() => {
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minut w milisekundach
    let inactivityTimer: NodeJS.Timeout;

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      
      // Zapisz timestamp ostatniej aktywności
      sessionStorage.setItem('lastActivity', Date.now().toString());
      
      // Ustaw nowy timer
      inactivityTimer = setTimeout(async () => {
        console.warn('⏰ Automatyczne wylogowanie z powodu nieaktywności (30 min)');
        await logout();
      }, INACTIVITY_TIMEOUT);
    };

    // Sprawdź czy użytkownik jest zalogowany
    if (isAuthenticated) {
      // Sprawdź ostatnią aktywność przy załadowaniu strony
      const lastActivity = sessionStorage.getItem('lastActivity');
      if (lastActivity) {
        const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
        if (timeSinceLastActivity > INACTIVITY_TIMEOUT) {
          console.warn('⏰ Sesja wygasła - wylogowanie');
          logout();
          return;
        }
      }

      // Nasłuchuj na aktywność użytkownika
      const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
      events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer);
      });

      // Uruchom timer
      resetInactivityTimer();

      // Cleanup
      return () => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        events.forEach(event => {
          document.removeEventListener(event, resetInactivityTimer);
        });
      };
    }
  }, [isAuthenticated, logout]);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Sprawdź cache przed żądaniem do Firestore (używamy sessionStorage dla bezpieczeństwa)
          const cacheKey = `userData_${firebaseUser.uid}`;
          const cachedData = sessionStorage.getItem(cacheKey);
          let userData: any = {};
          let role: UserRole = 'student';

          if (cachedData) {
            try {
              const parsed = JSON.parse(cachedData);
              // Sprawdź czy cache nie jest starszy niż 5 minut
              if (parsed.timestamp && Date.now() - parsed.timestamp < 300000) {
                userData = parsed.data;
                role = (userData as any).role as UserRole || 'student';
                console.log('📦 Używam cached danych użytkownika (sessionStorage)');
              } else {
                throw new Error('Cache expired');
              }
            } catch {
              // Cache nieprawidłowy lub wygasł, pobierz nowe dane
              console.log('🔄 Cache nieprawidłowy, pobieram nowe dane');
            }
          }

          if (!cachedData || Object.keys(userData).length === 0) {
            // Get additional user data from Firestore z timeoutem
            const userDocPromise = getDoc(doc(db, 'users', firebaseUser.uid));
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout pobierania danych użytkownika')), 3000)
            );
            
            const userDoc = await Promise.race([userDocPromise, timeoutPromise]) as any;
            userData = userDoc.exists() ? userDoc.data() : {};
            role = (userData as any).role as UserRole || 'student';

            // Zapisz do cache (sessionStorage - wygasa po zamknięciu przeglądarki)
            sessionStorage.setItem(cacheKey, JSON.stringify({
              data: userData,
              timestamp: Date.now()
            }));
            console.log('💾 Dane użytkownika zapisane do cache (sessionStorage)');
          }

          console.log('AuthContext - Firebase user data:', userData);
          console.log('AuthContext - Detected role:', role);

          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            role: role,
          });
          setIsAuthenticated(true);

          // Store the token (używamy sessionStorage dla bezpieczeństwa)
          const token = await firebaseUser.getIdToken();
          sessionStorage.setItem('firebaseToken', token);
          
          // Ustaw timestamp ostatniej aktywności
          sessionStorage.setItem('lastActivity', Date.now().toString());

          // Nie przekierowujemy rodzica nigdzie - ma widzieć normalną stronę homelogin
        } else {
          setUser(null);
          setIsAuthenticated(false);
          
          // Wyczyść sessionStorage
          sessionStorage.removeItem('firebaseToken');
          sessionStorage.removeItem('lastActivity');
          
          // Wyczyść cache przy wylogowaniu (zarówno localStorage jak i sessionStorage)
          Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('userData_')) {
              sessionStorage.removeItem(key);
            }
          });
          
          // Wyczyść również localStorage dla kompatybilności wstecznej
          localStorage.removeItem('firebaseToken');
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('userData_')) {
              localStorage.removeItem(key);
            }
          });
        }
      } catch (err) {
        console.error('AuthContext error:', err);
        setUser(null);
        setIsAuthenticated(false);
        sessionStorage.removeItem('firebaseToken');
        localStorage.removeItem('firebaseToken'); // Kompatybilność wsteczna
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Register user with email, password, and role
  const register = async (email: string, password: string, displayName: string, role: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      // Save user data to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName,
        role
      });
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  // Login user
  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  // Login user with approval check
  const loginWithApproval = async (email: string, password: string) => {
    console.log('loginWithApproval wywołane', email);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (!userDoc.exists()) {
      await signOut(auth);
      throw new Error('Użytkownik nie istnieje.');
    }

    const userData = userDoc.data();
    console.log('loginWithApproval - User data from Firestore:', userData);
    console.log('loginWithApproval - User role:', userData.role);
    
    if (!userData.approved && userData.role !== 'parent') {
      await signOut(auth);
      throw new Error('Twoje konto oczekuje na zatwierdzenie przez administratora.');
    }

    // Ustaw custom claims w Firebase Auth jeśli rola jest teacher/admin/parent
    if (userData.role === 'teacher' || userData.role === 'admin' || userData.role === 'parent') {
      try {
        // Dodaj timeout dla API call - maksymalnie 5 sekund (więcej czasu na produkcję)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`/api/set-${userData.role}-role-api`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uid: user.uid }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          console.log(`✅ Custom claims set for ${userData.role}`);
          // Poczekaj chwilę na propagację custom claims w Firebase
          await new Promise(resolve => setTimeout(resolve, 500));
          // Odśwież token aby uzyskać nowe custom claims
          await user.getIdToken(true); // forceRefresh = true
          console.log(`✅ Token refreshed with new custom claims`);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.warn(`⚠️ Failed to set custom claims for ${userData.role}:`, errorData);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn(`⚠️ Custom claims API timeout for ${userData.role} - continuing login`);
        } else {
          console.error('Error setting custom claims:', error);
        }
      }
    }

    // Zapisz token JWT do sessionStorage (bezpieczniejsze niż localStorage)
    // Użyj forceRefresh jeśli rola to admin/teacher/parent, aby mieć pewność że mamy najnowsze custom claims
    const forceRefresh = userData.role === 'admin' || userData.role === 'teacher' || userData.role === 'parent';
    const token = await user.getIdToken(forceRefresh);
    console.log('Pobrany token:', token.substring(0, 20) + '...');
    sessionStorage.setItem('firebaseToken', token);
    sessionStorage.setItem('lastActivity', Date.now().toString());
    console.log('Token zapisany do sessionStorage (bezpieczne)');

    // Zwróć userCredential aby można było pobrać rolę w komponencie logowania
    return userCredential;
  };

  // Get current user role
  const getCurrentUserRole = async (): Promise<UserRole | null> => {
    if (!auth.currentUser) return null;
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (!userDoc.exists()) return null;
    return userDoc.data().role as UserRole || null;
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, register, login, loginWithApproval, logout, getCurrentUserRole, isAuthenticated, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 