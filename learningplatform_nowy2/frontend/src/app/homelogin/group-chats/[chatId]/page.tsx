"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDoc } from "firebase/firestore";
import firebaseApp from "@/config/firebase";
import { ArrowLeft, Users, Send } from "lucide-react";

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: { seconds: number; };
}

interface Chat {
  id: string;
  name: string;
  description?: string;
  participants: string[];
  createdBy: string;
  createdAt: { seconds: number };
}

export default function StudentGroupChatView() {
  const params = useParams();
  const chatId = params?.chatId as string;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatDetails, setChatDetails] = useState<Chat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);

  // Pobierz szczegóły czatu
  useEffect(() => {
    if (!chatId) return;

    const fetchChatDetails = async () => {
      try {
        const chatDoc = await getDoc(doc(db, 'groupChats', chatId));
        if (chatDoc.exists()) {
          const chatData = chatDoc.data();
          setChatDetails({
            id: chatDoc.id,
            name: chatData.name || 'Czat bez nazwy',
            description: chatData.description || '',
            participants: chatData.participants || [],
            createdBy: chatData.createdBy || '',
            createdAt: chatData.createdAt
          });
        }
      } catch (error) {
        console.error('Error fetching chat details:', error);
      }
    };

    fetchChatDetails();
  }, [chatId, db]);

  // Pobierz wiadomości
  useEffect(() => {
    if (!chatId) return;

    const messagesQuery = query(
      collection(db, 'groupChats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      
      setMessages(messagesData);
      setLoading(false);
      
      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [chatId, db]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId || !auth.currentUser) return;

    setSending(true);
    try {
      await addDoc(collection(db, 'groupChats', chatId, 'messages'), {
        text: newMessage.trim(),
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || auth.currentUser.email || 'Użytkownik',
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

  const formatTime = (timestamp: { seconds: number }) => {
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: { seconds: number }) => {
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).replace(/\./g, '/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!chatDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col items-center justify-center">
        <p className="text-gray-500 mb-4">Nie znaleziono czatu lub nie masz do niego dostępu.</p>
        <button 
          onClick={() => window.location.href = '/homelogin'}
          className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
        >
          <ArrowLeft className="w-5 h-5" />
          Powrót
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-4xl mx-auto h-[calc(100vh-2rem)] flex flex-col bg-white/90 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
        {/* Modern Header */}
        <div className="p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-white/10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => window.location.href = '/homelogin'}
              className="p-3 hover:bg-white/50 rounded-xl transition-all duration-200 hover:shadow-lg group"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600 group-hover:text-blue-600 transition-colors" />
            </button>
            <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">{chatDetails.name}</h1>
              <div className="flex items-center gap-4 mt-1">
                <div className="flex items-center text-sm text-gray-600">
                  <Users className="h-4 w-4 mr-1" />
                  {chatDetails.participants.length} uczestników
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-green-100 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-green-700 font-medium">Aktywny</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-transparent to-blue-50/30">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Send className="h-8 w-8 text-blue-500" />
              </div>
              <p className="text-gray-600 font-medium mb-2">Brak wiadomości w tym czacie</p>
              <p className="text-sm text-gray-500">Napisz pierwszą wiadomość!</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isCurrentUser = message.senderId === auth.currentUser?.uid;
              const showDateSeparator = index === 0 || 
                formatDate(message.createdAt) !== formatDate(messages[index - 1].createdAt);

              return (
                <div key={message.id}>
                  {showDateSeparator && (
                    <div className="text-center my-6">
                      <span className="bg-white/80 backdrop-blur-sm text-gray-600 text-xs px-4 py-2 rounded-full shadow-lg border border-gray-100">
                        {formatDate(message.createdAt)}
                      </span>
                    </div>
                  )}
                  
                  <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-lg transition-all duration-200 hover:shadow-xl ${
                      isCurrentUser
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white' 
                        : 'bg-white border border-gray-100 text-gray-900'
                    }`}>
                      {!isCurrentUser && (
                        <div className="text-xs font-semibold mb-2 text-blue-500 bg-blue-50 px-2 py-1 rounded-lg inline-block">
                          {message.senderName}
                        </div>
                      )}
                      <div className="text-sm leading-relaxed">{message.text}</div>
                      <div className={`text-xs mt-2 ${
                        isCurrentUser ? 'text-white/70' : 'text-gray-500'
                      }`}>
                        {formatTime(message.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Modern Message Input */}
        <form onSubmit={handleSendMessage} className="p-6 bg-white/50 backdrop-blur-sm border-t border-white/20">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Napisz wiadomość..."
                disabled={sending}
                style={{ fontSize: '16px' }}
                className="w-full border-0 bg-white rounded-2xl px-4 sm:px-6 py-3 sm:py-4 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:shadow-xl transition-all duration-200 disabled:opacity-50 text-gray-900 placeholder-gray-400"
              />
            </div>
            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-3 sm:p-4 rounded-2xl hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg min-w-[48px] min-h-[48px] flex items-center justify-center"
            >
              <Send className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
