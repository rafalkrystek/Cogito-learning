'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, getDocs, query, where, doc, getDoc, addDoc, serverTimestamp, updateDoc, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { MessageSquare, Send, Mail, FileText, Search, Plus, X, ChevronLeft } from 'lucide-react';
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
    // Ignore cache errors
  }
}

interface Contact {
  id: string;
  name: string;
  role: 'wychowawca' | 'sekretariat' | 'psycholog' | 'pedagog' | 'pedagog_specjalny';
  email?: string;
  phone?: string;
  avatar?: string;
  instructorType?: string; // Typ instruktora (wychowawca, tutor, nauczyciel_wspomagajacy)
  specialization?: string[]; // Specjalizacje nauczyciela
}

interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: any;
  read: boolean;
  subject?: string;
  emailSent?: boolean;
  parentEmail?: string;
  isReply?: boolean;
  originalMessageId?: string;
}

export default function ParentMessagesPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [subject, setSubject] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  // const [showHistory, setShowHistory] = useState(false); // Unused - commented out
  const [draft, setDraft] = useState<{ contactId: string | null; subject: string; content: string } | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<{ contactId: string; messages: Message[] } | null>(null);
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const contactDropdownRef = useRef<HTMLDivElement>(null);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' && window.innerWidth >= 1024);

  // Ładowanie szkicu z localStorage po załadowaniu kontaktów
  useEffect(() => {
    if (!user || contacts.length === 0) return;
    
    const savedDraft = localStorage.getItem(`message_draft_${user.uid}`);
    if (savedDraft) {
      try {
        const draftData = JSON.parse(savedDraft);
        setDraft(draftData);
        // Przywróć szkic jeśli istnieje i kontakt jest dostępny
        if (draftData.contactId) {
          const contact = contacts.find(c => c.id === draftData.contactId);
          if (contact) {
            setSelectedContact(contact);
            setSubject(draftData.subject || '');
            setMessageContent(draftData.content || '');
          } else {
            // Kontakt nie jest już dostępny - zachowaj tylko treść
            setSubject(draftData.subject || '');
            setMessageContent(draftData.content || '');
          }
        } else {
          // Brak wybranego kontaktu - przywróć tylko treść
          setSubject(draftData.subject || '');
          setMessageContent(draftData.content || '');
        }
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    }
  }, [user, contacts]);

  // Zapisywanie szkicu do localStorage
  useEffect(() => {
    if (!user) return;
    
    // Zapisz szkic tylko jeśli jest treść lub temat
    if (messageContent.trim() || subject.trim()) {
      const draftData = {
        contactId: selectedContact?.id || null,
        subject: subject,
        content: messageContent
      };
      localStorage.setItem(`message_draft_${user.uid}`, JSON.stringify(draftData));
      setDraft(draftData);
    } else {
      // Usuń szkic jeśli wszystko jest puste
      localStorage.removeItem(`message_draft_${user.uid}`);
      setDraft(null);
    }
  }, [subject, messageContent, selectedContact, user]);

  const fetchContacts = useCallback(async () => {
    if (!user) return;

    const cacheKey = `parent_contacts_${user.uid}`;
    const cached = getSessionCache<Contact[]>(cacheKey);
    
    if (cached) {
      setContacts(cached);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      await measureAsync('ParentMessages:fetchContacts', async () => {
        // Znajdź przypisanego ucznia
        const parentStudentsSnapshot = await getDocs(query(collection(db, 'parent_students'), where('parent', '==', user.uid)));

        if (parentStudentsSnapshot.empty) {
          setLoading(false);
          return;
        }

        const foundStudentId = parentStudentsSnapshot.docs[0].data().student;

        // Pobierz dane ucznia
        const studentDoc = await getDoc(doc(db, 'users', foundStudentId));
        if (!studentDoc.exists()) {
          setLoading(false);
          return;
        }

        const studentData = studentDoc.data();
        const contactsList: Contact[] = [];

        // Wychowawca - znajdź z klasy ucznia
        if (studentData.classes && studentData.classes.length > 0) {
          const classesRef = collection(db, 'classes');
          const classSnapshot = await getDocs(query(classesRef, limit(100)));
          
          // Filtruj klasy do których należy uczeń
          const studentClasses = classSnapshot.docs.filter(classDoc => {
            const classData = classDoc.data();
            return (studentData.classes && studentData.classes.includes(classDoc.id)) || 
                   (classData.students && classData.students.includes(foundStudentId));
          });
          
          // Pobierz wszystkich nauczycieli równolegle (N+1 fix)
          const teacherIds = new Set<string>();
          studentClasses.forEach(classDoc => {
            const classData = classDoc.data();
            if (classData.teacher_id) {
              teacherIds.add(classData.teacher_id);
            }
          });
          
          const teacherQueries = Array.from(teacherIds).slice(0, 50).map(teacherId =>
            getDoc(doc(db, 'users', teacherId))
          );
          const teacherDocs = await Promise.all(teacherQueries);
          
          teacherDocs.forEach(teacherDoc => {
            if (teacherDoc.exists()) {
              const teacherData = teacherDoc.data();
              // Sprawdź czy kontakt już nie istnieje
              if (!contactsList.find(c => c.id === teacherDoc.id)) {
                const instructorType = teacherData.instructorType || 
                                      (teacherData.role === 'teacher' ? 'wychowawca' : null);
                
                contactsList.push({
                  id: teacherDoc.id,
                  name: teacherData.displayName || teacherData.email || 'Wychowawca',
                  role: 'wychowawca',
                  email: teacherData.email,
                  phone: teacherData.phone,
                  instructorType: instructorType,
                  specialization: teacherData.specialization || []
                });
              }
            }
          });
        }

        // Specjaliści - znajdź użytkowników z odpowiednimi rolami - równolegle
        const usersRef = collection(db, 'users');
        const specialists = [
          { role: 'psycholog' as const, dbRole: 'psycholog' },
          { role: 'pedagog' as const, dbRole: 'pedagog' },
          { role: 'pedagog_specjalny' as const, dbRole: 'pedagog' }
        ];

        const specialistQueries = specialists.map(specialist =>
          getDocs(query(usersRef, where('role', '==', specialist.dbRole), limit(50)))
        );
        const specialistSnapshots = await Promise.all(specialistQueries);
        
        specialistSnapshots.forEach((specialistSnapshot, index) => {
          const specialist = specialists[index];
          specialistSnapshot.docs.forEach(specDoc => {
            const specData = specDoc.data();
            // Sprawdź czy to właściwy specjalista (instructorType lub role)
            const isCorrectSpecialist = 
              specData.instructorType === specialist.role || 
              specData.role === specialist.dbRole ||
              (specialist.role === 'pedagog_specjalny' && specData.instructorType === 'pedagog_specjalny');
            
            if (isCorrectSpecialist && !contactsList.find(c => c.id === specDoc.id)) {
              contactsList.push({
                id: specDoc.id,
                name: specData.displayName || specialist.role,
                role: specialist.role,
                email: specData.email,
                phone: specData.phone,
                instructorType: specData.instructorType,
                specialization: specData.specialization || []
              });
            }
          });
        });

        setContacts(contactsList);
        setSessionCache(cacheKey, contactsList);
      });
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Zamykanie dropdowna po kliknięciu poza nim
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contactDropdownRef.current && !contactDropdownRef.current.contains(event.target as Node)) {
        setShowContactDropdown(false);
      }
    };

    if (showContactDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showContactDropdown]);

  const fetchSentMessages = useCallback(async () => {
    if (!user) return;

    const cacheKey = `parent_messages_${user.uid}`;
    const cached = getSessionCache<Message[]>(cacheKey);
    
    if (cached) {
      setSentMessages(cached);
      return;
    }

    try {
      await measureAsync('ParentMessages:fetchSentMessages', async () => {
        const messagesRef = collection(db, 'messages');
        // Pobierz wszystkie wiadomości gdzie rodzic jest nadawcą LUB odbiorcą - z limitem
        const [sentMessages, receivedMessages] = await Promise.all([
          getDocs(query(messagesRef, where('from', '==', user.uid), limit(100))),
          getDocs(query(messagesRef, where('to', '==', user.uid), limit(100)))
        ]);
        
        const allMessages = [
          ...sentMessages.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)),
          ...receivedMessages.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message))
        ];
        
        // Usuń duplikaty
        const uniqueMessages = allMessages.filter((msg, index, self) =>
          index === self.findIndex(m => m.id === msg.id)
        );
        
        // Grupuj wiadomości w konwersacje - znajdź najnowszą wiadomość z każdej konwersacji
        const conversations = new Map<string, Message>();
        
        uniqueMessages.forEach(msg => {
          const contactId = msg.from === user.uid ? msg.to : msg.from;
          if (!conversations.has(contactId)) {
            conversations.set(contactId, msg);
          } else {
            const existing = conversations.get(contactId)!;
            const existingTime = existing.timestamp?.toDate?.() || new Date(existing.timestamp);
            const msgTime = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
            if (msgTime > existingTime) {
              conversations.set(contactId, msg);
            }
          }
        });
        
        // Posortuj konwersacje po najnowszej wiadomości
        const conversationList = Array.from(conversations.values()).sort((a, b) => {
          const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp);
          const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp);
          return bTime.getTime() - aTime.getTime();
        });
        
        setSentMessages(conversationList);
        setSessionCache(cacheKey, conversationList);
      });
    } catch (error) {
      console.error('Error fetching sent messages:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchSentMessages();
    
    // Odświeżaj wiadomości co 30 sekund zamiast 5 sekund
    const interval = setInterval(fetchSentMessages, 30000);
    
    return () => clearInterval(interval);
  }, [fetchSentMessages]);

  const sendMessage = async () => {
    if (!messageContent.trim() || !selectedContact || !user || !selectedContact.email) {
      alert('Wypełnij wszystkie wymagane pola');
      return;
    }

    setSending(true);
    try {
      // Utwórz wiadomość w Firestore
      const messageRef = await addDoc(collection(db, 'messages'), {
        from: user.uid,
        to: selectedContact.id,
        content: messageContent,
        subject: subject || `Wiadomość od rodzica - ${getRoleLabel(selectedContact.role)}`,
        timestamp: serverTimestamp(),
        read: false,
        emailSent: false,
        parentEmail: user.email || '',
        parentName: user.displayName || '',
      });

      const messageId = messageRef.id;

      // Wyślij email przez API
      try {
        const emailResponse = await fetch('/api/send-parent-message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: selectedContact.email,
            subject: subject || `Wiadomość od rodzica - ${getRoleLabel(selectedContact.role)}`,
            body: messageContent,
            parentEmail: user.email || '',
            parentName: user.displayName || '',
            messageId: messageId,
          }),
        });

        if (!emailResponse.ok) {
          throw new Error('Błąd wysyłki emaila');
        }

        // Zaktualizuj wiadomość o status wysłania
        await updateDoc(doc(db, 'messages', messageId), {
          emailSent: true,
        });

        // Wyczyść formularz i szkic (ale zachowaj selectedContact)
        const contactIdToOpen = selectedContact.id;
        const contactToKeep = selectedContact;
        setSubject('');
        setMessageContent('');
        localStorage.removeItem(`message_draft_${user.uid}`);
        setDraft(null);
        
        // Odśwież listę wysłanych wiadomości
        await fetchSentMessages();
        
        // Jeśli była to nowa wiadomość, otwórz konwersację
        if (showNewMessage) {
          setShowNewMessage(false);
          // Pobierz wszystkie wiadomości w konwersacji
          const [sentMsgs, receivedMsgs] = await Promise.all([
            getDocs(query(collection(db, 'messages'), where('from', '==', user.uid), where('to', '==', contactIdToOpen))),
            getDocs(query(collection(db, 'messages'), where('from', '==', contactIdToOpen), where('to', '==', user.uid)))
          ]);
          
          const allConvMessages = [
            ...sentMsgs.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)),
            ...receivedMsgs.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message))
          ];
          
          const uniqueConvMessages = allConvMessages.filter((msg, index, self) =>
            index === self.findIndex(m => m.id === msg.id)
          );
          
          uniqueConvMessages.sort((a, b) => {
            const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp);
            const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp);
            return aTime.getTime() - bTime.getTime();
          });
          
          setSelectedConversation({ contactId: contactIdToOpen, messages: uniqueConvMessages });
          setSelectedContact(contactToKeep);
        } else if (selectedConversation && selectedConversation.contactId === contactIdToOpen) {
          // Odśwież aktualną konwersację
          const [sentMsgs, receivedMsgs] = await Promise.all([
            getDocs(query(collection(db, 'messages'), where('from', '==', user.uid), where('to', '==', contactIdToOpen))),
            getDocs(query(collection(db, 'messages'), where('from', '==', contactIdToOpen), where('to', '==', user.uid)))
          ]);
          
          const allConvMessages = [
            ...sentMsgs.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)),
            ...receivedMsgs.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message))
          ];
          
          const uniqueConvMessages = allConvMessages.filter((msg, index, self) =>
            index === self.findIndex(m => m.id === msg.id)
          );
          
          uniqueConvMessages.sort((a, b) => {
            const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp);
            const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp);
            return aTime.getTime() - bTime.getTime();
          });
          
          setSelectedConversation({ contactId: contactIdToOpen, messages: uniqueConvMessages });
        }
        
        // Nie pokazuj alertu - użytkownik widzi wiadomość w czacie
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        alert('Wiadomość została zapisana, ale wystąpił błąd podczas wysyłki emaila. Spróbuj ponownie.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Wystąpił błąd podczas wysyłania wiadomości');
    } finally {
      setSending(false);
    }
  };

  const getRoleLabel = useCallback((role: string) => {
    const labels: { [key: string]: string } = {
      'wychowawca': 'Wychowawca',
      'sekretariat': 'Sekretariat',
      'psycholog': 'Psycholog',
      'pedagog': 'Pedagog',
      'pedagog_specjalny': 'Pedagog specjalny'
    };
    return labels[role] || role;
  }, []);

  // Funkcja do formatowania opisu kontaktu z rolą i specjalizacją - memoized
  const getContactDescription = useCallback((contact: Contact) => {
    let description = `${contact.name} (${getRoleLabel(contact.role)})`;
    
    // Dodaj specjalizację jeśli nauczyciel ma instructorType
    if (contact.instructorType && contact.instructorType !== contact.role) {
      const instructorLabels: { [key: string]: string } = {
        'wychowawca': 'Wychowawca',
        'tutor': 'Tutor',
        'nauczyciel_wspomagajacy': 'Nauczyciel wspomagający',
        'pedagog_specjalny': 'Pedagog specjalny'
      };
      const instructorLabel = instructorLabels[contact.instructorType] || contact.instructorType;
      description += ` - ${instructorLabel}`;
    }
    
    // Dodaj specjalizacje jeśli są
    if (contact.specialization && contact.specialization.length > 0) {
      description += ` - ${contact.specialization.join(', ')}`;
    }
    
    // Dodaj email jeśli jest
    if (contact.email) {
      description += ` - ${contact.email}`;
    }
    
    return description;
  }, [getRoleLabel]);

  const getContactName = useCallback((contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return 'Nieznany odbiorca';
    
    // Zwróć nazwę z rolą i specjalizacją
    let name = `${contact.name} (${getRoleLabel(contact.role)})`;
    
    // Dodaj specjalizację jeśli jest
    if (contact.specialization && contact.specialization.length > 0) {
      name += ` - ${contact.specialization.join(', ')}`;
    }
    
    return name;
  }, [contacts, getRoleLabel]);

  // Filtruj kontakty - memoized (PRZED warunkowym returnem!)
  const filteredContacts = useMemo(() => {
    if (!contactSearchTerm && !selectedContact) return contacts;
    const searchTerm = contactSearchTerm.toLowerCase();
    return contacts.filter(contact => {
      const name = contact.name.toLowerCase();
      const role = getRoleLabel(contact.role).toLowerCase();
      const specialization = contact.specialization?.join(' ').toLowerCase() || '';
      const email = contact.email?.toLowerCase() || '';
      
      return name.includes(searchTerm) || 
             role.includes(searchTerm) || 
             specialization.includes(searchTerm) ||
             email.includes(searchTerm);
    });
  }, [contacts, contactSearchTerm, selectedContact, getRoleLabel]);

  // Get conversation list with last message
  const conversationsList = useMemo(() => {
    const convMap = new Map<string, { contactId: string; lastMessage: Message; contact: Contact | undefined }>();
    
    sentMessages.forEach(message => {
      const contactId = message.from === user?.uid ? message.to : message.from;
      const existing = convMap.get(contactId);
      const msgTime = message.timestamp?.toDate?.() || new Date(message.timestamp);
      
      if (!existing) {
        convMap.set(contactId, {
          contactId,
          lastMessage: message,
          contact: contacts.find(c => c.id === contactId)
        });
      } else {
        const existingTime = existing.lastMessage.timestamp?.toDate?.() || new Date(existing.lastMessage.timestamp);
        if (msgTime > existingTime) {
          convMap.set(contactId, { ...existing, lastMessage: message });
        }
      }
    });
    
    return Array.from(convMap.values()).sort((a, b) => {
      const aTime = a.lastMessage.timestamp?.toDate?.() || new Date(a.lastMessage.timestamp);
      const bTime = b.lastMessage.timestamp?.toDate?.() || new Date(b.lastMessage.timestamp);
      return bTime.getTime() - aTime.getTime();
    });
  }, [sentMessages, contacts, user]);

  if (loading) {
    return (
      <div className="h-screen overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#4067EC] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Ładowanie wiadomości...</p>
        </div>
      </div>
    );
  }

  const activeContact = selectedConversation 
    ? contacts.find(c => c.id === selectedConversation.contactId)
    : selectedContact;

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full">
      {/* Mobile Header */}
      <div className="lg:hidden flex-shrink-0 bg-white/90 backdrop-blur-lg border-b border-white/20 px-4 py-3 flex items-center gap-3">
        {selectedConversation || showNewMessage ? (
          <button
            onClick={() => {
              setSelectedConversation(null);
              setShowNewMessage(false);
              setSelectedContact(null);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
        ) : (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MessageSquare className="w-5 h-5 text-[#4067EC]" />
          </button>
        )}
        <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex-1">
          Wiadomości
        </h1>
        {!selectedConversation && !showNewMessage && (
          <button
            onClick={() => {
              setShowNewMessage(true);
              setSelectedConversation(null);
            }}
            className="p-2 bg-[#4067EC] text-white rounded-lg hover:bg-[#3050b3] transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:flex flex-shrink-0 bg-white/90 backdrop-blur-lg border-b border-white/20 px-6 py-4 items-center justify-between">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Wiadomości
        </h1>
        <button
          onClick={() => {
            setShowNewMessage(true);
            setSelectedConversation(null);
            setSelectedContact(null);
          }}
          className="px-4 py-2 bg-gradient-to-r from-[#4067EC] to-[#5577FF] text-white rounded-lg hover:from-[#3050b3] hover:to-[#4067EC] transition-all flex items-center gap-2 shadow-lg"
        >
          <Plus className="w-5 h-5" />
          <span>Nowa wiadomość</span>
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex min-h-0 relative">
        {/* Sidebar - Lista konwersacji */}
        <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 absolute lg:relative inset-y-0 left-0 z-40 w-80 bg-white/95 backdrop-blur-xl border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out flex-shrink-0 h-full`}>
          <div className="flex-shrink-0 p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={contactSearchTerm}
                onChange={(e) => setContactSearchTerm(e.target.value)}
                placeholder="Szukaj konwersacji..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-transparent text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-hidden min-h-0">
            {conversationsList.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-xs">Brak konwersacji</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                {conversationsList.map((conv) => {
                  const isActive = selectedConversation?.contactId === conv.contactId;
                  return (
                    <button
                      key={conv.contactId}
                      onClick={async () => {
                        const [sentMsgs, receivedMsgs] = await Promise.all([
                          getDocs(query(collection(db, 'messages'), where('from', '==', user?.uid), where('to', '==', conv.contactId))),
                          getDocs(query(collection(db, 'messages'), where('from', '==', conv.contactId), where('to', '==', user?.uid)))
                        ]);
                        
                        const allConvMessages = [
                          ...sentMsgs.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)),
                          ...receivedMsgs.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message))
                        ];
                        
                        const uniqueConvMessages = allConvMessages.filter((msg, index, self) =>
                          index === self.findIndex(m => m.id === msg.id)
                        );
                        
                        uniqueConvMessages.sort((a, b) => {
                          const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp);
                          const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp);
                          return aTime.getTime() - bTime.getTime();
                        });
                        
                        setSelectedConversation({ contactId: conv.contactId, messages: uniqueConvMessages });
                        if (conv.contact) {
                          setSelectedContact(conv.contact);
                        }
                        setShowNewMessage(false);
                        setSidebarOpen(false);
                      }}
                      className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                        isActive ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-[#4067EC]' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-[#4067EC] to-[#5577FF] flex items-center justify-center text-white font-semibold text-lg">
                          {conv.contact?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-semibold text-gray-900 truncate text-sm">
                              {conv.contact?.name || getContactName(conv.contactId)}
                            </h3>
                            <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                              {conv.lastMessage.timestamp?.toDate?.()?.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) || 
                               new Date(conv.lastMessage.timestamp).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {conv.lastMessage.from === user?.uid ? 'Ty: ' : ''}
                            {conv.lastMessage.content.substring(0, 60)}
                            {conv.lastMessage.content.length > 60 ? '...' : ''}
                          </p>
                          {conv.contact && (
                            <p className="text-xs text-gray-500 mt-1">
                              {getRoleLabel(conv.contact.role)}
                            </p>
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

        {/* Overlay dla mobile */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Główny obszar czatu */}
        <div className="flex-1 flex flex-col min-h-0 bg-white/50 backdrop-blur-sm">
          {showNewMessage ? (
            /* Formularz nowej wiadomości */
            <div className="flex-1 overflow-hidden min-h-0 p-2 sm:p-3">
              <div className="max-w-2xl mx-auto h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-3 flex-shrink-0">
                    <h2 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
                      <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-[#4067EC]" />
                      Nowa wiadomość
                    </h2>
                    <button
                      onClick={() => {
                        setShowNewMessage(false);
                        setSelectedContact(null);
                        setSubject('');
                        setMessageContent('');
                      }}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>

                  <div className="space-y-2">
              {/* Odbiorca */}
              <div className="relative" ref={contactDropdownRef}>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Odbiorca <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={selectedContact ? getContactDescription(selectedContact) : contactSearchTerm}
                    onChange={(e) => {
                      setContactSearchTerm(e.target.value);
                      setShowContactDropdown(true);
                      if (selectedContact && e.target.value !== getContactDescription(selectedContact)) {
                        setSelectedContact(null);
                      }
                    }}
                    onFocus={() => setShowContactDropdown(true)}
                    placeholder="Wyszukaj..."
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-transparent bg-white text-gray-900 text-sm"
                    style={{ fontSize: '14px' }}
                    required
                  />
                  {showContactDropdown && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto mt-1 scrollbar-thin">
                      {filteredContacts.slice(0, 50).map(contact => (
                          <button
                            key={contact.id}
                            type="button"
                            onClick={() => {
                              setSelectedContact(contact);
                              setContactSearchTerm('');
                              setShowContactDropdown(false);
                            }}
                            className="w-full px-2 py-2 text-left hover:bg-blue-50 transition-colors border-b border-gray-200 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900 text-xs">{contact.name}</div>
                            <div className="text-xs text-gray-600">
                              {getRoleLabel(contact.role)}
                              {contact.specialization && contact.specialization.length > 0 && (
                                <span className="ml-1">- {contact.specialization.join(', ')}</span>
                              )}
                            </div>
                            {contact.email && (
                              <div className="text-[10px] text-gray-500 mt-0.5">{contact.email}</div>
                            )}
                          </button>
                        ))}
                      {filteredContacts.length === 0 && (
                        <div className="px-2 py-2 text-xs text-gray-500 text-center">
                          Brak wyników
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {selectedContact && !selectedContact.email && (
                  <p className="mt-1 text-xs text-red-600 bg-red-50 p-1.5 rounded-lg">
                    ⚠️ Brak email
                  </p>
                )}
              </div>

              {/* Temat */}
              <div className="flex-shrink-0">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Temat
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Temat (opcjonalnie)"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-transparent text-sm"
                  style={{ fontSize: '14px' }}
                />
              </div>

              {/* Treść wiadomości */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Treść wiadomości <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Napisz swoją wiadomość..."
                  rows={6}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-transparent resize-none text-sm"
                  style={{ fontSize: '14px' }}
                  required
                />
              </div>

              {/* Szkic wiadomości */}
              {draft && (draft.content.trim() || draft.subject.trim()) && (
                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3 h-3 text-yellow-600 flex-shrink-0" />
                    <p className="text-xs text-yellow-800">
                      <strong>Szkic zapisany.</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (draft.contactId) {
                        const contact = contacts.find(c => c.id === draft.contactId);
                        if (contact) {
                          setSelectedContact(contact);
                        }
                      }
                      setSubject(draft.subject);
                      setMessageContent(draft.content);
                    }}
                    className="text-xs text-yellow-700 hover:text-yellow-900 font-medium underline whitespace-nowrap"
                  >
                    Przywróć
                  </button>
                </div>
              )}

              {/* Informacja */}
              <div className="p-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg flex-shrink-0">
                <p className="text-xs text-blue-800">
                  <strong>💡</strong> Wiadomość zostanie wysłana na email.
                </p>
              </div>

                    {/* Przycisk wysyłania */}
                    <div className="flex justify-end pt-2 flex-shrink-0">
                      <button
                        onClick={async () => {
                          await sendMessage();
                          setShowNewMessage(false);
                        }}
                        disabled={sending || !messageContent.trim() || !selectedContact?.email}
                        className="px-4 py-2 bg-gradient-to-r from-[#4067EC] to-[#5577FF] text-white rounded-lg hover:from-[#3050b3] hover:to-[#4067EC] transition-all disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium shadow-md"
                      >
                        {sending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
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
              </div>
            </div>
          ) : selectedConversation ? (
            /* Główny obszar czatu */
            <div className="flex-1 flex flex-col min-h-0">
              {/* Header konwersacji */}
              <div className="flex-shrink-0 bg-white/90 backdrop-blur-lg border-b border-gray-200 px-4 sm:px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4067EC] to-[#5577FF] flex items-center justify-center text-white font-semibold">
                    {activeContact?.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-gray-900">
                      {activeContact?.name || getContactName(selectedConversation.contactId)}
                    </h2>
                    {activeContact && (
                      <p className="text-sm text-gray-500">{getRoleLabel(activeContact.role)}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Obszar wiadomości */}
              <div className="flex-1 overflow-hidden min-h-0 p-4 sm:p-6 bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30">
                <div className="max-w-4xl mx-auto space-y-4 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                  {selectedConversation.messages.map((msg) => {
                    const isFromMe = msg.from === user?.uid;
                    const msgTime = msg.timestamp?.toDate?.() || new Date(msg.timestamp);
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isFromMe ? 'justify-end' : 'justify-start'} items-end gap-2`}
                      >
                        {!isFromMe && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4067EC] to-[#5577FF] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                            {activeContact?.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                        <div className="flex flex-col max-w-[75%] sm:max-w-md">
                          <div
                            className={`px-4 py-3 rounded-2xl shadow-sm ${
                              isFromMe
                                ? 'bg-gradient-to-r from-[#4067EC] to-[#5577FF] text-white rounded-br-md'
                                : 'bg-white text-gray-900 border border-gray-200 rounded-bl-md'
                            }`}
                          >
                            <div className="text-sm whitespace-pre-wrap break-words">
                              {msg.content}
                            </div>
                            {msg.subject && !isFromMe && (
                              <div className={`mt-2 text-xs pt-2 border-t ${isFromMe ? 'border-white/30' : 'border-gray-200'}`}>
                                <strong>Temat:</strong> {msg.subject}
                              </div>
                            )}
                          </div>
                          <span className={`text-xs mt-1 px-1 ${isFromMe ? 'text-right text-gray-500' : 'text-gray-500'}`}>
                            {msgTime.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {isFromMe && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                            {user?.displayName?.charAt(0).toUpperCase() || 'T'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Input do pisania */}
              <div className="flex-shrink-0 bg-white/90 backdrop-blur-lg border-t border-gray-200 p-4">
                <div className="max-w-4xl mx-auto">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendMessage();
                    }}
                    className="flex items-end gap-3"
                  >
                    <div className="flex-1">
                      <textarea
                        value={messageContent}
                        onChange={(e) => setMessageContent(e.target.value)}
                        placeholder="Napisz wiadomość..."
                        rows={1}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4067EC] focus:border-transparent resize-none text-base"
                        style={{ fontSize: '16px', minHeight: '48px', maxHeight: '120px' }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (messageContent.trim() && selectedContact?.email) {
                              sendMessage();
                            }
                          }
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={sending || !messageContent.trim() || !selectedContact?.email}
                      className="p-3 bg-gradient-to-r from-[#4067EC] to-[#5577FF] text-white rounded-xl hover:from-[#3050b3] hover:to-[#4067EC] transition-all disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center justify-center shadow-lg hover:shadow-xl"
                    >
                      {sending ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            /* Pusty stan - wybierz konwersację */
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#4067EC] to-[#5577FF] flex items-center justify-center">
                  <MessageSquare className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Wybierz konwersację</h2>
                <p className="text-gray-600 mb-6">
                  Wybierz konwersację z listy po lewej stronie lub utwórz nową wiadomość
                </p>
                <button
                  onClick={() => setShowNewMessage(true)}
                  className="px-6 py-3 bg-gradient-to-r from-[#4067EC] to-[#5577FF] text-white rounded-lg hover:from-[#3050b3] hover:to-[#4067EC] transition-all flex items-center gap-2 mx-auto shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  <span>Nowa wiadomość</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
