'use client';

import Link from "next/link";
import { useState, useEffect, useRef } from 'react';
import StudentRoute from '@/components/StudentRoute';
import ParentAccess from '@/components/ParentAccess';
import { useAuth } from '@/context/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import ThemeToggle from '@/components/ThemeToggle';
import CogitoLogo from '@/components/CogitoLogo';

interface Notification {
  id: string;
  type: 'grade' | 'event' | 'message';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  courseTitle?: string;
  action_url?: string;
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isParent = user?.role === 'parent';
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Pobierz powiadomienia dla ucznia
  useEffect(() => {
    console.log('🔔 Notification useEffect triggered, user:', user?.uid, 'role:', user?.role);
    
    const fetchNotifications = async () => {
      if (!user) {
        console.log('❌ Not fetching notifications - user is null/undefined');
        return;
      }
      
      if (user.role !== 'student') {
        console.log('❌ Not fetching notifications - user role is:', user.role, 'expected: student');
        return;
      }

      console.log('✅ Fetching notifications for student:', user.uid, user.email);

      try {
        const allNotifications: Notification[] = [];
        const eventIdsFromNotifications = new Set<string>(); // Śledzenie event_id
        const now = new Date();

        // 1. Pobierz powiadomienia z kolekcji notifications
        const notificationsRef = collection(db, 'notifications');
        const notificationsQuery = query(
          notificationsRef, 
          where('user_id', '==', user.uid)
        );
        console.log('📥 Querying notifications for user_id:', user.uid);
        const notificationsSnapshot = await getDocs(notificationsQuery);
        
        console.log('📬 Found notifications in DB:', notificationsSnapshot.size);
        
        // Przetwórz powiadomienia równolegle
        const notificationPromises = notificationsSnapshot.docs.map(async (notificationDoc) => {
          const notificationData = notificationDoc.data();
          const eventDate = notificationData.event_date ? new Date(notificationData.event_date) : null;
          
          if (notificationData.event_date && (!eventDate || isNaN(eventDate.getTime()))) {
            await deleteDoc(doc(db, 'notifications', notificationDoc.id));
            return null;
          }
          
          if (eventDate) {
            const sevenDaysAfterEvent = new Date(eventDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            if (sevenDaysAfterEvent < now) {
              await deleteDoc(doc(db, 'notifications', notificationDoc.id));
              return null;
            }
          }
          
          if (notificationData.event_id) {
            eventIdsFromNotifications.add(notificationData.event_id);
          }
          
          const notification: Notification = {
            id: notificationDoc.id,
            type: (notificationData.type || 'message') as 'grade' | 'event' | 'message',
            title: notificationData.title || 'Powiadomienie',
            message: notificationData.message || 'Masz nowe powiadomienie',
            timestamp: notificationData.timestamp || new Date().toISOString(),
            read: notificationData.read || false,
            courseTitle: notificationData.course_title,
            action_url: notificationData.action_url
          };
          return notification;
        });
        
        const processedNotifications = await Promise.all(notificationPromises);
        const validNotifications = processedNotifications.filter((notif): notif is Notification => notif !== null);
        allNotifications.push(...validNotifications);
        
        console.log('✅ Added', allNotifications.length, 'notifications from notifications collection');
        console.log('🔖 Event IDs from notifications:', Array.from(eventIdsFromNotifications));

        // 2. Pobierz eventy jako powiadomienia
        const eventsRef = collection(db, 'events');
        console.log('📅 Fetching events from DB...');
        const eventsSnapshot = await getDocs(eventsRef);
        
        console.log('📅 Found events in DB:', eventsSnapshot.size);
        
        // Przetwórz eventy równolegle
        const eventPromises = eventsSnapshot.docs
          .filter(eventDoc => !eventIdsFromNotifications.has(eventDoc.id))
          .map(async (eventDoc) => {
            const eventData = eventDoc.data();
            const isAssignedTo = eventData.assignedTo && eventData.assignedTo.includes(user.uid);
            const isInStudents = eventData.students && eventData.students.includes(user.uid);
            
            if (!isAssignedTo && !isInStudents) return null;
            
            const eventDateString = eventData.date || eventData.deadline;
            
            if (!eventDateString) return null;
            
            const eventDate = new Date(eventDateString);
            if (isNaN(eventDate.getTime())) return null;
            
            const sevenDaysAfterEvent = new Date(eventDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            if (sevenDaysAfterEvent < now) return null;
            
            const eventNotification: Notification = {
              id: `event-${eventDoc.id}`,
              type: 'event' as const,
              title: eventData.title || 'Nowe zadanie',
              message: eventData.description || 'Masz nowe zadanie do wykonania',
              timestamp: eventDateString,
              read: false,
              action_url: '/homelogin/student/calendar'
            };
            return eventNotification;
          });
          
          const processedEvents = await Promise.all(eventPromises);
          const validEvents = processedEvents.filter((event): event is Notification => event !== null);
          allNotifications.push(...validEvents);
        
        console.log('📅 Added', allNotifications.length - eventIdsFromNotifications.size, 'events after deduplication and filtering');

        // Sortuj po dacie malejąco i ogranicz do 15 najnowszych
        const sortedNotifications = allNotifications
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 15);

        console.log('📊 FINAL STATS:');
        console.log('  - Total notifications found:', allNotifications.length);
        console.log('  - After sorting/limiting:', sortedNotifications.length);
        console.log('  - Unread count:', sortedNotifications.filter(n => !n.read).length);
        console.log('📋 All notifications:', sortedNotifications);
        
        setNotifications(sortedNotifications);
        setUnreadCount(sortedNotifications.filter(n => !n.read).length);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    fetchNotifications();
    
    // Odświeżaj powiadomienia co 5 minut
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  // Obsługa kliknięć poza powiadomieniami
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showNotifications]);

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return (
    <StudentRoute>
      <ParentAccess>
        <div className="min-h-screen bg-[#F4F6FB] dark:bg-gray-900 flex flex-col transition-colors duration-200">
          {/* Minimalist Topbar */}
          <header className="w-full bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 flex items-center justify-between px-8 py-1 sticky top-0 z-50 h-14">
            {/* Logo and Dashboard link on the left */}
            <div className="flex items-center gap-3">
              <Link href="/homelogin" className="flex items-center gap-2">
                <CogitoLogo size={28} />
                <span className="text-[#4067EC] dark:text-blue-400 font-bold text-lg hover:underline">COGITO</span>
              </Link>
            </div>
            <nav className="flex-1 flex items-center justify-center gap-8">
              {!isParent && (
                <>
                  <Link href="#" className="text-sm text-gray-700 dark:text-gray-300 hover:text-[#4067EC] dark:hover:text-blue-400 font-medium transition-colors">Moje terminy</Link>
                  <Link href="/homelogin/group-chats" className="text-sm text-gray-700 dark:text-gray-300 hover:text-[#4067EC] dark:hover:text-blue-400 font-medium transition-colors">Czat grupowy</Link>
                  <Link href="#" className="text-sm text-gray-700 dark:text-gray-300 hover:text-[#4067EC] dark:hover:text-blue-400 font-medium transition-colors">Repozytorium/Manuale</Link>
                  <Link href="#" className="text-sm text-gray-700 dark:text-gray-300 hover:text-[#4067EC] dark:hover:text-blue-400 font-medium transition-colors">Warunki</Link>
                  <Link href="#" className="text-sm text-gray-700 dark:text-gray-300 hover:text-[#4067EC] dark:hover:text-blue-400 font-medium transition-colors">Digiteka - Cyfrowe Materiały Dydaktyczne</Link>
                  <Link href="#" className="text-sm text-gray-700 dark:text-gray-300 hover:text-[#4067EC] dark:hover:text-blue-400 font-medium transition-colors">Wsparcie</Link>
                </>
              )}
                              <Link href="/homelogin/my-courses" className="text-sm text-gray-700 dark:text-gray-300 hover:text-[#4067EC] dark:hover:text-blue-400 font-medium transition-colors">Moje kursy</Link>
              <Link href="/homelogin/student/calendar" className="text-sm text-gray-700 dark:text-gray-300 hover:text-[#4067EC] dark:hover:text-blue-400 font-medium transition-colors">Kalendarz</Link>
              <Link href="/homelogin/student/quizzes" className="text-sm text-gray-700 dark:text-gray-300 hover:text-[#4067EC] dark:hover:text-blue-400 font-medium transition-colors">Quizy</Link>
              <Link href="/homelogin/ankiety" className="text-sm text-gray-700 dark:text-gray-300 hover:text-[#4067EC] dark:hover:text-blue-400 font-medium transition-colors">Ankiety</Link>
              <Link href="/homelogin/student/grades" className="text-sm text-gray-700 dark:text-gray-300 hover:text-[#4067EC] dark:hover:text-blue-400 font-medium transition-colors">Dziennik</Link>
              <Link href="/homelogin/student/tutors" className="text-sm text-gray-700 dark:text-gray-300 hover:text-[#4067EC] dark:hover:text-blue-400 font-medium transition-colors">Tutors</Link>
            </nav>
            <div className="flex items-center gap-4 ml-4">
              {/* Notifications */}
              <div className="relative" ref={notificationRef}>
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-full hover:bg-[#F1F4FE] dark:hover:bg-gray-700 transition" 
                  aria-label="Powiadomienia"
                >
                  <svg className="w-6 h-6 text-[#4067EC] dark:text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 7.165 6 9.388 6 12v2.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown */}
                {showNotifications && (
                  <div className="absolute left-1/2 transform -translate-x-1/2 top-full mt-3 w-[420px] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-[#4067EC] to-[#5078fc] dark:from-blue-600 dark:to-blue-700 text-white px-5 py-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 7.165 6 9.388 6 12v2.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                          <h3 className="font-bold text-lg">Powiadomienia</h3>
                        </div>
                        {unreadCount > 0 && (
                          <span className="bg-white dark:bg-gray-800 text-[#4067EC] dark:text-blue-400 text-xs font-bold px-3 py-1 rounded-full">
                            {unreadCount} {unreadCount === 1 ? 'nowe' : 'nowych'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-[500px] overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notification) => {
                          const eventDate = notification.timestamp ? new Date(notification.timestamp) : null;
                          const isOverdue = eventDate && eventDate < new Date();
                          
                          return (
                            <div 
                              key={notification.id} 
                              className={`p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
                                !notification.read ? 'bg-blue-50/50 dark:bg-gray-700/50' : ''
                              }`}
                              onClick={() => {
                                if (notification.action_url) {
                                  window.location.href = notification.action_url;
                                }
                              }}
                            >
                              <div className="flex items-start gap-3">
                                {/* Icon */}
                                <div className={`flex-shrink-0 p-2.5 rounded-xl ${
                                  notification.type === 'grade' ? 'bg-green-100 dark:bg-green-900/30' : 
                                  notification.type === 'event' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700'
                                }`}>
                                  {notification.type === 'grade' ? (
                                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  ) : notification.type === 'event' ? (
                                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                    </svg>
                                  ) : (
                                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                    </svg>
                                  )}
                                </div>
                                
                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-snug">
                                      {notification.title}
                                    </h4>
                                    {!notification.read && (
                                      <span className="flex-shrink-0 w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full mt-1"></span>
                                    )}
                                  </div>
                                  
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                    {notification.message}
                                  </p>
                                  
                                  {/* Date and Status */}
                                  <div className="flex items-center gap-3 mt-2.5">
                                    <div className="flex items-center gap-1.5">
                                      <svg className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                      </svg>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                        {eventDate ? eventDate.toLocaleDateString('pl-PL', { 
                                          day: '2-digit', 
                                          month: 'short',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        }) : 'Niedawno'}
                                      </span>
                                    </div>
                                    
                                    {isOverdue && notification.type === 'event' && (
                                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                        Po terminie
                                      </span>
                                    )}
                                  </div>
                                  
                                  {notification.courseTitle && (
                                    <div className="mt-2">
                                      <span className="inline-block text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-md">
                                        📚 {notification.courseTitle}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-12 text-center">
                          <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                          <p className="text-gray-500 dark:text-gray-400 font-medium">Brak powiadomień</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Wszystkie powiadomienia zostały przeczytane</p>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
                        <Link 
                          href="/homelogin/student/calendar"
                          className="text-sm text-[#4067EC] dark:text-blue-400 hover:text-[#3155d4] dark:hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
                        >
                          Zobacz kalendarz
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </Link>
                        <button 
                          onClick={markAllAsRead}
                          className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 font-medium transition-colors"
                        >
                          Oznacz jako przeczytane
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Theme Toggle */}
              <ThemeToggle />
              
              {/* User avatar with initials */}
              <div className="w-9 h-9 rounded-full bg-[#4067EC] flex items-center justify-center text-white font-bold text-base">
                {user?.email?.substring(0, 2).toUpperCase() || 'U'}
              </div>
            </div>
          </header>
          <main className="flex-1 w-full max-w-full mx-auto">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </ParentAccess>
    </StudentRoute>
  );
} 