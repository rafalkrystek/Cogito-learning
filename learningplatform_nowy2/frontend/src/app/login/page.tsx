"use client";
import { useState, useEffect, lazy, Suspense } from "react";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { BookOpen, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import CogitoLogo from '@/components/CogitoLogo';

// Lazy load komponenty
const Notification = lazy(() => import('@/components/Notification'));
const ThemeToggle = lazy(() => import('@/components/ThemeToggle'));
const SocialLoginButtons = lazy(() => import('@/components/Auth/SocialLoginButtons'));
const Providers = lazy(() => import('@/components/Providers'));
const RealisticGlobe = lazy(() => import('@/components/Auth/RealisticGlobe'));

function LoginPageContent() {
  const router = useRouter();
  const { loginWithApproval } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [firebaseError, setFirebaseError] = useState("");


  // Load data from localStorage on first render
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("rememberedEmail");
      const savedPassword = localStorage.getItem("rememberedPassword");
      if (savedEmail && savedPassword) {
        setEmail(savedEmail);
        setPassword(savedPassword);
        setRememberMe(true);
      }
    } catch (err) {
      console.error("Error loading saved credentials:", err);
    }
  }, []);

  // Show notification when auth error occurs
  useEffect(() => {
    if (firebaseError) {
      showNotification('error', firebaseError);
    }
  }, [firebaseError]);

  // Function to show notifications
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    
    // Automatically hide notification after 5 seconds
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // Handle remember me toggle
  const handleRememberMeToggle = () => {
    setRememberMe(!rememberMe);
  };

  // Handle form submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFirebaseError("");
    setIsSubmitting(true);
    
    // Basic client-side validation
    const tempErrors: {[key: string]: string} = {};
    if (!email) tempErrors.email = "Nazwa użytkownika lub email jest wymagana";
    if (!password) tempErrors.password = "Hasło jest wymagane";
    
    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      setIsSubmitting(false);
      return;
    }
    
    // Save data in localStorage if "Remember me" is checked
    try {
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email);
        localStorage.setItem("rememberedPassword", password);
      } else {
        localStorage.removeItem("rememberedEmail");
        localStorage.removeItem("rememberedPassword");
      }
    } catch (err) {
      console.error("Error saving credentials:", err);
    }
    
    try {
      console.log('🔄 Rozpoczynam logowanie...');
      const userCredential = await loginWithApproval(email, password);
      
      console.log('✅ Logowanie Firebase zakończone, pobieram dane użytkownika...');
      // Pobierz dane użytkownika z Firestore z timeoutem
      const userDocPromise = getDoc(doc(db, 'users', userCredential.user.uid));
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout pobierania danych użytkownika')), 5000)
      );
      
      const userDoc = await Promise.race([userDocPromise, timeoutPromise]) as any;
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const userRole = userData.role;
        
        console.log(`🎯 Przekierowuję użytkownika z rolą: ${userRole}`);
        // Przekieruj bezpośrednio na właściwy panel na podstawie roli
        if (userRole === 'teacher') {
          router.push('/homelogin/teacher');
        } else if (userRole === 'admin') {
          router.push('/homelogin/superadmin');
        } else if (userRole === 'parent') {
          router.push('/homelogin/parent');
        } else {
          // Student - domyślnie na dashboard
          router.push('/homelogin');
        }
      } else {
        console.log('⚠️ Dokument użytkownika nie istnieje, przekierowuję na domyślną stronę');
        // Fallback - jeśli nie można pobrać roli
        router.push('/homelogin');
      }
    } catch (err: unknown) {
      console.error('❌ Błąd podczas logowania:', err);
      setFirebaseError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocialLoginSuccess = async (user: any) => {
    console.log('handleSocialLoginSuccess called, user:', user);
    
    try {
      // Pobierz dane użytkownika z Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const userRole = userData.role;
        
        // Przekieruj bezpośrednio na właściwy panel na podstawie roli
        if (userRole === 'teacher') {
          router.push('/homelogin/teacher');
        } else if (userRole === 'admin') {
          router.push('/homelogin/superadmin');
        } else if (userRole === 'parent') {
          router.push('/homelogin/parent');
        } else {
          // Student - domyślnie na dashboard
          router.push('/homelogin');
        }
      } else {
        // Fallback - jeśli nie można pobrać roli
        router.push('/homelogin');
      }
    } catch (error) {
      console.error('Error getting user role:', error);
      // Fallback - jeśli wystąpi błąd
      router.push('/homelogin');
    }
  };

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden" style={{ maxWidth: '100vw', overflowX: 'hidden' }}>
      {notification && (
        <Suspense fallback={null}>
          <Notification 
            type={notification.type} 
            message={notification.message} 
            onClose={() => setNotification(null)}
          />
        </Suspense>
      )}
      
      {/* Left Side - Login Form - PEŁNA SZEROKOŚĆ NA MOBILE */}
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col justify-center items-center w-full lg:w-1/2 min-h-screen bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/50 py-8 px-4 sm:px-6 lg:px-12 relative overflow-x-hidden"
        style={{ 
          maxWidth: '100%',
          overflowX: 'hidden'
        }}
      >
        {/* Logo */}
        <div 
          className="absolute top-6 left-6 flex flex-col items-center z-20 cursor-pointer group transition-all duration-300" 
          onClick={() => router.push('/')}
        >
          <div className="relative flex items-center justify-center mb-1">
            <CogitoLogo 
              size={34}
              className="w-[34px] h-[34px] transition-transform duration-300 group-hover:scale-110 object-contain"
            />
          </div>
          <span className="text-base font-semibold text-gray-800 group-hover:text-[#4067EC] transition-colors duration-300">Cogito</span>
        </div>
        
        {/* Theme Toggle */}
        <div className="absolute top-6 right-6 z-20">
          <Suspense fallback={<div className="w-10 h-10" />}>
            <ThemeToggle />
          </Suspense>
        </div>

        {/* Login Form Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 sm:p-10"
          style={{ 
            width: '100%',
            maxWidth: '28rem',
            boxSizing: 'border-box'
          }}
        >
          {/* Icon */}
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3, type: "spring" }}
            className="flex justify-center mb-6"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <h1 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Witaj, Przyszły Innowatorze!
            </h1>
            <p className="text-center text-gray-500 text-sm mb-8">
              Edukacja dla Aktywności Uczenia się
            </p>
          </motion.div>

          {/* Form */}
          <form className="space-y-5" onSubmit={handleLogin}>
            {/* Email Input */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Nazwa użytkownika lub Email"
                  style={{ fontSize: '16px' }}
                  className={`w-full pl-12 pr-4 py-3 border-2 ${errors.email ? 'border-red-500' : 'border-gray-200'} rounded-xl focus:outline-none focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-400 bg-white/50`}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1 ml-1">{errors.email}</p>}
            </motion.div>

            {/* Password Input */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Hasło"
                  autoComplete="current-password"
                  style={{ fontSize: '16px' }}
                  className={`w-full pl-12 pr-12 py-3 border-2 ${errors.password ? 'border-red-500' : 'border-gray-200'} rounded-xl focus:outline-none focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-400 bg-white/50`}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={() => setShowPassword(v => !v)}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1 ml-1">{errors.password}</p>}
            </motion.div>

            {firebaseError && <p className="text-red-500 text-sm text-center">{firebaseError}</p>}

            {/* Remember Me & Forgot Password */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="flex items-center justify-between text-sm"
            >
              <label className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={handleRememberMeToggle}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                />
                <span className="ml-2 text-gray-600 group-hover:text-gray-800 transition-colors">Zapamiętaj mnie</span>
              </label>
              <Link href="/forgot-password" className="text-blue-600 hover:text-blue-700 font-medium transition-colors">
                Zapomniałeś hasła?
              </Link>
            </motion.div>

            {/* Login Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3.5 px-4 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {isSubmitting ? "Logowanie..." : "ZALOGUJ SIĘ"}
            </motion.button>
          </form>
          
          {/* Social Login - BEZ "Or continue with" */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.9 }}
            className="mt-6"
          >
            <Suspense fallback={<div className="h-12" />}>
              <SocialLoginButtons 
                onSuccess={handleSocialLoginSuccess}
                onError={(error) => {
                  console.error('Social login error:', error);
                  showNotification('error', error);
                }}
              />
            </Suspense>
          </motion.div>
          
          {/* Sign Up Link */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.1 }}
            className="mt-6 text-center"
          >
            <p className="text-sm text-gray-600">
              Nie masz konta?{" "}
              <Link href="/register" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                Zarejestruj się
              </Link>
            </p>
          </motion.div>
        </motion.div>
      </motion.div>
      
      {/* Right Side - 3D Globe Animation */}
      <motion.div 
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1a2a6c] via-[#0f1b4c] to-[#0a1238] items-center justify-center relative overflow-hidden"
      >
        {/* 3D Globe */}
        <div className="relative z-10 w-full h-full flex items-center justify-center">
          <Suspense fallback={
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-400"></div>
            </div>
          }>
            <RealisticGlobe />
          </Suspense>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-10 right-10 w-20 h-20 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-white to-blue-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
      </div>
    }>
      <Providers>
        <LoginPageContent />
      </Providers>
    </Suspense>
  );
}
