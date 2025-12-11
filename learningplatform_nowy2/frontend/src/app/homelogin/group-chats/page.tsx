'use client';

// Force dynamic rendering to prevent SSR issues with client-side hooks
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from "react";
import { useAuth } from '@/context/AuthContext';
import { MessageSquare, Users, Send, ArrowLeft, FileText, Download } from 'lucide-react';
import { db } from '@/config/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, limit, getDocs } from 'firebase/firestore';
// import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';

interface GroupChat {
  id: string;
  name: string;
  description?: string;
  participants: string[];
  participantEmails: string[]; // Dodaję emaile uczestników
  createdBy: string;
  createdAt: { seconds: number };
  lastMessage?: {
    text: string;
    senderId: string;
    senderName: string;
    senderEmail: string; // Dodaję email nadawcy
    createdAt: { seconds: number };
  };
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderEmail: string; // Dodaję email nadawcy
  createdAt: { seconds: number };
  fileUrl?: string;
  fileData?: string; // Base64 data
  fileName?: string;
  fileType?: string;
  fileSize?: number;
}

export default function StudentGroupChatsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<GroupChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<GroupChat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'messages' | 'files'>('messages');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Pobierz czaty grupowe ucznia
  useEffect(() => {
    console.log('useEffect dla czatów - start, user:', user ? 'istnieje' : 'brak');
    
    if (!user) {
      console.log('Brak użytkownika - kończę useEffect');
      setLoading(false);
      return;
    }

    // Sprawdź czy użytkownik ma wymagane dane
    if (!user.uid) {
      console.error('Brak UID użytkownika');
      setLoading(false);
      return;
    }
    
    if (!user.email) {
      console.error('Brak emaila użytkownika');
      setLoading(false);
      return;
    }

    console.log('Użytkownik ma wymagane dane, tworzę query dla czatów');

    try {
      const chatsQuery = query(
        collection(db, 'groupChats'),
        where('participants', 'array-contains', user.uid)
      );

      console.log('Query utworzone, nasłuchuję zmian');

      const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
        console.log('Otrzymano snapshot czatów, liczba:', snapshot.docs.length);
        
        try {
          const chatsData: GroupChat[] = [];
          
          // Przetwórz wszystkie czaty równolegle
          const chatPromises = snapshot.docs.map(async (chatDoc) => {
            try {
              const chatData = chatDoc.data();
              
              const participantEmails: string[] = [];
              if (chatData.participants && chatData.participants.length > 0) {
                chatData.participants.forEach((uid: string) => {
                  if (uid === user.uid && user.email) {
                    participantEmails.push(user.email);
                  } else {
                    participantEmails.push(`Użytkownik ${uid.substring(0, 8)}...`);
                  }
                });
              }
              
              // Pobierz ostatnią wiadomość
              let lastMessage = undefined;
              try {
                const messagesQuery = query(
                  collection(db, 'groupChats', chatDoc.id, 'messages'),
                  orderBy('createdAt', 'desc'),
                  limit(1)
                );
                const messagesSnapshot = await getDocs(messagesQuery);
                
                if (!messagesSnapshot.empty) {
                  const lastMsgData = messagesSnapshot.docs[0].data();
                  lastMessage = {
                    text: lastMsgData.text || '',
                    senderId: lastMsgData.senderId || '',
                    senderName: lastMsgData.senderName || 'Nieznany',
                    senderEmail: lastMsgData.senderEmail || 'Nieznany nadawca',
                    createdAt: lastMsgData.createdAt
                  };
                }
              } catch (error) {
                console.error('Error fetching last message for chat', chatDoc.id, ':', error);
              }

              const chat: GroupChat = {
                id: chatDoc.id,
                name: chatData.name || 'Czat bez nazwy',
                description: chatData.description || '',
                participants: chatData.participants || [],
                participantEmails: participantEmails,
                createdBy: chatData.createdBy || '',
                createdAt: chatData.createdAt,
                lastMessage
              };
              return chat;
            } catch (error) {
              console.error('Błąd podczas przetwarzania czatu:', chatDoc.id, error);
              return null;
            }
          });
          
          const processedChats = await Promise.all(chatPromises);
          // Filtruj null values
          const validChats = processedChats.filter((chat): chat is GroupChat => chat !== null);
          chatsData.push(...validChats);
          
          // Sortuj czaty po ostatniej wiadomości
          chatsData.sort((a, b) => {
            if (!a.lastMessage && !b.lastMessage) return 0;
            if (!a.lastMessage) return 1;
            if (!b.lastMessage) return 1;
            return b.lastMessage.createdAt?.seconds - a.lastMessage.createdAt?.seconds;
          });
          
          setChats(chatsData);
          console.log('Czaty ustawione w stanie');
          
        } catch (error) {
          console.error('Błąd podczas przetwarzania czatów:', error);
          setChats([]);
        } finally {
          setLoading(false);
          console.log('Loading ustawione na false');
        }
      }, (error) => {
        console.error('Błąd w snapshot czatów:', error);
        setChats([]);
        setLoading(false);
      });

      return () => {
        console.log('Czyszczę subscription dla czatów');
        unsubscribe();
      };
      
    } catch (error) {
      console.error('Błąd podczas tworzenia query czatów:', error);
      setChats([]);
      setLoading(false);
    }
  }, [user]);

  // Pobierz wiadomości dla wybranego czatu
  useEffect(() => {
    if (!selectedChat) {
      console.log('Brak wybranego czatu - nie pobieram wiadomości');
      return;
    }

    if (!selectedChat.id) {
      console.error('Brak ID czatu');
      return;
    }

    console.log('Pobieram wiadomości dla czatu:', selectedChat.id);

    try {
      const messagesQuery = query(
        collection(db, 'groupChats', selectedChat.id, 'messages'),
        orderBy('createdAt', 'asc')
      );

      const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        try {
          console.log('Otrzymano snapshot wiadomości, liczba:', snapshot.docs.length);
          
          const messagesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Message[];
          
          console.log('Przetworzone wiadomości:', messagesData.length);
          setMessages(messagesData);
          
          // Scroll to bottom
          setTimeout(() => {
            if (messagesEndRef.current) {
              messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
            }
          }, 100);
          
        } catch (error) {
          console.error('Błąd podczas przetwarzania wiadomości:', error);
          setMessages([]);
        }
      }, (error) => {
        console.error('Błąd w snapshot wiadomości:', error);
        setMessages([]);
      });

      return () => {
        console.log('Czyszczę subscription dla wiadomości');
        unsubscribe();
      };
      
    } catch (error) {
      console.error('Błąd podczas tworzenia query wiadomości:', error);
      setMessages([]);
    }
  }, [selectedChat]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Podstawowe sprawdzenia
    if (!newMessage.trim()) {
      console.log('Wiadomość jest pusta');
      return;
    }
    
    if (!selectedChat) {
      console.log('Brak wybranego czatu');
      return;
    }
    
    if (!user) {
      console.log('Brak użytkownika');
      return;
    }
    
    if (!user.uid) {
      console.log('Brak UID użytkownika');
      return;
    }
    
    if (!user.email) {
      console.log('Brak emaila użytkownika');
      return;
    }

    setSending(true);
    
    try {
      console.log('Próba wysłania wiadomości:', {
        text: newMessage.trim(),
        senderId: user.uid,
        senderEmail: user.email,
        chatId: selectedChat.id
      });

      const messageData = {
        text: newMessage.trim(),
        senderId: user.uid,
        senderName: user.email || 'Nieznany użytkownik',
        senderEmail: user.email,
        createdAt: serverTimestamp()
      };

      console.log('Dane wiadomości:', messageData);

      await addDoc(collection(db, 'groupChats', selectedChat.id, 'messages'), messageData);

      console.log('Wiadomość wysłana pomyślnie');
      setNewMessage('');
      
    } catch (error) {
      console.error('Błąd podczas wysyłania wiadomości:', error);
      
      // Prosty komunikat błędu
      if (error instanceof Error) {
        console.error('Szczegóły błędu:', error.message);
        console.error('Stack trace:', error.stack);
      }
      
      // Nie pokazuj alertu - tylko loguj błąd
      console.error('Wiadomość nie została wysłana z powodu błędu');
      
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setSelectedFile(null);
      return;
    }
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
        senderName: user.email || 'Nieznany użytkownik',
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

  const formatTime = (timestamp: { seconds: number }) => {
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
      <div className="flex items-center justify-center min-h-64">
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  console.log('Renderuję komponent, stan:', {
    loading,
    chatsCount: chats.length,
    selectedChatId: selectedChat?.id,
    messagesCount: messages.length,
    user: user ? { uid: user.uid, email: user.email } : 'brak'
  });

  return (
    <div className="min-h-screen h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-2 sm:p-4 flex flex-col overflow-hidden overflow-x-hidden w-full max-w-full" style={{ maxHeight: '100vh', maxWidth: '100vw' }}>
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Modern Header */}
      <div className="mb-4 sm:mb-6 flex-shrink-0">
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/homelogin')}
                className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Powrót</span>
              </button>
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Czat Grupowy
                </h2>
                <p className="text-gray-600">Komunikuj się z nauczycielami i innymi uczniami</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Container - STAŁA WYSOKOŚĆ z overflow hidden */}
      <div className="grid lg:grid-cols-3 gap-2 sm:gap-6 flex-1 min-h-0 overflow-hidden w-full max-w-full">
        {/* Modern Chats List */}
        <div className="lg:col-span-1 min-h-0 flex flex-col w-full max-w-full">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl h-full overflow-hidden flex flex-col w-full max-w-full">
            <div className="p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-white/10 flex-shrink-0">
              <h3 className="font-bold text-gray-900 text-lg">Twoje czaty</h3>
              <p className="text-sm text-gray-600 mt-1">{chats.length} aktywnych rozmów</p>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0 -webkit-overflow-scrolling-touch" style={{ WebkitOverflowScrolling: 'touch', maxHeight: '100%' }}>
              {chats.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-20 h-20 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="h-8 w-8 text-blue-500" />
                  </div>
                  <p className="text-gray-600 font-medium mb-2">Brak czatów grupowych</p>
                  <p className="text-sm text-gray-500">Nauczyciel może dodać Cię do czatu</p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {chats.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => setSelectedChat(chat)}
                      className={`p-4 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-lg ${
                        selectedChat?.id === chat.id 
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-[1.02]' 
                          : 'bg-white/50 hover:bg-white/80 border border-gray-100'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                          selectedChat?.id === chat.id 
                            ? 'bg-white/20' 
                            : 'bg-gradient-to-r from-blue-400 to-purple-500'
                        }`}>
                          <Users className={`h-5 w-5 ${
                            selectedChat?.id === chat.id ? 'text-white' : 'text-white'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-semibold truncate ${
                            selectedChat?.id === chat.id ? 'text-white' : 'text-gray-900'
                          }`}>
                            {chat.name}
                          </h4>
                          <div className={`flex items-center text-sm mt-1 ${
                            selectedChat?.id === chat.id ? 'text-white/80' : 'text-gray-500'
                          }`}>
                            <Users className="h-3 w-3 mr-1" />
                            {chat.participants.length} uczestników
                          </div>
                          {chat.lastMessage && (
                            <>
                              <div className={`text-sm mt-2 ${
                                selectedChat?.id === chat.id ? 'text-white/90' : 'text-gray-600'
                              }`}>
                                <span className="font-medium">
                                  {chat.lastMessage.senderEmail || chat.lastMessage.senderName || 'Nieznany nadawca'}:
                                </span>{' '}
                                {chat.lastMessage.text.length > 35 
                                  ? chat.lastMessage.text.substring(0, 35) + '...' 
                                  : chat.lastMessage.text}
                              </div>
                              <div className={`text-xs mt-1 ${
                                selectedChat?.id === chat.id ? 'text-white/70' : 'text-gray-400'
                              }`}>
                                {formatTime(chat.lastMessage.createdAt)}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modern Chat Area */}
        <div className="lg:col-span-2 w-full max-w-full min-w-0">
          {selectedChat ? (
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl h-full flex flex-col overflow-hidden w-full max-w-full">
              {/* Modern Chat Header */}
              <div className="p-3 sm:p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-white/10 flex-shrink-0 w-full max-w-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{selectedChat.name}</h3>
                      <p className="text-sm text-gray-600">
                        {selectedChat.participants.length} uczestników
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-green-100 rounded-full">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-green-700 font-medium">Aktywny</span>
                  </div>
                </div>
                
                {/* Tabs */}
                <div className="mt-4 flex space-x-1 bg-white/30 p-1 rounded-lg">
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
                <div className="mt-3 p-3 bg-white/50 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4" />
                    Uczestnicy grupy:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedChat.participantEmails && selectedChat.participantEmails.length > 0 ? (
                      selectedChat.participantEmails.map((email, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full border border-blue-200"
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
              <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-gradient-to-b from-transparent to-blue-50/30 min-h-0 max-h-[calc(100vh-435px)] w-full max-w-full">
                {activeTab === 'messages' ? (
                  <div className="space-y-4 w-full">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        <p>Brak wiadomości w tym czacie</p>
                        <p className="text-sm">Rozpocznij konwersację!</p>
                      </div>
                    ) : (
                      messages.map((message) => {
                        console.log('Renderuję wiadomość:', message);
                        return (
                          <div key={message.id} className={`flex ${message.senderId === user?.uid ? 'justify-end' : 'justify-start'} w-full`}>
                            <div className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-2 sm:py-3 rounded-2xl shadow-lg transition-all duration-200 hover:shadow-xl ${
                              message.senderId === user?.uid
                                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white' 
                                : 'bg-white border border-gray-100 text-gray-900'
                            }`}>
                              {/* Zawsze pokazuj email nadawcy */}
                              <div className={`text-xs font-semibold mb-2 px-2 py-1 rounded-lg inline-block ${
                                message.senderId === user?.uid
                                  ? 'text-white/90 bg-white/20'
                                  : 'text-blue-500 bg-blue-50'
                              }`}>
                                {message.senderEmail || message.senderName || 'Nieznany nadawca'}
                              </div>
                              {message.fileData ? (
                                <div className="text-sm leading-relaxed">
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
                                    <div className={`text-xs mt-1 ${message.senderId === user?.uid ? 'text-white/70' : 'text-gray-500'}`}>
                                      {(message.fileSize / (1024 * 1024)).toFixed(2)} MB
                                    </div>
                                  ) : null}
                                  {message.text ? (
                                    <div className="mt-2">{message.text}</div>
                                  ) : null}
                                </div>
                              ) : message.fileUrl ? (
                                <div className="text-sm leading-relaxed">
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
                                    <div className={`text-xs mt-1 ${message.senderId === user?.uid ? 'text-white/70' : 'text-gray-500'}`}>
                                      {(message.fileSize / (1024 * 1024)).toFixed(2)} MB
                                    </div>
                                  ) : null}
                                  {message.text ? (
                                    <div className="mt-2">{message.text}</div>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="text-sm leading-relaxed">{message.text}</div>
                              )}
                              <div className={`text-xs mt-2 ${
                                message.senderId === user?.uid ? 'text-white/70' : 'text-gray-500'
                              }`}>
                                {formatTime(message.createdAt)}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
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
                          <div key={message.id} className="flex items-center justify-between p-3 bg-white/80 rounded-lg border border-gray-200 shadow-sm">
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
                              className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200"
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

              {/* Modern Message Input - stała wysokość */}
              <form onSubmit={handleSendMessage} className="p-3 sm:p-6 bg-white/50 backdrop-blur-sm border-t border-white/20 flex-shrink-0 w-full max-w-full">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full">
                  <div className="flex-1 relative min-w-0 w-full sm:w-auto">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Napisz wiadomość..."
                      disabled={sending}
                      style={{ fontSize: '16px' }}
                      className="w-full border-0 bg-white rounded-2xl px-3 sm:px-6 py-2 sm:py-4 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:shadow-xl transition-all duration-200 disabled:opacity-50 text-gray-900 placeholder-gray-400"
                    />
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="hidden sm:block">
                      <input
                        type="file"
                        onChange={handleFileChange}
                        disabled={uploading || sending || !selectedChat}
                        className="block text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSendFile}
                      disabled={uploading || !selectedFile || !selectedChat}
                      className="bg-white text-blue-600 border border-blue-200 px-2 sm:px-4 py-2 sm:py-3 rounded-2xl hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm whitespace-nowrap"
                    >
                      {uploading ? `${uploadProgress}%` : <span className="hidden sm:inline">Wyślij plik</span>}
                      {uploading ? null : <span className="sm:hidden">Plik</span>}
                    </button>
                    <button
                      type="submit"
                      disabled={sending || !newMessage.trim()}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-2 sm:p-4 rounded-2xl hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <MessageSquare className="h-10 w-10 text-blue-500" />
                </div>
                <p className="text-xl font-bold text-gray-900 mb-2">Wybierz czat aby rozpocząć</p>
                <p className="text-gray-600">Kliknij na czat z listy po lewej stronie</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

