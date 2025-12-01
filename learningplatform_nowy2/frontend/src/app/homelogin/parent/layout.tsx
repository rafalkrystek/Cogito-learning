'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import ParentRoute from '@/components/ParentRoute';
import ThemeToggle from '@/components/ThemeToggle';
import {
  Calendar,
  BookOpen,
  BarChart3,
  Bell,
  Settings,
  LogOut,
  User,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  Menu,
  GraduationCap,
  MessageSquare
} from 'lucide-react';
import CogitoLogo from '@/components/CogitoLogo';
import { useRouter, usePathname } from 'next/navigation';

interface Student {
  id: string;
  name: string;
  class: string;
  avatar?: string;
}

interface Notification {
  id: string;
  type: 'grade' | 'assignment' | 'progress' | 'message' | 'event';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  courseTitle?: string;
  action_url?: string;
  gradeId?: string; // ID oceny dla powiadomień o ocenach
  messageId?: string; // ID wiadomości dla powiadomień o odpowiedziach
  teacherName?: string; // Imię nauczyciela
  event_id?: string; // ID wydarzenia dla powiadomień o wydarzeniach
  event_date?: string; // Data wydarzenia
  event_time?: string; // Czas wydarzenia
}

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Pobierz dane przypisanego ucznia
  useEffect(() => {
    const fetchStudentData = async () => {
      if (!user) return;

      try {
        // Importuj potrzebne funkcje Firebase
        const { collection, getDocs, query, where } = await import('firebase/firestore');
        const { db } = await import('@/config/firebase');
        
        // Znajdź przypisanego ucznia
        const parentStudentsRef = collection(db, 'parent_students');
        const parentStudentsQuery = query(parentStudentsRef, where('parent', '==', user.uid));
        const parentStudentsSnapshot = await getDocs(parentStudentsQuery);

        if (!parentStudentsSnapshot.empty) {
          const studentId = parentStudentsSnapshot.docs[0].data().student;
          
          // Pobierz dane ucznia
          const usersRef = collection(db, 'users');
          const studentQuery = query(usersRef, where('uid', '==', studentId));
          const studentSnapshot = await getDocs(studentQuery);
          
          if (!studentSnapshot.empty) {
            const studentData = studentSnapshot.docs[0].data();
            setSelectedStudent({
              id: studentId,
              name: studentData.displayName || studentData.email || 'Nieznany uczeń',
              class: studentData.class || 'Klasa nieznana',
              avatar: studentData.photoURL
            });
          }
        } else {
          // Fallback data jeśli nie ma przypisanego ucznia
          setSelectedStudent({
            id: '1',
            name: 'Brak przypisanego ucznia',
            class: '',
            avatar: undefined
          });
        }
      } catch (error) {
        console.error('Error fetching student data:', error);
        // Fallback data w przypadku błędu
        setSelectedStudent({
          id: '1',
          name: 'Anna Kowalska',
          class: 'Klasa 8A',
          avatar: undefined
        });
      }
    };

    fetchStudentData();
  }, [user]);

  // Sprawdź i ustaw custom claims dla rodzica
  useEffect(() => {
    const checkAndSetParentRole = async () => {
      if (!user) return;

      try {
        const { auth } = await import('@/config/firebase');
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        // Sprawdź token i custom claims
        const token = await currentUser.getIdTokenResult(true); // forceRefresh
        const tokenRole = token.claims.role;

        console.log('🔍 Parent token claims:', {
          role: tokenRole,
          email: token.claims.email,
          uid: token.claims.uid
        });

        if (tokenRole !== 'parent') {
          console.warn('⚠️ UWAGA: Token nie ma ustawionej roli "parent" w custom claims!');
          console.warn('⚠️ To może powodować problemy z uprawnieniami Firestore.');
          console.warn('⚠️ Próbuję ustawić custom claims automatycznie...');

          // Próba automatycznego ustawienia custom claims
          try {
            const response = await fetch('/api/set-parent-role-api', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ uid: user.uid })
            });

            if (response.ok) {
              console.log('✅ Custom claims ustawione dla rodzica! Odświeżam token...');
              await currentUser.getIdToken(true); // Odśwież token
              const newToken = await currentUser.getIdTokenResult(true);
              console.log('✅ Nowy token role:', newToken.claims.role);
            } else {
              const errorData = await response.json().catch(() => ({}));
              console.warn('⚠️ Nie udało się ustawić custom claims automatycznie:', errorData);
            }
          } catch (setRoleError) {
            console.warn('⚠️ Błąd podczas ustawiania custom claims:', setRoleError);
          }
        } else {
          console.log('✅ Parent ma poprawnie ustawioną rolę w tokenie');
        }
      } catch (tokenError) {
        console.error('❌ Błąd pobierania token claims:', tokenError);
      }
    };

    checkAndSetParentRole();
  }, [user]);

  // Pobierz powiadomienia dla rodzica
  const fetchNotifications = useCallback(async () => {
      if (!user || !selectedStudent) {
        console.log('🔔 DEBUG: fetchNotifications skipped - user:', !!user, 'selectedStudent:', !!selectedStudent);
        return;
      }

      console.log('🔔 DEBUG: ========== FETCHING NOTIFICATIONS ==========');
      console.log('🔔 DEBUG: User ID:', user.uid);
      console.log('🔔 DEBUG: Student ID:', selectedStudent.id);

      try {
        const { collection, getDocs, query, where, limit, doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('@/config/firebase');

        const allNotifications: Notification[] = [];

        // 1. Pobierz powiadomienia z kolekcji notifications dla rodzica
        const notificationsRef = collection(db, 'notifications');
        const notificationsQuery = query(
          notificationsRef, 
          where('user_id', '==', user.uid)
        );
        const notificationsSnapshot = await getDocs(notificationsQuery);
        
        console.log('🔔 DEBUG: Parent notifications found:', notificationsSnapshot.docs.length);
        notificationsSnapshot.docs.forEach(notificationDoc => {
          const notificationData = notificationDoc.data();
          const isRead = notificationData.read === true;
          
          console.log(`🔔 DEBUG: Parent notification ${notificationDoc.id}:`, {
            title: notificationData.title,
            read: notificationData.read,
            isRead: isRead,
            type: typeof notificationData.read
          });
          
          // Poprawne parsowanie timestamp
          let timestamp = new Date().toISOString();
          if (notificationData.timestamp) {
            if (typeof notificationData.timestamp === 'string') {
              timestamp = notificationData.timestamp;
            } else if (notificationData.timestamp?.toDate) {
              timestamp = notificationData.timestamp.toDate().toISOString();
            } else if (notificationData.timestamp instanceof Date) {
              timestamp = notificationData.timestamp.toISOString();
            }
          } else if (notificationData.created_at) {
            if (typeof notificationData.created_at === 'string') {
              timestamp = notificationData.created_at;
            } else if (notificationData.created_at?.toDate) {
              timestamp = notificationData.created_at.toDate().toISOString();
            } else if (notificationData.created_at instanceof Date) {
              timestamp = notificationData.created_at.toISOString();
            }
          }
          
          allNotifications.push({
            id: notificationDoc.id,
            type: notificationData.type || 'message',
            title: notificationData.title || 'Powiadomienie',
            message: notificationData.message || '',
            timestamp: timestamp,
            read: isRead, // Dokładne sprawdzenie boolean
            courseTitle: notificationData.courseTitle,
            action_url: notificationData.action_url === '/homelogin/student/calendar' 
              ? '/homelogin/parent' 
              : notificationData.action_url,
            messageId: notificationData.messageId,
            teacherName: notificationData.teacherName,
            event_id: notificationData.event_id,
            event_date: notificationData.event_date,
            event_time: notificationData.event_time
          });
        });

        // 2. Pobierz powiadomienia z kolekcji notifications dla ucznia (rodzic widzi powiadomienia dziecka)
        const studentNotificationsQuery = query(
          notificationsRef, 
          where('user_id', '==', selectedStudent.id)
        );
        const studentNotificationsSnapshot = await getDocs(studentNotificationsQuery);
        
        console.log('🔔 DEBUG: Student notifications found:', studentNotificationsSnapshot.docs.length);
        studentNotificationsSnapshot.docs.forEach(notificationDoc => {
          const notificationData = notificationDoc.data();
          const isRead = notificationData.read === true;
          
          console.log(`🔔 DEBUG: Student notification ${notificationDoc.id}:`, {
            title: notificationData.title,
            read: notificationData.read,
            isRead: isRead,
            type: typeof notificationData.read
          });
          
          // Sprawdź czy powiadomienie już nie istnieje
          if (!allNotifications.find(n => n.id === notificationDoc.id)) {
            // Poprawne parsowanie timestamp
            let timestamp = new Date().toISOString();
            if (notificationData.timestamp) {
              if (typeof notificationData.timestamp === 'string') {
                timestamp = notificationData.timestamp;
              } else if (notificationData.timestamp?.toDate) {
                timestamp = notificationData.timestamp.toDate().toISOString();
              } else if (notificationData.timestamp instanceof Date) {
                timestamp = notificationData.timestamp.toISOString();
              }
            } else if (notificationData.created_at) {
              if (typeof notificationData.created_at === 'string') {
                timestamp = notificationData.created_at;
              } else if (notificationData.created_at?.toDate) {
                timestamp = notificationData.created_at.toDate().toISOString();
              } else if (notificationData.created_at instanceof Date) {
                timestamp = notificationData.created_at.toISOString();
              }
            }
            
            allNotifications.push({
              id: notificationDoc.id,
              type: notificationData.type || 'message',
              title: notificationData.title || 'Powiadomienie',
              message: notificationData.message || '',
              timestamp: timestamp,
              read: isRead, // Dokładne sprawdzenie boolean
              courseTitle: notificationData.courseTitle,
              action_url: notificationData.action_url === '/homelogin/student/calendar' 
              ? '/homelogin/parent' 
              : notificationData.action_url,
              messageId: notificationData.messageId,
              teacherName: notificationData.teacherName,
              event_id: notificationData.event_id,
              event_date: notificationData.event_date,
              event_time: notificationData.event_time
            });
          }
        });

        // 3. Sprawdź nowe odpowiedzi w wiadomościach (gdy nauczyciel odpowiedział)
        const messagesRef = collection(db, 'messages');
        // Pobierz wszystkie wiadomości dla rodzica (nie tylko nieprzeczytane)
        const receivedMessagesQuery = query(
          messagesRef,
          where('to', '==', user.uid)
        );
        const receivedMessagesSnapshot = await getDocs(receivedMessagesQuery);
        
        // Pobierz informacje o nauczycielach którzy odpowiedzieli
        const teacherIds = [...new Set(receivedMessagesSnapshot.docs.map(doc => doc.data().from))];
        const teacherInfoMap = new Map<string, string>();
        
        for (const teacherId of teacherIds) {
          try {
            const teacherDoc = await getDoc(doc(db, 'users', teacherId));
            if (teacherDoc.exists()) {
              const teacherData = teacherDoc.data();
              teacherInfoMap.set(teacherId, teacherData.displayName || teacherData.email || 'Nauczyciel');
            }
          } catch (error) {
            console.error(`Error fetching teacher ${teacherId}:`, error);
          }
        }
        
        // Utwórz powiadomienia o odpowiedziach - sprawdź stan przeczytania z wiadomości
        receivedMessagesSnapshot.docs.forEach(messageDoc => {
          const messageData = messageDoc.data();
          
          // Sprawdź czy to odpowiedź od nauczyciela (wiadomość od kogoś innego niż rodzic)
          if (messageData.from !== user.uid) {
            const teacherName = teacherInfoMap.get(messageData.from) || 'Nauczyciel';
            // Sprawdź czy wiadomość jest przeczytana
            const isMessageRead = messageData.read === true;
            
            // Sprawdź czy powiadomienie już nie istnieje
            if (!allNotifications.find(n => n.id === `message_${messageDoc.id}`)) {
              // Parsuj timestamp wiadomości
              let messageTimestamp = new Date().toISOString();
              if (messageData.timestamp) {
                if (typeof messageData.timestamp === 'string') {
                  messageTimestamp = messageData.timestamp;
                } else if (messageData.timestamp?.toDate) {
                  messageTimestamp = messageData.timestamp.toDate().toISOString();
                } else if (messageData.timestamp instanceof Date) {
                  messageTimestamp = messageData.timestamp.toISOString();
                }
              }
              
              allNotifications.push({
                id: `message_${messageDoc.id}`,
                type: 'message',
                title: 'Nowa odpowiedź od nauczyciela',
                message: `${teacherName} odpowiedział na Twoją wiadomość: ${messageData.content?.substring(0, 50) || ''}${messageData.content?.length > 50 ? '...' : ''}`,
                timestamp: messageTimestamp,
                read: isMessageRead, // Użyj stanu przeczytania z wiadomości
                action_url: '/homelogin/parent/messages',
                messageId: messageDoc.id,
                teacherName: teacherName
              });
            }
          }
        });

        // 4. Pobierz ostatnie oceny jako powiadomienia
        const gradesRef = collection(db, 'grades');
        let gradesQuery = query(gradesRef, where('studentId', '==', selectedStudent.id), limit(20));
        let gradesSnapshot = await getDocs(gradesQuery);
        
        // Spróbuj alternatywne nazwy pól jeśli nie znaleziono
        if (gradesSnapshot.empty) {
          gradesQuery = query(gradesRef, where('user_id', '==', selectedStudent.id), limit(20));
          gradesSnapshot = await getDocs(gradesQuery);
        }
        if (gradesSnapshot.empty) {
          gradesQuery = query(gradesRef, where('student', '==', selectedStudent.id), limit(20));
          gradesSnapshot = await getDocs(gradesQuery);
        }

        // Sprawdź które oceny są już oznaczone jako przeczytane
        const readGradesRef = doc(db, 'notification_read_status', user.uid);
        const readGradesDoc = await getDoc(readGradesRef);
        const readGrades = readGradesDoc.exists() ? (readGradesDoc.data().readGrades || []) : [];
        console.log('🔔 DEBUG: Read grades from notification_read_status:', readGrades.length, readGrades);
        
        // Zbierz unikalne course_id
        const courseIds = new Set<string>();
        gradesSnapshot.docs.forEach(gradeDoc => {
          const gradeData = gradeDoc.data();
          if (gradeData.course_id) courseIds.add(gradeData.course_id);
        });
        
        // Pobierz wszystkie kursy jednocześnie
        const courseQueries = Array.from(courseIds).slice(0, 20).map(courseId => 
          getDoc(doc(db, 'courses', courseId))
        );
        const courseDocs = await Promise.all(courseQueries);
        const coursesMap = new Map<string, string>();
        courseDocs.forEach(doc => {
          if (doc.exists()) {
            coursesMap.set(doc.id, doc.data().title || 'Nieznany kurs');
          }
        });
        
        // Przetwórz oceny - sprawdź czy są już przeczytane
        console.log('🔔 DEBUG: Grades found:', gradesSnapshot.docs.length);
        gradesSnapshot.docs.forEach(gradeDoc => {
          const gradeData = gradeDoc.data();
          const courseTitle = gradeData.course_id ? (coursesMap.get(gradeData.course_id) || 'Nieznany kurs') : 'Nieznany kurs';
          const gradeValue = gradeData.value || gradeData.grade || 0;
          const gradeDate = gradeData.date || gradeData.graded_at;
          const isRead = readGrades.includes(gradeDoc.id);
          
          console.log(`🔔 DEBUG: Grade ${gradeDoc.id}:`, {
            value: gradeValue,
            course: courseTitle,
            isRead: isRead,
            inReadGrades: readGrades.includes(gradeDoc.id)
          });
          
          // Sprawdź czy powiadomienie o tej ocenie już nie istnieje
          if (!allNotifications.find(n => n.id === `grade_${gradeDoc.id}`)) {
            allNotifications.push({
              id: `grade_${gradeDoc.id}`,
              type: 'grade',
              title: 'Nowa ocena',
              message: `Otrzymano ocenę ${gradeValue} z przedmiotu ${courseTitle}`,
              timestamp: gradeDate || new Date().toISOString(),
              read: isRead,
              courseTitle,
              gradeId: gradeDoc.id // Zapisz ID oceny do późniejszego oznaczenia jako przeczytana
            });
          }
        });

        // Usuń duplikaty (na podstawie ID)
        const uniqueNotifications = allNotifications.reduce((acc, current) => {
          const existing = acc.find(n => n.id === current.id);
          if (!existing) {
            acc.push(current);
          } else {
            // Jeśli istnieje, użyj tego z `read: true` jeśli którykolwiek ma `read: true`
            if (current.read && !existing.read) {
              const index = acc.indexOf(existing);
              acc[index] = current;
            }
          }
          return acc;
        }, [] as Notification[]);

        // Sortuj i ogranicz do 20 najnowszych
        const sortedNotifications = uniqueNotifications
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 20);

        console.log('🔔 DEBUG: ========== NOTIFICATION SUMMARY ==========');
        console.log('🔔 DEBUG: Total notifications:', sortedNotifications.length);
        console.log('🔔 DEBUG: Unread notifications:', sortedNotifications.filter(n => !n.read).length);
        console.log('🔔 DEBUG: Read notifications:', sortedNotifications.filter(n => n.read).length);
        console.log('🔔 DEBUG: Unread details:', sortedNotifications.filter(n => !n.read).map(n => ({
          id: n.id,
          title: n.title,
          type: n.type,
          read: n.read
        })));
        console.log('🔔 DEBUG: ===========================================');

        setNotifications(sortedNotifications);
        const unreadCount = sortedNotifications.filter(n => !n.read).length;
        setUnreadCount(unreadCount);
        console.log('🔔 DEBUG: Setting unread count to:', unreadCount);

      } catch (error) {
        console.error('Error fetching notifications:', error);
        setNotifications([]);
        setUnreadCount(0);
      }
    }, [user, selectedStudent]);

  // Uruchom fetchNotifications przy załadowaniu i odświeżaj co 30 sekund
  useEffect(() => {
    fetchNotifications();
    
    // Odświeżaj powiadomienia co 30 sekund
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Zamknij powiadomienia po kliknięciu poza nimi
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const markNotificationAsRead = async (notificationId: string) => {
    if (!user) return;
    
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification || notification.read) {
      console.log('⚠️ Notification already read or not found:', notificationId);
      return;
    }

    console.log('✅ Marking notification as read:', notificationId, notification.type);

    try {
      const { doc, updateDoc, setDoc, getDoc } = await import('firebase/firestore');
      const { db } = await import('@/config/firebase');

      // Jeśli to powiadomienie z kolekcji notifications
      if (notificationId.startsWith('grade_')) {
        // To powiadomienie o ocenie - zapisz w notification_read_status
        const readStatusRef = doc(db, 'notification_read_status', user.uid);
        const readStatusDoc = await getDoc(readStatusRef);
        const currentReadGrades = readStatusDoc.exists() ? (readStatusDoc.data().readGrades || []) : [];
        
        if (notification.gradeId && !currentReadGrades.includes(notification.gradeId)) {
          await setDoc(readStatusRef, {
            readGrades: [...currentReadGrades, notification.gradeId],
            lastUpdated: new Date().toISOString()
          }, { merge: true });
          console.log('✅ Grade notification marked as read in notification_read_status');
        }
      } else if (notificationId.startsWith('message_')) {
        // To powiadomienie o wiadomości - zaktualizuj wiadomość
        const messageId = notificationId.replace('message_', '');
        const messageRef = doc(db, 'messages', messageId);
        await updateDoc(messageRef, {
          read: true,
          readAt: new Date().toISOString()
        });
        console.log('✅ Message notification marked as read');
      } else {
        // To powiadomienie z kolekcji notifications - zaktualizuj bezpośrednio
        try {
          const notificationRef = doc(db, 'notifications', notificationId);
          const notificationDoc = await getDoc(notificationRef);
          if (notificationDoc.exists()) {
            await updateDoc(notificationRef, {
              read: true,
              readAt: new Date().toISOString()
            });
            console.log('✅ Notification marked as read in Firestore:', notificationId);
          } else {
            console.log('⚠️ Notification document not found:', notificationId);
          }
        } catch (error) {
          console.error('❌ Error updating notification:', error);
        }
      }

      // Aktualizuj stan lokalny
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, read: true }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // Aktualizuj stan lokalny nawet jeśli zapis się nie powiódł
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, read: true }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    
    console.log('✅ Marking all notifications as read...');
    
    try {
      const { doc, updateDoc, setDoc, collection, getDocs, query, where } = await import('firebase/firestore');
      const { db } = await import('@/config/firebase');

      const updatePromises: Promise<any>[] = [];

      // 1. Oznacz wszystkie powiadomienia z kolekcji notifications dla rodzica
      const notificationsRef = collection(db, 'notifications');
      const parentNotificationsQuery = query(notificationsRef, where('user_id', '==', user.uid));
      const parentNotificationsSnapshot = await getDocs(parentNotificationsQuery);
      
      parentNotificationsSnapshot.docs.forEach(notificationDoc => {
        const data = notificationDoc.data();
        if (data.read !== true) {
          updatePromises.push(
            updateDoc(notificationDoc.ref, {
              read: true,
              readAt: new Date().toISOString()
            })
          );
        }
      });

      // 2. Oznacz wszystkie powiadomienia z kolekcji notifications dla ucznia
      if (selectedStudent) {
        const studentNotificationsQuery = query(notificationsRef, where('user_id', '==', selectedStudent.id));
        const studentNotificationsSnapshot = await getDocs(studentNotificationsQuery);
        
        studentNotificationsSnapshot.docs.forEach(notificationDoc => {
          const data = notificationDoc.data();
          if (data.read !== true) {
            updatePromises.push(
              updateDoc(notificationDoc.ref, {
                read: true,
                readAt: new Date().toISOString()
              })
            );
          }
        });
      }

      // 3. Oznacz wszystkie wiadomości jako przeczytane
      const messagesRef = collection(db, 'messages');
      const receivedMessagesQuery = query(
        messagesRef,
        where('to', '==', user.uid),
        where('read', '==', false)
      );
      const receivedMessagesSnapshot = await getDocs(receivedMessagesQuery);
      
      receivedMessagesSnapshot.docs.forEach(messageDoc => {
        updatePromises.push(
          updateDoc(messageDoc.ref, {
            read: true,
            readAt: new Date().toISOString()
          })
        );
      });

      // 4. Oznacz wszystkie oceny jako przeczytane
      const readStatusRef = doc(db, 'notification_read_status', user.uid);
      const allGradeIds = notifications
        .filter(n => n.gradeId)
        .map(n => n.gradeId!)
        .filter((id, index, self) => self.indexOf(id) === index);
      
      if (allGradeIds.length > 0) {
        updatePromises.push(
          setDoc(readStatusRef, {
            readGrades: allGradeIds,
            lastUpdated: new Date().toISOString()
          }, { merge: true })
        );
      }

      // Wykonaj wszystkie aktualizacje równolegle z obsługą błędów
      console.log('🔔 DEBUG: markAllAsRead - updating', updatePromises.length, 'documents');
      const results = await Promise.allSettled(updatePromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (failed > 0) {
        console.error('❌ markAllAsRead - some updates failed:', failed);
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`❌ Failed update ${index}:`, result.reason);
          }
        });
      }
      
      console.log('✅ All notifications marked as read in Firestore:', successful, 'successful,', failed, 'failed');

      // Aktualizuj stan lokalny
      setNotifications(prev => {
        const updated = prev.map(n => ({ ...n, read: true }));
        console.log('🔔 DEBUG: markAllAsRead - local state updated, all notifications marked as read');
        return updated;
      });
      setUnreadCount(0);
      
      console.log('✅ Local state updated - unread count set to 0');
      
      // Odśwież powiadomienia po 500ms, aby upewnić się, że są poprawnie odczytane z Firestore
      setTimeout(() => {
        console.log('🔔 DEBUG: Refreshing notifications after markAllAsRead...');
        fetchNotifications();
      }, 500);
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
      // Aktualizuj stan lokalny nawet jeśli zapis się nie powiódł
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'grade':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'assignment':
        return <BookOpen className="w-4 h-4 text-blue-600" />;
      case 'progress':
        return <BarChart3 className="w-4 h-4 text-purple-600" />;
      case 'message':
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'event':
        return <Calendar className="w-4 h-4 text-indigo-600" />;
      default:
        return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      const diffInMinutes = diffInMs / (1000 * 60);
      const diffInHours = diffInMinutes / 60;
      const diffInDays = diffInHours / 24;
      
      if (diffInMinutes < 1) {
        return 'Teraz';
      } else if (diffInMinutes < 60) {
        return `${Math.floor(diffInMinutes)} min temu`;
      } else if (diffInHours < 24) {
        return `${Math.floor(diffInHours)}h temu`;
      } else if (diffInDays < 7) {
        return `${Math.floor(diffInDays)} dni temu`;
      } else {
        return date.toLocaleDateString('pl-PL', { 
          day: '2-digit', 
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }).replace(/\./g, '/');
      }
    } catch (error) {
      console.error('Error formatting timestamp:', error, timestamp);
      return 'Nieznana data';
    }
  };

  const navigationItems = [
    { 
      id: 'plan', 
      label: 'Plan Zajęć', 
      icon: Calendar, 
      href: '/homelogin/parent',
      active: pathname === '/homelogin/parent'
    },
    { 
      id: 'courses', 
      label: 'Kursy Dziecka', 
      icon: BookOpen, 
      href: '/homelogin/parent/courses',
      active: pathname === '/homelogin/parent/courses'
    },
    { 
      id: 'grades', 
      label: 'Dziennik', 
      icon: GraduationCap, 
      href: '/homelogin/parent/grades',
      active: pathname === '/homelogin/parent/grades'
    },
    { 
      id: 'stats', 
      label: 'Statystyki', 
      icon: BarChart3, 
      href: '/homelogin/parent/stats',
      active: pathname === '/homelogin/parent/stats'
    },
    { 
      id: 'messages', 
      label: 'Wiadomości', 
      icon: MessageSquare, 
      href: '/homelogin/parent/messages',
      active: pathname === '/homelogin/parent/messages'
    },
  ];

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleNavigation = (href: string) => {
    router.push(href);
    setSidebarOpen(false); // Zamknij sidebar na mobile po nawigacji
  };

  return (
    <ParentRoute>
      <div className="flex min-h-screen bg-gray-50">
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-gray-200 shadow-sm">
        <div className="flex flex-col flex-1">
          {/* Logo */}
          <div className="flex items-center h-16 px-6 border-b border-gray-200">
            <CogitoLogo size={27} className="text-blue-600" />
            <span className="ml-2 text-base font-semibold text-gray-900">Cogito</span>
          </div>

          {/* Child Info */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-semibold text-sm">
                  {selectedStudent?.name.split(' ').map(n => n[0]).join('') || 'AK'}
                </span>
              </div>
              <div>
                <p className="font-medium text-gray-900">{selectedStudent?.name || 'Anna Kowalska'}</p>
                <p className="text-sm text-gray-500">{selectedStudent?.class || 'Klasa 8A'}</p>
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
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Bottom Actions */}
          <div className="p-4 border-t border-gray-200 space-y-2">
            <button 
              onClick={() => handleNavigation('/homelogin/parent/settings')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors ${
                pathname === '/homelogin/parent/settings'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Settings className="h-4 w-4" />
              Ustawienia
            </button>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Wyloguj
            </button>
          </div>
        </div>
      </div>

        {/* Mobile Sidebar */}
        <div className={`lg:hidden fixed inset-0 z-50 ${sidebarOpen ? '' : 'pointer-events-none'}`}>
          {/* Backdrop */}
          <div 
            className={`fixed inset-0 bg-gray-600 transition-opacity ${
              sidebarOpen ? 'opacity-75' : 'opacity-0'
            }`}
            onClick={() => setSidebarOpen(false)}
          />

          {/* Sidebar */}
          <div className={`fixed inset-y-0 left-0 w-64 bg-white transform transition-transform ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}>
            <div className="flex flex-col h-full">
              {/* Mobile Header */}
              <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
                <div className="flex items-center">
                  <CogitoLogo size={27} className="text-blue-600" />
                  <span className="ml-2 text-base font-semibold text-gray-900">Cogito</span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 text-gray-600 hover:text-gray-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Child Info */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-sm">
                      {selectedStudent?.name.split(' ').map(n => n[0]).join('') || 'AK'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedStudent?.name || 'Anna Kowalska'}</p>
                    <p className="text-sm text-gray-500">{selectedStudent?.class || 'Klasa 8A'}</p>
                  </div>
                </div>
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
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>

              {/* Mobile Bottom Actions */}
              <div className="p-4 border-t border-gray-200 space-y-2">
                <button 
                  onClick={() => handleNavigation('/homelogin/parent/settings')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors ${
                    pathname === '/homelogin/parent/settings'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  Ustawienia
                </button>
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Wyloguj
                </button>
              </div>
            </div>
          </div>
        </div>

      {/* Main Content */}
      <div className="lg:pl-64 flex-1">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">Panel Rodzica</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <ThemeToggle />
            
            {/* Notifications Dropdown */}
            <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Menu */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900">Powiadomienia</h3>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Oznacz wszystkie jako przeczytane
                        </button>
                      )}
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Notifications List */}
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">
                        <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p>Brak powiadomień</p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          onClick={async () => {
                            await markNotificationAsRead(notification.id);
                            if (notification.action_url) {
                              setShowNotifications(false);
                              router.push(notification.action_url);
                            }
                          }}
                          className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                            !notification.read ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1">
                              {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className={`text-sm font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                                  {notification.title}
                                </h4>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatTimestamp(notification.timestamp)}
                                  </span>
                                  {!notification.read && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                {notification.message}
                              </p>
                              {notification.event_date && notification.event_time && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                                  <Calendar className="w-3 h-3" />
                                  <span>{notification.event_date} {notification.event_time}</span>
                                </div>
                              )}
                              {notification.courseTitle && (
                                <span className="inline-block mt-2 px-2 py-1 bg-gray-100 text-xs text-gray-600 rounded">
                                  {notification.courseTitle}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer */}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 rounded-lg p-2 transition-colors">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              <span className="hidden md:inline text-gray-700 font-medium">
                {(user as any)?.displayName || user?.email || 'Maria Kowalska'}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {children}
        </main>
        </div>
      </div>
    </ParentRoute>
  );
}
