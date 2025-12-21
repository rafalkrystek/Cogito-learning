'use client';

// Force dynamic rendering to prevent SSR issues with client-side hooks
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from '@/context/AuthContext';
import { MessageSquare, Users, Clock, Send, Plus, FileText, Download } from 'lucide-react';
import { db } from '@/config/firebase';
import { collection, query, where, onSnapshot, getDocs, addDoc, serverTimestamp, orderBy, limit, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { measureAsync } from '@/utils/perf';

// Cache helpers
const CACHE_TTL_MS = 60 * 1000; // 60s

function getSessionCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { timestamp: number; data: T };
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function setSessionCache<T>(key: string, data: T) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    // Ignore storage errors
  }
}

// Helper to chunk array for Firestore 'in' queries (max 10 items)
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
// import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

interface GroupChat {
  id: string;
  name: string;
  description?: string;
  participants: string[];
  participantEmails: string[]; // Dodaję emaile uczestników
  createdBy: string;
  createdAt: { seconds: number } | null;
  lastMessage?: {
    text: string;
    senderId: string;
    senderName: string;
    senderEmail: string; // Dodaję email nadawcy
    createdAt: { seconds: number } | null;
  };
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderEmail: string; // Dodaję email nadawcy
  createdAt: { seconds: number } | null;
  fileUrl?: string;
  fileData?: string; // Base64 data
  fileName?: string;
  fileType?: string;
  fileSize?: number;
}

interface User {
  uid: string;
  email: string;
  displayName?: string;
  role: string;
}

interface Class {
  id: string;
  name: string;
  description?: string;
  grade_level: number;
  subject?: string;
  teacher_id: string;
  teacher_email: string;
  students: string[];
  is_active: boolean;
  academic_year: string;
}

export default function GroupChatsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<GroupChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<GroupChat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showCreateChat, setShowCreateChat] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [newChatDescription, setNewChatDescription] = useState('');
  const [availableStudents, setAvailableStudents] = useState<User[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'messages' | 'files'>('messages');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [availableClasses, setAvailableClasses] = useState<Class[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const chatsPerPage = typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 20;

  // Pobierz czaty grupowe nauczyciela
  useEffect(() => {
    if (!user) return;

    const chatsQuery = query(
      collection(db, 'groupChats'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
      const chatsData: GroupChat[] = [];
      
      // Pobierz wszystkie dane równolegle zamiast w pętli
      const chatPromises = snapshot.docs.map(async (chatDoc) => {
        const chatData = chatDoc.data();
        
        // Pobierz emaile uczestników
        let participantEmails: string[] = [];
        if (chatData.participants && chatData.participants.length > 0) {
          try {
            const limitedParticipants = chatData.participants.slice(0, 10);
            if (limitedParticipants.length > 0) {
              const usersQuery = query(
                collection(db, 'users'),
                where('uid', 'in', limitedParticipants)
              );
              const usersSnapshot = await getDocs(usersQuery);
              participantEmails = usersSnapshot.docs
                .map(userDoc => userDoc.data().email)
                .filter(Boolean);
            }
          } catch (error) {
            console.error('Error fetching participant emails:', error);
            if (user.email) participantEmails.push(user.email);
          }
        }
        
        // Pobierz ostatnią wiadomość
        const messagesQuery = query(
          collection(db, 'groupChats', chatDoc.id, 'messages'),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
        const messagesSnapshot = await getDocs(messagesQuery);
        let lastMessage = undefined;
        
        if (!messagesSnapshot.empty) {
          const lastMsgData = messagesSnapshot.docs[0].data();
          lastMessage = {
            text: lastMsgData.text || '',
            senderId: lastMsgData.senderId || '',
            senderName: lastMsgData.senderName || 'Nieznany',
            senderEmail: lastMsgData.senderEmail || '',
            createdAt: lastMsgData.createdAt
          };
        }

        return {
          id: chatDoc.id,
          name: chatData.name || 'Czat bez nazwy',
          description: chatData.description || '',
          participants: chatData.participants || [],
          participantEmails: participantEmails,
          createdBy: chatData.createdBy || '',
          createdAt: chatData.createdAt,
          lastMessage
        };
      });
      
      const chats = await Promise.all(chatPromises);
      chatsData.push(...chats);
      
      // Sortuj czaty po ostatniej wiadomości
      chatsData.sort((a, b) => {
        if (!a.lastMessage && !b.lastMessage) return 0;
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        if (!a.lastMessage.createdAt || !b.lastMessage.createdAt) return 0;
        return b.lastMessage.createdAt.seconds - a.lastMessage.createdAt.seconds;
      });
      
      setChats(chatsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch students and classes with caching and optimization
  const fetchStudentsAndClasses = useCallback(async () => {
    if (!user?.uid || !user?.email) return;
    
    try {
      await measureAsync('TeacherGroupChats:fetchStudentsAndClasses', async () => {
        // Check cache
        const cacheKey = `teacher_group_chats_data_${user.uid}`;
        const cached = getSessionCache<{ classes: Class[]; students: User[] }>(cacheKey);
        
        if (cached) {
          setAvailableClasses(cached.classes);
          setAvailableStudents(cached.students);
          return;
        }

        // Fetch classes and courses in parallel
        const [classesSnapshot, createdBySnapshot, teacherEmailSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'classes'), where('is_active', '==', true), limit(50))),
          getDocs(query(collection(db, 'courses'), where('created_by', '==', user.email), limit(100))),
          getDocs(query(collection(db, 'courses'), where('teacherEmail', '==', user.email), limit(100)))
        ]);
        
        const classes: Class[] = classesSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Class))
          .filter(cls => cls.is_active);
        
        setAvailableClasses(classes);

        // Combine courses
        const coursesMap = new Map<string, any>();
        createdBySnapshot.docs.forEach(doc => {
          coursesMap.set(doc.id, doc.data());
        });
        teacherEmailSnapshot.docs.forEach(doc => {
          if (!coursesMap.has(doc.id)) {
            coursesMap.set(doc.id, doc.data());
          }
        });

        // Collect all student IDs from courses
        const allStudentIds = new Set<string>();
        const allStudentEmails = new Set<string>();
        
        coursesMap.forEach(courseData => {
          const assignedUsers = courseData.assignedUsers || [];
          assignedUsers.forEach((userId: string) => {
            if (userId.includes('@')) {
              allStudentEmails.add(userId);
            } else {
              allStudentIds.add(userId);
            }
          });
        });

        // Fetch students in parallel using chunks
        const studentIdsArray = Array.from(allStudentIds);
        const studentEmailsArray = Array.from(allStudentEmails);
        
        const studentPromises: Promise<any>[] = [];
        
        // Fetch by UID (chunked)
        if (studentIdsArray.length > 0) {
          const chunks = chunkArray(studentIdsArray, 10);
          chunks.forEach(chunk => {
            studentPromises.push(
              getDocs(query(collection(db, 'users'), where('uid', 'in', chunk), where('role', '==', 'student')))
            );
          });
        }
        
        // Fetch by email (chunked)
        if (studentEmailsArray.length > 0) {
          const chunks = chunkArray(studentEmailsArray, 10);
          chunks.forEach(chunk => {
            studentPromises.push(
              getDocs(query(collection(db, 'users'), where('email', 'in', chunk), where('role', '==', 'student')))
            );
          });
        }
        
        const studentSnapshots = await Promise.all(studentPromises);
        
        const studentsMap = new Map<string, User>();
        studentSnapshots.forEach(snapshot => {
          snapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
            const userData = doc.data();
            const uid = userData.uid || doc.id;
            if (!studentsMap.has(uid)) {
              studentsMap.set(uid, {
                uid,
                email: userData.email,
                displayName: userData.displayName || userData.email,
                role: userData.role
              });
            }
          });
        });

        const students = Array.from(studentsMap.values());
        setAvailableStudents(students);
        
        // Cache the data
        setSessionCache(cacheKey, { classes, students });
      });
    } catch (error) {
      console.error('Error fetching students and classes:', error);
    }
  }, [user?.uid, user?.email]);

  useEffect(() => {
    fetchStudentsAndClasses();
  }, [fetchStudentsAndClasses]);

  // Memoized paginated chats
  const paginatedChats = useMemo(() => {
    const startIndex = (currentPage - 1) * chatsPerPage;
    const endIndex = startIndex + chatsPerPage;
    return chats.slice(startIndex, endIndex);
  }, [chats, currentPage, chatsPerPage]);

  const totalPages = useMemo(() => Math.ceil(chats.length / chatsPerPage), [chats.length, chatsPerPage]);

  // Pobierz wiadomości dla wybranego czatu
  useEffect(() => {
    if (!selectedChat) return;

    const messagesQuery = query(
      collection(db, 'groupChats', selectedChat.id, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      
      setMessages(messagesData);
      
      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [selectedChat]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !user) return;

    setSending(true);
    try {
      await addDoc(collection(db, 'groupChats', selectedChat.id, 'messages'), {
        text: newMessage.trim(),
        senderId: user.uid,
        senderName: (user as any).displayName || user.email,
        senderEmail: user.email, // Dodaj email nadawcy
        createdAt: serverTimestamp()
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Błąd podczas wysyłania wiadomości');
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) { setSelectedFile(null); return; }
    const maxSize = 20 * 1024 * 1024; // 20 MB
    if (file.size > maxSize) {
      alert('Plik jest za duży. Maksymalny rozmiar to 20 MB.');
      e.target.value = '';
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleSendFile = async () => {
    if (!selectedChat || !user || !selectedFile) return;
    
    // Sprawdź rozmiar pliku (max 5MB dla base64)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (selectedFile.size > maxSize) {
      alert('Plik jest za duży. Maksymalny rozmiar to 5 MB.');
      return;
    }

    console.log('🚀 START FILE UPLOAD (BASE64):', {
      chatId: selectedChat.id,
      userId: user.uid,
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      fileType: selectedFile.type
    });

    try {
      setUploading(true);
      setUploadProgress(0);
      
      // Konwertuj plik na base64
      console.log('📄 Converting file to base64...');
      const reader = new FileReader();
      
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const base64Data = await base64Promise;
      console.log('✅ File converted to base64, size:', base64Data.length);

      const messageData = {
        text: '',
        senderId: user.uid,
        senderName: (user as any).displayName || user.email,
        senderEmail: user.email,
        createdAt: serverTimestamp(),
        fileData: base64Data, // Przechowujemy plik jako base64
        fileName: selectedFile.name,
        fileType: selectedFile.type || 'application/octet-stream',
        fileSize: selectedFile.size
      };

      console.log('💾 Saving message with file to Firestore...');
      await addDoc(collection(db, 'groupChats', selectedChat.id, 'messages'), messageData);
      console.log('✅ Message with file saved successfully');

      setSelectedFile(null);
      setUploadProgress(0);
    } catch (error) {
      console.error('💥 ERROR during file upload:', error);
      const errorMessage = error instanceof Error ? error.message : 'Nieznany błąd';
      alert(`Błąd podczas wysyłania pliku: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateChat = async () => {
    if (!newChatName.trim() || (selectedStudents.length === 0 && selectedClasses.length === 0) || !user) return;

    try {
      // Zbierz wszystkich uczniów z wybranych klas
      const studentsFromClasses = new Set<string>();
      selectedClasses.forEach(classId => {
        const classData = availableClasses.find(c => c.id === classId);
        if (classData && classData.students) {
          classData.students.forEach(studentId => studentsFromClasses.add(studentId));
        }
      });

      // Połącz wybranych uczniów i uczniów z klas
      const allStudents = [...new Set([...selectedStudents, ...Array.from(studentsFromClasses)])];
      const participants = [user.uid, ...allStudents];
      
      // Pobierz emaile uczniów
      const participantEmails = [user.email];
      allStudents.forEach(studentId => {
        const student = availableStudents.find(s => s.uid === studentId);
        if (student?.email) {
          participantEmails.push(student.email);
        }
      });
      
      await addDoc(collection(db, 'groupChats'), {
        name: newChatName.trim(),
        description: newChatDescription.trim(),
        participants,
        participantEmails,
        createdBy: user.uid,
        createdAt: serverTimestamp()
      });

      // Reset form
      setNewChatName('');
      setNewChatDescription('');
      setSelectedStudents([]);
      setSelectedClasses([]);
      setShowCreateChat(false);
    } catch (error) {
      console.error('Error creating chat:', error);
      alert('Błąd podczas tworzenia czatu');
    }
  };

  const filteredStudents = availableStudents.filter(student =>
    student.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = (timestamp: { seconds: number } | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp.seconds * 1000);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString() === date.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    } else if (isYesterday) {
      return `Wczoraj ${date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('pl-PL', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      }).replace(/\./g, '/');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen space-y-6 flex flex-col overflow-hidden w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Header */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Czat Grupowy</h2>
          <p className="text-gray-600">Komunikuj się ze swoimi uczniami</p>
        </div>
        <button
          onClick={() => setShowCreateChat(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nowy czat
        </button>
      </div>

      {/* Create Chat Modal */}
      {showCreateChat && (
        <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-8 w-full max-w-lg transform transition-all duration-300 ease-out scale-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-xl font-bold">💬</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Utwórz nowy czat grupowy</h3>
              </div>
              <button
                onClick={() => {
                  setShowCreateChat(false);
                  setNewChatName('');
                  setNewChatDescription('');
                  setSelectedStudents([]);
                  setSelectedClasses([]);
                  setSearchTerm('');
                }}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors group"
              >
                <span className="text-gray-500 group-hover:text-gray-700 text-lg font-medium">×</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nazwa czatu</label>
                <input
                  type="text"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="np. Matematyka 8A"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Opis (opcjonalny)</label>
                <textarea
                  value={newChatDescription}
                  onChange={(e) => setNewChatDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Opis czatu..."
                />
              </div>

              {/* Wybór klas */}
              {availableClasses.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">Wybierz całe klasy</label>
                  <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg mb-3">
                    {availableClasses.map(classData => (
                      <label key={classData.id} className="flex items-center p-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                        <input
                          type="checkbox"
                          checked={selectedClasses.includes(classData.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedClasses([...selectedClasses, classData.id]);
                            } else {
                              setSelectedClasses(selectedClasses.filter(id => id !== classData.id));
                            }
                          }}
                          className="mr-3 w-4 h-4 text-blue-600"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">{classData.name}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            ({classData.students.length} uczniów)
                          </span>
                          {classData.subject && (
                            <span className="text-xs text-blue-600 ml-2">• {classData.subject}</span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                  
                  {selectedClasses.length > 0 && (
                    <p className="text-sm text-blue-600 font-medium mb-2">
                      ✓ Wybrano {selectedClasses.length} {selectedClasses.length === 1 ? 'klasę' : 'klas'}
                      {' '}({availableClasses.filter(c => selectedClasses.includes(c.id)).reduce((sum, c) => sum + c.students.length, 0)} uczniów)
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Lub wybierz poszczególnych uczniów</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Szukaj uczniów..."
                />
                
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                  {filteredStudents.map(student => (
                    <label key={student.uid} className="flex items-center p-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.uid)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudents([...selectedStudents, student.uid]);
                          } else {
                            setSelectedStudents(selectedStudents.filter(id => id !== student.uid));
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{student.displayName} ({student.email})</span>
                    </label>
                  ))}
                </div>
                
                {selectedStudents.length > 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    Wybrano dodatkowo {selectedStudents.length} {selectedStudents.length === 1 ? 'ucznia' : 'uczniów'}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-6">
              <button
                onClick={() => {
                  setShowCreateChat(false);
                  setNewChatName('');
                  setNewChatDescription('');
                  setSelectedStudents([]);
                  setSelectedClasses([]);
                  setSearchTerm('');
                }}
                className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium border border-gray-200 hover:border-gray-300"
              >
                Anuluj
              </button>
              <button
                onClick={handleCreateChat}
                disabled={!newChatName.trim() || (selectedStudents.length === 0 && selectedClasses.length === 0)}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-xl hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Utwórz czat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Container - STAŁA WYSOKOŚĆ z overflow hidden */}
      <div className="grid lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-hidden">
        {/* Chats List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 h-full flex flex-col">
            <div className="p-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="font-semibold text-gray-900">Twoje czaty ({chats.length})</h3>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0" style={{ WebkitOverflowScrolling: 'touch', maxHeight: '100%' }}>
              {chats.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>Brak czatów grupowych</p>
                  <p className="text-sm">Utwórz swój pierwszy czat!</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 p-2">
                    {paginatedChats.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => setSelectedChat(chat)}
                      className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedChat?.id === chat.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900">{chat.name}</h4>
                      </div>
                      <div className="flex items-center text-sm text-gray-500 mb-1">
                        <Users className="h-3 w-3 mr-1" />
                        {chat.participants.length} uczestników
                      </div>
                      {chat.lastMessage && (
                        <>
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">
                              {chat.lastMessage.senderEmail || chat.lastMessage.senderName || 'Nieznany nadawca'}:
                            </span>{' '}
                            {chat.lastMessage.text.length > 40 
                              ? chat.lastMessage.text.substring(0, 40) + '...' 
                              : chat.lastMessage.text}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {formatTime(chat.lastMessage.createdAt)}
                          </div>
                        </>
                      )}
                    </div>
                    ))}
                  </div>
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Poprzednia
                      </button>
                      <span className="text-sm text-gray-600">
                        Strona {currentPage} z {totalPages} ({chats.length} czatów)
                      </span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Następna
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-2">
          {selectedChat ? (
            <div className="bg-white rounded-lg border border-gray-200 h-full flex flex-col">
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedChat.name}</h3>
                    <p className="text-sm text-gray-500">
                      {selectedChat.participants.length} uczestników
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    <Clock className="h-4 w-4 inline mr-1" />
                    Aktywny teraz
                  </div>
                </div>
                
                {/* Tabs */}
                <div className="mt-4 flex space-x-1 bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setActiveTab('messages')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'messages'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <MessageSquare className="h-4 w-4 inline mr-2" />
                    Wiadomości
                  </button>
                  <button
                    onClick={() => setActiveTab('files')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'files'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <FileText className="h-4 w-4 inline mr-2" />
                    Pliki ({messages.filter(m => m.fileData || m.fileUrl).length})
                  </button>
                </div>
                
                {/* Lista uczestników */}
                <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                  <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4" />
                    Uczestnicy grupy:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedChat.participantEmails && selectedChat.participantEmails.length > 0 ? (
                      selectedChat.participantEmails.map((email, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full border border-blue-200"
                        >
                          {email}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 text-sm">Brak informacji o uczestnikach</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Content Area - STAŁA WYSOKOŚĆ z scrollowaniem w środku */}
              <div className="flex-1 overflow-y-auto p-4 min-h-0 max-h-[calc(100vh-435px)]">
                {activeTab === 'messages' ? (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div key={message.id} className={`flex ${message.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.senderId === user?.uid
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          {message.senderId !== user?.uid && (
                            <div className="text-xs font-medium mb-1 opacity-75">{message.senderName}</div>
                          )}
                          {message.fileData ? (
                            <div className="text-sm">
                              {/^image\//.test(message.fileType || '') ? (
                                <div className="block">
                                  <img src={message.fileData} alt={message.fileName || 'Załącznik'} className="rounded-lg max-h-64 object-contain" />
                                </div>
                              ) : (
                                <a 
                                  href={message.fileData} 
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`underline ${message.senderId === user?.uid ? 'text-white' : 'text-blue-600'}`}
                                >
                                  Otwórz plik{message.fileName ? `: ${message.fileName}` : ''}
                                </a>
                              )}
                              {message.fileSize ? (
                                <div className={`text-xs mt-1 ${message.senderId === user?.uid ? 'text-blue-100' : 'text-gray-500'}`}>
                                  {(message.fileSize / (1024 * 1024)).toFixed(2)} MB
                                </div>
                              ) : null}
                              {message.text ? (
                                <div className="mt-2">{message.text}</div>
                              ) : null}
                            </div>
                          ) : message.fileUrl ? (
                            <div className="text-sm">
                              {/^image\//.test(message.fileType || '') ? (
                                <a href={message.fileUrl} target="_blank" rel="noreferrer" className="block">
                                  <img src={message.fileUrl} alt={message.fileName || 'Załącznik'} className="rounded-lg max-h-64 object-contain" />
                                </a>
                              ) : (
                                <a href={message.fileUrl} target="_blank" rel="noreferrer" className={`underline ${message.senderId === user?.uid ? 'text-white' : 'text-blue-600'}`}>
                                  Pobierz plik{message.fileName ? `: ${message.fileName}` : ''}
                                </a>
                              )}
                              {message.fileSize ? (
                                <div className={`text-xs mt-1 ${message.senderId === user?.uid ? 'text-blue-100' : 'text-gray-500'}`}>
                                  {(message.fileSize / (1024 * 1024)).toFixed(2)} MB
                                </div>
                              ) : null}
                              {message.text ? (
                                <div className="mt-2">{message.text}</div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="text-sm">{message.text}</div>
                          )}
                          <div className={`text-xs mt-1 ${message.senderId === user?.uid ? 'text-blue-100' : 'text-gray-500'}`}>
                            {formatTime(message.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900 mb-4">Pliki w czacie</h4>
                    {messages.filter(m => m.fileData || m.fileUrl).length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p>Brak plików w tym czacie</p>
                        <p className="text-sm">Pliki pojawią się tutaj po wysłaniu załączników</p>
                      </div>
                    ) : (
                      messages
                        .filter(m => m.fileData || m.fileUrl)
                        .map((message) => (
                          <div key={message.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                {/^image\//.test(message.fileType || '') ? (
                                  <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center">
                                    <span className="text-green-600 text-xs">IMG</span>
                                  </div>
                                ) : (
                                  <FileText className="h-5 w-5 text-blue-600" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{message.fileName || 'Bez nazwy'}</p>
                                <p className="text-sm text-gray-500">
                                  {message.senderName} • {formatTime(message.createdAt)} • 
                                  {message.fileSize ? ` ${(message.fileSize / (1024 * 1024)).toFixed(2)} MB` : ''}
                                </p>
                              </div>
                            </div>
                            <a
                              href={message.fileData || message.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <Download className="h-4 w-4" />
                              <span className="text-sm">Otwórz</span>
                            </a>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>

              {/* Message Input - stała wysokość */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 flex-shrink-0">
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Napisz wiadomość..."
                    disabled={sending}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  />
                  <input
                    type="file"
                    onChange={handleFileChange}
                    disabled={uploading || sending || !selectedChat}
                    className="block text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleSendFile}
                    disabled={uploading || !selectedFile || !selectedChat}
                    className="bg-white text-blue-600 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? `Wysyłanie... ${uploadProgress}%` : 'Wyślij plik'}
                  </button>
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 h-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Wybierz czat aby rozpocząć konwersację</p>
                <p className="text-sm">Kliknij na czat z listy po lewej stronie</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}