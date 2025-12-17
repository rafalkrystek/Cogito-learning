"use client";
import React from "react";
import TeacherRoute from '@/components/TeacherRoute';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import {
  BookOpen,
  Users,
  Calendar,
  ClipboardList,
  MessageSquare,
  BarChart3,
  User,
  LogOut,
  Menu,
  X,
  Bot,
  School,
  Clock,
  Mail
} from 'lucide-react';
import CogitoLogo from '@/components/CogitoLogo';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = user?.role === 'admin';

  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Błąd podczas wylogowywania:', error);
    }
  };

  const handleNavigation = (href: string) => {
    router.push(href);
    setSidebarOpen(false); // Zamknij sidebar na mobile po nawigacji
  };

  const navigationItems = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: BarChart3, 
      href: '/homelogin/teacher',
      active: pathname === '/homelogin/teacher'
    },
    { 
      id: 'courses', 
      label: isAdmin ? 'Wszystkie kursy' : 'Moje kursy', 
      icon: BookOpen, 
      href: '/homelogin/teacher/courses',
      active: pathname?.startsWith('/homelogin/teacher/courses') || false
    },
    { 
      id: 'students', 
      label: 'Lista uczniów', 
      icon: Users, 
      href: '/homelogin/teacher/students',
      active: pathname === '/homelogin/teacher/students'
    },
    { 
      id: 'classes', 
      label: 'Zarządzanie klasami', 
      icon: School, 
      href: '/homelogin/teacher/classes',
      active: pathname === '/homelogin/teacher/classes'
    },
    { 
      id: 'schedule', 
      label: 'Plan lekcji', 
      icon: Clock, 
      href: '/homelogin/teacher/schedule',
      active: pathname === '/homelogin/teacher/schedule'
    },
    { 
      id: 'grades', 
      label: 'Dziennik ocen', 
      icon: ClipboardList, 
      href: '/homelogin/teacher/grades',
      active: pathname === '/homelogin/teacher/grades'
    },
    { 
      id: 'quizzes', 
      label: 'Zarządzanie quizami', 
      icon: ClipboardList, 
      href: '/homelogin/teacher/quizzes',
      active: pathname === '/homelogin/teacher/quizzes'
    },
    { 
      id: 'surveys', 
      label: 'Ankiety', 
      icon: BarChart3, 
      href: '/homelogin/teacher/surveys',
      active: pathname === '/homelogin/teacher/surveys'
    },
    { 
      id: 'calendar', 
      label: 'Kalendarz', 
      icon: Calendar, 
      href: '/homelogin/teacher/calendar',
      active: pathname === '/homelogin/teacher/calendar'
    },
    { 
      id: 'chat', 
      label: 'Czat grupowy', 
      icon: MessageSquare, 
      href: '/homelogin/teacher/group-chats',
      active: pathname === '/homelogin/teacher/group-chats'
    },
    { 
      id: 'messages', 
      label: 'Wiadomości od rodziców', 
      icon: Mail, 
      href: '/homelogin/teacher/messages',
      active: pathname === '/homelogin/teacher/messages'
    },
    { 
      id: 'ai-help', 
      label: 'Pomoc AI', 
      icon: Bot, 
      href: '/homelogin/teacher/ai-help',
      active: pathname === '/homelogin/teacher/ai-help'
    },
    { 
      id: 'profile', 
      label: 'Mój profil', 
      icon: User, 
      href: '/homelogin/teacher/profile',
      active: pathname === '/homelogin/teacher/profile'
    },
  ];
  
  return (
    <TeacherRoute>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 w-full max-w-none transition-colors duration-200 overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex flex-col flex-1">
            {/* Logo */}
            <div className="flex items-center h-16 px-6 border-b border-gray-200 dark:border-gray-700">
              <CogitoLogo size={27} className="text-blue-600 dark:text-blue-400" />
              <span className="ml-2 text-base font-semibold text-gray-900 dark:text-gray-100">Cogito</span>
            </div>

            {/* Teacher Info */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">
                    {(user as any)?.displayName?.split(' ').map((n: string) => n[0]).join('') || 
                     user?.email?.substring(0, 2).toUpperCase() || 'NT'}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {(user as any)?.displayName || user?.email || 'Nauczyciel'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {isAdmin ? 'Administrator' : 'Nauczyciel'}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.href)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors ${
                      item.active
                        ? 'bg-blue-600 dark:bg-blue-600 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">

              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Wyloguj
              </button>
            </div>
          </div>
        </div>

        {/* Mobile sidebar */}
        <div className={`lg:hidden fixed inset-0 z-50 ${sidebarOpen ? '' : 'pointer-events-none'}`}>
          {/* Backdrop */}
          <div 
            className={`fixed inset-0 bg-gray-600 dark:bg-gray-900 transition-opacity ${
              sidebarOpen ? 'opacity-75' : 'opacity-0'
            }`}
            onClick={() => setSidebarOpen(false)}
          />

          {/* Sidebar */}
          <div className={`fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 transform transition-transform ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}>
            <div className="flex flex-col h-full">
              {/* Mobile Header */}
              <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <CogitoLogo size={27} className="text-blue-600 dark:text-blue-400" />
                  <span className="ml-2 text-base font-semibold text-gray-900 dark:text-gray-100">Cogito</span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Mobile Navigation */}
              <nav className="flex-1 px-4 py-6 space-y-2">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigation(item.href)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors ${
                        item.active
                          ? 'bg-blue-600 dark:bg-blue-600 text-white'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>

              {/* Mobile Bottom Actions */}
              <div 
                className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2"
                style={{ 
                  paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))'
                }}
              >
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Wyloguj
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:pl-64 flex-1 w-full max-w-full flex flex-col overflow-x-hidden" style={{ maxWidth: '100vw' }}>
          {/* Header */}
          <header 
            className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-16 flex items-center justify-between px-6 shadow-sm flex-shrink-0 transition-colors duration-200"
            style={{ 
              paddingTop: 'env(safe-area-inset-top)',
              minHeight: 'calc(4rem + env(safe-area-inset-top))'
            }}
          >
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {isAdmin ? 'Panel Administratora' : 'Panel Nauczyciela'}
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <ThemeToggle />
              <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg p-2 transition-colors">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="hidden md:inline text-gray-700 dark:text-gray-300 font-medium">
                  {(user as any)?.displayName || user?.email || 'Nauczyciel'}
                </span>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 flex flex-col min-h-0 overflow-x-hidden w-full max-w-full">
            {children}
          </main>
        </div>
      </div>


    </TeacherRoute>
  );
} 