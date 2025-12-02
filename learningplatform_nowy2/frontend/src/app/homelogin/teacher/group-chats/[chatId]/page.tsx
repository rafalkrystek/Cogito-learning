"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, limit, startAfter, updateDoc, setDoc, where, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase-config";
import firebaseApp from "@/config/firebase";
import { ArrowLeft, Users, Paperclip, Send, Settings } from "lucide-react";

interface Message {
  id: string;
  senderId: string;
  text?: string;
  fileUrl?: string;
  fileType?: string;
  fileName?: string;
  createdAt: { seconds: number; };
}

interface UserInfo {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  email?: string;
  firstName?: string;
  lastName?: string;
}

interface ParticipantInfo {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}



const MESSAGES_PER_PAGE = 50;

export default function GroupChatView() {
  const params = useParams();
  const chatId = params?.chatId as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [chatName, setChatName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [userMap, setUserMap] = useState<Record<string, UserInfo>>({});
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const lastMessageRef = useRef<import('firebase/firestore').QueryDocumentSnapshot | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(true);
  const [participantsData, setParticipantsData] = useState<ParticipantInfo[]>([]);
  const [isTeacher, setIsTeacher] = useState(false);
  const [showManageParticipants, setShowManageParticipants] = useState(false);
  const [files, setFiles] = useState<Message[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);

  const loadMoreMessages = useCallback(async () => {
    if (!hasMoreMessages || !lastMessageRef.current || !chatId) return;
    
    try {
      const q = query(
        collection(db, "groupChats", chatId, "messages"),
        orderBy("createdAt", "desc"),
        startAfter(lastMessageRef.current),
        limit(MESSAGES_PER_PAGE)
      );
      
      const snapshot = await getDocs(q);
      const olderMessages: Message[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Message));
      
      if (olderMessages.length > 0) {
        setMessages(prev => [...olderMessages.reverse(), ...prev]);
        lastMessageRef.current = snapshot.docs[snapshot.docs.length - 1];
        setHasMoreMessages(snapshot.docs.length === MESSAGES_PER_PAGE);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error("Błąd podczas ładowania starszych wiadomości:", error);
    }
  }, [hasMoreMessages, chatId, db]);

  useEffect(() => {
    if (!chatId) return;
    
    setLoading(true);
    setParticipantsLoading(true);
    
    const chatDoc = doc(db, "groupChats", chatId);
    const unsubChat = onSnapshot(chatDoc, (docSnap) => {
      if (docSnap.exists()) {
        const chatData = docSnap.data();
        setChatName(chatData.name || "Czat grupowy");
        const participantUids = chatData.participants || [];
        setParticipants(participantUids);
        setParticipantsLoading(false);
        
        fetchParticipantsData(participantUids);
        
        const checkTeacherStatus = async () => {
          try {
            const user = auth.currentUser;
            if (user) {
              const token = await user.getIdTokenResult();
              setIsTeacher(token.claims.role === "teacher");
            }
          } catch (error) {
            console.error("Błąd podczas sprawdzania roli:", error);
          }
        };
        checkTeacherStatus();
      }
    });

    const q = query(
      collection(db, "groupChats", chatId, "messages"),
      orderBy("createdAt", "desc"),
      limit(MESSAGES_PER_PAGE)
    );
    
    const unsubMessages = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs.reverse());
      setLoading(false);
      
      if (snapshot.docs.length > 0) {
        lastMessageRef.current = snapshot.docs[snapshot.docs.length - 1];
      }
      
      setHasMoreMessages(snapshot.docs.length === MESSAGES_PER_PAGE);
      
      if (msgs.length > 0) {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    });

    return () => {
      unsubChat();
      unsubMessages();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, db, auth.currentUser]);

  useEffect(() => {
    if (auth.currentUser && chatId) {
      setDoc(
        doc(getFirestore(firebaseApp), "groupChats", chatId, "readStatus", auth.currentUser.uid),
        { lastRead: serverTimestamp() },
        { merge: true }
      );
    }
  }, [chatId, auth.currentUser]);

  const fetchParticipantsData = useCallback(async (participantIds: string[]) => {
    try {
      // Użyjemy Firebase users collection zamiast backend API
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const participantsInfo: ParticipantInfo[] = [];
      
      participantIds.forEach(participantId => {
        const userDoc = usersSnapshot.docs.find(doc => {
          const userData = doc.data();
          return userData.uid === participantId || userData.email === participantId;
        });
        
        if (userDoc) {
          const userData = userDoc.data();
          participantsInfo.push({
            uid: userData.uid || participantId,
            email: userData.email || '',
            firstName: userData.displayName?.split(' ')[0] || '',
            lastName: userData.displayName?.split(' ')[1] || '',
            role: userData.role || 'student'
          });
        } else {
          participantsInfo.push({
            uid: participantId,
            email: participantId.includes('@') ? participantId : '',
            firstName: '',
            lastName: '',
            role: 'student'
          });
        }
      });
      
      setParticipantsData(participantsInfo);
    } catch (error) {
      console.error("Błąd podczas pobierania danych uczestników:", error);
    }
  }, [db]);

  useEffect(() => {
    if (!chatId || messages.length === 0) return;
    
    const uniqueSenders = Array.from(new Set(messages.map(m => m.senderId)));
    const fetchUsers = async () => {
      const newUserMap: Record<string, UserInfo> = { ...userMap };
      
      await Promise.all(uniqueSenders.map(async (senderId) => {
        if (!newUserMap[senderId]) {
          if (auth.currentUser && senderId === auth.currentUser.uid) {
            newUserMap[senderId] = {
              uid: senderId,
              displayName: auth.currentUser.displayName || auth.currentUser.email || "Użytkownik",
              photoURL: auth.currentUser.photoURL || null,
              firstName: auth.currentUser.displayName?.split(" ")[0] || "",
              lastName: auth.currentUser.displayName?.split(" ")[1] || "",
              email: auth.currentUser.email || undefined
            };
          } else {
            const participant = participantsData.find(p => p.uid === senderId || p.email === senderId);
            if (participant) {
              newUserMap[senderId] = {
                uid: senderId,
                displayName: `${participant.firstName} ${participant.lastName}`.trim() || participant.email || "Nieznany użytkownik",
                photoURL: null,
                firstName: participant.firstName,
                lastName: participant.lastName,
                email: participant.email
              };
            } else {
              newUserMap[senderId] = {
                uid: senderId,
                displayName: "Nieznany użytkownik",
                photoURL: null
              };
            }
          }
        }
      }));
      
      setUserMap(newUserMap);
    };
    
    fetchUsers();
  }, [messages, chatId, auth.currentUser, participantsData, userMap]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || (!newMessage.trim() && !file)) return;
    
    setSending(true);
    let fileUrl = undefined;
    let fileType = undefined;
    let fileName = undefined;
    
    if (file) {
      const allowedTypes = ["image/jpeg", "image/png", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
      if (!allowedTypes.includes(file.type)) {
        alert("Dozwolone typy plików: jpg, png, pdf, docx, xlsx");
        setSending(false);
        return;
      }
      
      try {
        const storageRef = ref(storage, `courses/chatFiles/${chatId}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        fileUrl = await getDownloadURL(storageRef);
        fileType = file.type;
        fileName = file.name;
      } catch (error) {
        console.error("Błąd podczas uploadu pliku:", error);
        alert("Błąd podczas wysyłania pliku. Spróbuj ponownie.");
        setSending(false);
        return;
      }
    }
    
    const messageData: any = {
      senderId: user.uid || user.email || 'unknown',
      createdAt: serverTimestamp(),
    };
    
    if (newMessage.trim()) {
      messageData.text = newMessage;
    }
    
    if (fileUrl) {
      messageData.fileUrl = fileUrl;
      messageData.fileType = fileType;
      messageData.fileName = fileName;
    }
    
    try {
      await addDoc(collection(db, "groupChats", chatId, "messages"), messageData);
      setNewMessage("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Błąd podczas wysyłania wiadomości:", error);
      alert("Błąd podczas wysyłania wiadomości. Spróbuj ponownie.");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      const messagesContainer = document.querySelector('.messages-container');
      if (messagesContainer) {
        const isAtBottom = messagesContainer.scrollTop + messagesContainer.clientHeight >= messagesContainer.scrollHeight - 100;
        if (isAtBottom) {
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      }
    }
  }, [messages]);

  const addParticipant = async (userUid: string) => {
    if (!isTeacher) return;
    
    try {
      if (!userUid) {
        alert("Błąd: użytkownik nie ma przypisanego Firebase UID");
        return;
      }
      
      // Nie pozwól dodać samego siebie
      if (userUid === auth.currentUser?.uid) {
        alert("Nie możesz dodać samego siebie do czatu");
        return;
      }
      
      if (participants.includes(userUid)) {
        alert("Ten użytkownik jest już w czacie");
        return;
      }
      
      const newParticipants = [...participants, userUid];
      await updateDoc(doc(db, "groupChats", chatId), {
        participants: newParticipants
      });
    } catch (error) {
      console.error("Błąd podczas dodawania uczestnika:", error);
      alert("Błąd podczas dodawania uczestnika");
    }
  };

  const removeParticipant = async (userUid: string) => {
    if (!isTeacher) return;
    
    try {
      // Nie pozwól usunąć samego siebie
      if (userUid === auth.currentUser?.uid) {
        alert("Nie możesz usunąć samego siebie z czatu");
        return;
      }
      
      const newParticipants = participants.filter(p => p !== userUid);
      await updateDoc(doc(db, "groupChats", chatId), {
        participants: newParticipants
      });
    } catch (error) {
      console.error("Błąd podczas usuwania uczestnika:", error);
      alert("Błąd podczas usuwania uczestnika");
    }
  };

  const fetchFiles = useCallback(async () => {
    if (!chatId) return;
    
    try {
      setFilesLoading(true);
      const q = query(
        collection(db, "groupChats", chatId, "messages"),
        where("fileUrl", "!=", null),
        orderBy("fileUrl"),
        orderBy("createdAt", "desc")
      );
      
      const snapshot = await getDocs(q);
      const filesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).filter((msg) => (msg as Message).fileUrl);
      
      setFiles(filesList as Message[]);
    } catch (error) {
      console.error("Błąd podczas pobierania plików:", error);
    } finally {
      setFilesLoading(false);
    }
  }, [chatId, db]);

  useEffect(() => {
    fetchFiles();
  }, [chatId, fetchFiles]);

  useEffect(() => {
    if (messages.length > 0) {
      const newFiles = messages.filter(msg => msg.fileUrl);
      setFiles(newFiles);
    }
  }, [messages]);

  const participantMap: Record<string, ParticipantInfo> = {};
  participantsData.forEach(p => {
    if (p.uid) participantMap[p.uid] = p;
    if (p.email) participantMap[p.email] = p;
  });

  const formatTime = (timestamp: { seconds: number } | null) => {
    if (!timestamp || !timestamp.seconds) return '';
    return new Date(timestamp.seconds * 1000).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: { seconds: number } | null) => {
    if (!timestamp || !timestamp.seconds) return '';
    return new Date(timestamp.seconds * 1000).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full">
      {/* Header z przyciskiem powrotu */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => window.location.href = '/homelogin'}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Powrót
          </button>

          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {chatName}
          </h1>

          <div className="w-20"></div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{chatName}</h2>
                <p className="text-gray-600">{participants.length} uczestników</p>
              </div>
            </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{chatName}</h2>
            <p className="text-gray-600">{participants.length} uczestników</p>
          </div>
        </div>
        {isTeacher && (
          <button
            onClick={() => setShowManageParticipants(!showManageParticipants)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Settings className="h-4 w-4" />
            Zarządzaj
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-250px)]">
        {/* Chat Area */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg border border-gray-200 h-full flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 messages-container">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Ładowanie wiadomości...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">Brak wiadomości w tym czacie.</div>
              ) : (
                <>
                  {hasMoreMessages && (
                    <div className="text-center mb-4">
                      <button
                        onClick={loadMoreMessages}
                        className="text-blue-600 text-sm hover:underline px-3 py-1 rounded hover:bg-blue-50"
                      >
                        Załaduj starsze wiadomości
                      </button>
                    </div>
                  )}
                  
                  {messages.map((msg) => {
                    const isCurrentUser = auth.currentUser && msg.senderId === auth.currentUser.uid;
                    const sender = participantMap[msg.senderId] || {};
                    const displayName = isCurrentUser
                      ? 'Ty'
                      : (sender.firstName && sender.lastName
                          ? `${sender.firstName} ${sender.lastName}`
                          : sender.email || "Nieznany użytkownik");
                    return (
                      <div key={msg.id} className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex items-start gap-3 max-w-[80%] ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0">
                            {displayName[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`flex items-center gap-2 mb-1 ${isCurrentUser ? 'justify-end' : ''}`}> 
                              <span className={`font-medium text-sm ${isCurrentUser ? 'text-blue-600' : 'text-gray-800'}`}>{displayName}</span>
                              <span className="text-xs text-gray-400">{formatTime(msg.createdAt)}</span>
                            </div>
                            {msg.text && (
                              <div className={`rounded-lg px-3 py-2 text-sm break-words ${isCurrentUser ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"}`}>
                                {msg.text}
                              </div>
                            )}
                            {msg.fileUrl && (
                              <div className="mt-2">
                                <a 
                                  href={msg.fileUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm bg-blue-50 px-2 py-1 rounded"
                                >
                                  <Paperclip className="h-3 w-3" />
                                  {msg.fileName}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message Input */}
            <form onSubmit={handleSend} className="p-4 border-t border-gray-200">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Napisz wiadomość..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  maxLength={1000}
                  disabled={sending}
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  accept=".jpg,.jpeg,.png,.pdf,.docx,.xlsx"
                  className="hidden"
                  id="file-upload"
                  disabled={sending}
                />
                <label 
                  htmlFor="file-upload" 
                  className="cursor-pointer p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Paperclip className="h-5 w-5" />
                </label>
                {file && (
                  <span className="text-xs text-gray-600 max-w-[120px] truncate">{file.name}</span>
                )}
                <button
                  type="submit"
                  className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={(!newMessage.trim() && !file) || sending}
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </form>
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 h-full p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Uczestnicy ({participants.length})
              </h3>
            </div>
            
            {participantsLoading ? (
              <div className="text-center text-gray-500">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                Ładowanie...
              </div>
            ) : participantsData.length === 0 ? (
              <div className="text-center text-gray-500 text-sm">
                Brak danych uczestników
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {participantsData.map((participant, index) => {
                  const isCurrentUser = auth.currentUser && participant.uid === auth.currentUser.uid;
                  const displayName = participant.firstName && participant.lastName 
                    ? `${participant.firstName} ${participant.lastName}`
                    : participant.email;
                  
                  return (
                    <div key={`${participant.uid}-${index}`} className={`flex items-center justify-between p-2 rounded ${isCurrentUser ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <div className="flex items-center gap-2 flex-1">
                        <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-600">
                          {displayName[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate font-medium">
                            {isCurrentUser ? 'Ty' : displayName}
                          </div>
                          {participant.role && (
                            <div className="text-xs text-gray-500 truncate">
                              {participant.role === 'teacher' ? 'Nauczyciel' : 'Uczeń'}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {isTeacher && !isCurrentUser && showManageParticipants && (
                        <button
                          onClick={() => removeParticipant(participant.uid)}
                          className="text-red-500 hover:text-red-700 text-xs ml-2 p-1 hover:bg-red-50 rounded"
                          title="Usuń z czatu"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            {isTeacher && showManageParticipants && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Dodaj uczestnika</h4>
                <AddParticipantModal 
                  onAdd={addParticipant}
                  currentParticipants={participants}
                />
              </div>
            )}

            {/* Files Section */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">Pliki ({files.length})</h3>
              
              {filesLoading ? (
                <div className="text-center text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  Ładowanie...
                </div>
              ) : files.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-4">
                  Brak plików w tym czacie
                </div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {files.map((file) => {
                    const getFileIcon = (fileType: string) => {
                      if (fileType?.includes('image')) return '🖼️';
                      if (fileType?.includes('pdf')) return '📄';
                      if (fileType?.includes('word') || fileType?.includes('document')) return '📝';
                      if (fileType?.includes('excel') || fileType?.includes('spreadsheet')) return '📊';
                      return '📎';
                    };
                    
                    return (
                      <div key={file.id} className="bg-gray-50 rounded p-2 hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{getFileIcon(file.fileType || '')}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate" title={file.fileName}>
                              {file.fileName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatDate(file.createdAt)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-1">
                          <a
                            href={file.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            Otwórz
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

function AddParticipantModal({ 
  onAdd, 
  currentParticipants
}: { 
  onAdd: (uid: string) => void; 
  currentParticipants: string[]; 
}) {
  interface User {
    uid: string;
    email: string;
    displayName?: string;
    role?: string;
  }

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const users: User[] = [];
        
        usersSnapshot.docs.forEach(doc => {
          const userData = doc.data();
          if (userData.uid && 
              !currentParticipants.includes(userData.uid) && 
              userData.uid !== auth.currentUser?.uid &&
              userData.role === 'student') {
            users.push({
              uid: userData.uid,
              email: userData.email || '',
              displayName: userData.displayName || userData.email,
              role: userData.role
            });
          }
        });
        
        setAllUsers(users);
      } catch (error) {
        console.error("Błąd podczas pobierania użytkowników:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, [currentParticipants, auth.currentUser, db]);

  const filteredUsers = searchTerm.length >= 2 ? allUsers.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    const displayName = user.displayName?.toLowerCase() || '';
    const email = user.email?.toLowerCase() || '';
    
    return displayName.includes(searchLower) || email.includes(searchLower);
  }) : allUsers;

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
      <div className="mb-3">
        <input
          type="text"
          placeholder="Szukaj uczniów..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </div>
      
      {loading ? (
        <div className="text-center text-gray-500 text-sm">Ładowanie...</div>
      ) : (
        <div className="max-h-40 overflow-y-auto space-y-1">
          {filteredUsers.length === 0 ? (
            <div className="text-gray-500 text-sm text-center py-2">
              {searchTerm.length >= 2 ? 'Brak wyników' : 'Brak dostępnych uczniów'}
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div key={user.uid} className="flex items-center justify-between p-2 hover:bg-gray-100 rounded">
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">
                    {user.displayName}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {user.email}
                  </div>
                </div>
                <button
                  onClick={() => onAdd(user.uid)}
                  className="text-blue-600 hover:text-blue-700 text-xs font-medium ml-2 px-2 py-1 bg-blue-50 rounded"
                >
                  Dodaj
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

