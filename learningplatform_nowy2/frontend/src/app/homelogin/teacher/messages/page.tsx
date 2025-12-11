'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, getDocs, query, where, doc, getDoc, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { MessageSquare, Send, User, Mail, CheckCircle2 } from 'lucide-react';

interface ParentMessage {
  id: string;
  from: string; // UID nadawcy
  to: string; // UID odbiorcy
  content: string;
  subject?: string;
  timestamp: any;
  read: boolean;
  emailSent?: boolean;
  parentEmail?: string;
  parentName?: string;
  isReply?: boolean;
  originalMessageId?: string;
  conversationId?: string; // ID konwersacji (pierwsza wiadomość)
}

interface ParentInfo {
  uid: string;
  email: string;
  name: string;
}

export default function TeacherMessagesPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ParentMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<ParentMessage | null>(null);
  const [conversationMessages, setConversationMessages] = useState<ParentMessage[]>([]);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [parentInfo, setParentInfo] = useState<{[key: string]: ParentInfo}>({});

  useEffect(() => {
    if (!user) return;

    const fetchMessages = async () => {
      try {
        setLoading(true);
        const messagesRef = collection(db, 'messages');
        
        // Pobierz wszystkie wiadomości gdzie nauczyciel jest odbiorcą LUB nadawcą (konwersacje)
        const [receivedMessages, sentMessages] = await Promise.all([
          getDocs(query(messagesRef, where('to', '==', user.uid))),
          getDocs(query(messagesRef, where('from', '==', user.uid)))
        ]);
        
        const allMessages = [
          ...receivedMessages.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentMessage)),
          ...sentMessages.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentMessage))
        ];
        
        // Usuń duplikaty i posortuj
        const uniqueMessages = allMessages.filter((msg, index, self) =>
          index === self.findIndex(m => m.id === msg.id)
        );
        
        // Grupuj wiadomości w konwersacje - znajdź pierwszą wiadomość od każdego rodzica
        const conversations = new Map<string, ParentMessage>();
        
        uniqueMessages.forEach(msg => {
          // Jeśli to pierwsza wiadomość od rodzica (nie jest odpowiedzią)
          if (msg.from !== user.uid && !msg.isReply && !msg.originalMessageId) {
            const conversationKey = msg.from;
            if (!conversations.has(conversationKey)) {
              conversations.set(conversationKey, msg);
            } else {
              // Jeśli istnieje już konwersacja, sprawdź która jest starsza
              const existing = conversations.get(conversationKey)!;
              const existingTime = existing.timestamp?.toDate?.() || new Date(existing.timestamp);
              const msgTime = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
              if (msgTime < existingTime) {
                conversations.set(conversationKey, msg);
              }
            }
          }
        });
        
        // Pobierz najnowsze wiadomości z każdej konwersacji dla listy
        const conversationList: ParentMessage[] = [];
        conversations.forEach((firstMessage, parentId) => {
          // Znajdź najnowszą wiadomość w tej konwersacji
          const conversationMsgs = uniqueMessages.filter(m => 
            (m.from === parentId && m.to === user.uid) || 
            (m.from === user.uid && m.to === parentId)
          );
          const latestMessage = conversationMsgs.sort((a, b) => {
            const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp);
            const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp);
            return bTime.getTime() - aTime.getTime();
          })[0];
          
          conversationList.push(latestMessage);
        });
        
        // Posortuj listę konwersacji po najnowszej wiadomości
        conversationList.sort((a, b) => {
          const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp);
          const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp);
          return bTime.getTime() - aTime.getTime();
        });

        setMessages(conversationList);

        // Pobierz informacje o rodzicach - z wszystkich wiadomości (nie tylko z conversationList)
        const parentIds = [...new Set(uniqueMessages.filter(m => m.from !== user.uid).map(m => m.from))];
        const parentInfoMap: {[key: string]: ParentInfo} = {};

        for (const parentId of parentIds) {
          try {
            const parentDoc = await getDoc(doc(db, 'users', parentId));
            if (parentDoc.exists()) {
              const parentData = parentDoc.data();
              parentInfoMap[parentId] = {
                uid: parentId,
                email: parentData.email || '',
                name: parentData.displayName || `${parentData.firstName || ''} ${parentData.lastName || ''}`.trim() || parentData.email || 'Rodzic'
              };
            }
          } catch (error) {
            console.error(`Error fetching parent ${parentId}:`, error);
          }
        }

        setParentInfo(parentInfoMap);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    
    // Odświeżaj wiadomości co 5 sekund
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [user]);
  
  // Odświeżaj konwersację gdy jest wybrana
  useEffect(() => {
    if (!selectedMessage || !user) return;
    
    const refreshConversation = async () => {
      const parentId = selectedMessage.from === user.uid ? selectedMessage.to : selectedMessage.from;
      const [receivedMessages, sentMessages] = await Promise.all([
        getDocs(query(collection(db, 'messages'), where('from', '==', parentId), where('to', '==', user.uid))),
        getDocs(query(collection(db, 'messages'), where('from', '==', user.uid), where('to', '==', parentId)))
      ]);
      
      const allConvMessages = [
        ...receivedMessages.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentMessage)),
        ...sentMessages.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentMessage))
      ];
      
      const uniqueConvMessages = allConvMessages.filter((msg, index, self) =>
        index === self.findIndex(m => m.id === msg.id)
      );
      
      uniqueConvMessages.sort((a, b) => {
        const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp);
        const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp);
        return aTime.getTime() - bTime.getTime();
      });
      
      setConversationMessages(uniqueConvMessages);
    };
    
    refreshConversation();
    const interval = setInterval(refreshConversation, 5000);
    return () => clearInterval(interval);
  }, [selectedMessage, user]);

  const sendReply = async () => {
    if (!replyContent.trim() || !selectedMessage || !user) return;

    setSending(true);
    try {
      const parentId = selectedMessage.from === user.uid ? selectedMessage.to : selectedMessage.from;
      
      // Utwórz nową wiadomość jako odpowiedź w konwersacji
      const replyMessageRef = await addDoc(collection(db, 'messages'), {
        from: user.uid,
        to: parentId,
        content: replyContent,
        subject: `Re: ${selectedMessage.subject || 'Wiadomość'}`,
        timestamp: serverTimestamp(),
        read: false,
        emailSent: false, // Nie wysyłamy emaila - rodzic nie ma skrzynki
        isReply: true,
        originalMessageId: selectedMessage.id,
        parentEmail: selectedMessage.parentEmail,
      });

      // Utwórz powiadomienie dla rodzica o nowej odpowiedzi
      try {
        const teacherDoc = await getDoc(doc(db, 'users', user.uid));
        const teacherName = teacherDoc.exists() ? (teacherDoc.data().displayName || teacherDoc.data().email || 'Nauczyciel') : 'Nauczyciel';
        
        await addDoc(collection(db, 'notifications'), {
          user_id: parentId,
          type: 'message',
          title: 'Nowa odpowiedź od nauczyciela',
          message: `${teacherName} odpowiedział na Twoją wiadomość: ${replyContent.substring(0, 100)}${replyContent.length > 100 ? '...' : ''}`,
          timestamp: serverTimestamp(),
          read: false,
          action_url: '/homelogin/parent/messages',
          teacherName: teacherName,
          messageId: replyMessageRef.id
        });
      } catch (notifError) {
        console.error('Error creating notification:', notifError);
        // Nie przerywamy procesu jeśli powiadomienie się nie utworzyło
      }

      setReplyContent('');
      
      // Odśwież konwersację
      const [receivedMessages, sentMessages] = await Promise.all([
        getDocs(query(collection(db, 'messages'), where('from', '==', parentId), where('to', '==', user.uid))),
        getDocs(query(collection(db, 'messages'), where('from', '==', user.uid), where('to', '==', parentId)))
      ]);
      
      const allConvMessages = [
        ...receivedMessages.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentMessage)),
        ...sentMessages.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentMessage))
      ];
      
      const uniqueConvMessages = allConvMessages.filter((msg, index, self) =>
        index === self.findIndex(m => m.id === msg.id)
      );
      
      uniqueConvMessages.sort((a, b) => {
        const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp);
        const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp);
        return aTime.getTime() - bTime.getTime();
      });
      
      setConversationMessages(uniqueConvMessages);
      
      // Odśwież listę konwersacji
      const [allReceived, allSent] = await Promise.all([
        getDocs(query(collection(db, 'messages'), where('to', '==', user.uid))),
        getDocs(query(collection(db, 'messages'), where('from', '==', user.uid)))
      ]);
      
      const allMessages = [
        ...allReceived.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentMessage)),
        ...allSent.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentMessage))
      ];
      
      const uniqueMessages = allMessages.filter((msg, index, self) =>
        index === self.findIndex(m => m.id === msg.id)
      );
      
      const conversations = new Map<string, ParentMessage>();
      uniqueMessages.forEach(msg => {
        if (msg.from !== user.uid && !msg.isReply && !msg.originalMessageId) {
          const conversationKey = msg.from;
          if (!conversations.has(conversationKey)) {
            conversations.set(conversationKey, msg);
          } else {
            const existing = conversations.get(conversationKey)!;
            const existingTime = existing.timestamp?.toDate?.() || new Date(existing.timestamp);
            const msgTime = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
            if (msgTime < existingTime) {
              conversations.set(conversationKey, msg);
            }
          }
        }
      });
      
      const conversationList: ParentMessage[] = [];
      conversations.forEach((firstMessage, parentId) => {
        const conversationMsgs = uniqueMessages.filter(m => 
          (m.from === parentId && m.to === user.uid) || 
          (m.from === user.uid && m.to === parentId)
        );
        const latestMessage = conversationMsgs.sort((a, b) => {
          const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp);
          const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp);
          return bTime.getTime() - aTime.getTime();
        })[0];
        conversationList.push(latestMessage);
      });
      
      conversationList.sort((a, b) => {
        const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp);
        const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp);
        return bTime.getTime() - aTime.getTime();
      });
      
      setMessages(conversationList);
    } catch (error) {
      console.error('Error sending reply:', error);
      alert('Wystąpił błąd podczas wysyłania odpowiedzi');
    } finally {
      setSending(false);
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      await updateDoc(doc(db, 'messages', messageId), {
        read: true,
      });
      
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, read: true } : m
      ));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const unreadCount = messages.filter(m => !m.read).length;
  const parent = selectedMessage ? parentInfo[selectedMessage.from] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Wiadomości od rodziców
            {unreadCount > 0 && (
              <span className="ml-3 px-3 py-1 bg-red-500 text-white text-sm rounded-full">
                {unreadCount} nieprzeczytanych
              </span>
            )}
          </h1>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          {/* Lista wiadomości */}
          <div className="bg-white rounded-xl shadow-lg border border-white/20 overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700">
              <h2 className="text-lg font-bold text-white">Wiadomości ({messages.length})</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Brak wiadomości od rodziców</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {messages.map((message) => {
                    const parent = parentInfo[message.from];
                    return (
                      <button
                        key={message.id}
                        onClick={async () => {
                          setSelectedMessage(message);
                          if (!message.read && message.from !== user?.uid) {
                            markAsRead(message.id);
                          }
                          
                          // Pobierz wszystkie wiadomości w konwersacji
                          const parentId = message.from === user?.uid ? message.to : message.from;
                          const conversationMsgs = await Promise.all([
                            getDocs(query(collection(db, 'messages'), where('from', '==', parentId), where('to', '==', user?.uid))),
                            getDocs(query(collection(db, 'messages'), where('from', '==', user?.uid), where('to', '==', parentId)))
                          ]);
                          
                          const allConvMessages = [
                            ...conversationMsgs[0].docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentMessage)),
                            ...conversationMsgs[1].docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentMessage))
                          ];
                          
                          // Usuń duplikaty i posortuj chronologicznie
                          const uniqueConvMessages = allConvMessages.filter((msg, index, self) =>
                            index === self.findIndex(m => m.id === msg.id)
                          );
                          
                          uniqueConvMessages.sort((a, b) => {
                            const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp);
                            const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp);
                            return aTime.getTime() - bTime.getTime(); // Najstarsze na górze
                          });
                          
                          setConversationMessages(uniqueConvMessages);
                        }}
                        className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                          selectedMessage?.id === message.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                        } ${!message.read ? 'bg-blue-50/50' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            !message.read ? 'bg-blue-100' : 'bg-gray-100'
                          }`}>
                            <User className={`w-5 h-5 ${!message.read ? 'text-blue-600' : 'text-gray-600'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="font-semibold text-gray-800 truncate">
                                {parent?.name || 'Rodzic'}
                              </div>
                              {!message.read && (
                                <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 truncate mb-1">
                              {message.subject || message.content.substring(0, 50)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {message.timestamp?.toDate?.()?.toLocaleString('pl-PL') || new Date(message.timestamp).toLocaleString('pl-PL')}
                            </div>
                            {message.from === user?.uid && (
                              <div className="mt-1 text-xs text-blue-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Twoja odpowiedź
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Okno wiadomości i odpowiedzi */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg border border-white/20 flex flex-col">
            {selectedMessage ? (
              <>
                <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-bold text-white">{parent?.name || 'Rodzic'}</div>
                      <div className="text-sm text-blue-100">{parent?.email || selectedMessage.parentEmail}</div>
                    </div>
                  </div>
                  {parent?.email && (
                    <a 
                      href={`mailto:${parent.email}`} 
                      className="text-white hover:text-blue-100 transition-colors"
                      title="Otwórz email"
                    >
                      <Mail className="w-5 h-5" />
                    </a>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Konwersacja - wszystkie wiadomości */}
                  {conversationMessages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <p>Ładowanie konwersacji...</p>
                    </div>
                  ) : (
                    conversationMessages.map((msg) => {
                      const isFromMe = msg.from === user?.uid;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg shadow-sm ${
                              isFromMe
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            <div className="text-xs opacity-70 mb-1">
                              {msg.timestamp?.toDate?.()?.toLocaleString('pl-PL') || new Date(msg.timestamp).toLocaleString('pl-PL')}
                            </div>
                            <div className="text-sm whitespace-pre-wrap">
                              {msg.content}
                            </div>
                            {msg.subject && !isFromMe && (
                              <div className="mt-2 text-xs opacity-70">
                                <strong>Temat:</strong> {msg.subject}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Formularz odpowiedzi - zawsze widoczny */}
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Odpowiedz:
                    </label>
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Napisz odpowiedź..."
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none"
                    />
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        Odpowiedź będzie widoczna dla rodzica na platformie. Rodzic nie ma skrzynki pocztowej.
                      </p>
                      <button
                        onClick={sendReply}
                        disabled={!replyContent.trim() || sending}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {sending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Wysyłanie...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Wyślij</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>Wybierz wiadomość, aby zobaczyć szczegóły</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

