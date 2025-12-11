'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, getDocs, query, where, doc, getDoc, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { MessageSquare, Send, User, Mail, FileText, Clock } from 'lucide-react';

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
  const [showHistory, setShowHistory] = useState(false);
  const [draft, setDraft] = useState<{ contactId: string | null; subject: string; content: string } | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<{ contactId: string; messages: Message[] } | null>(null);
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const contactDropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!user) return;

    const fetchContacts = async () => {
      try {
        setLoading(true);
        
        // Znajdź przypisanego ucznia
        const parentStudentsRef = collection(db, 'parent_students');
        const parentStudentsQuery = query(parentStudentsRef, where('parent', '==', user.uid));
        const parentStudentsSnapshot = await getDocs(parentStudentsQuery);

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
          const classSnapshot = await getDocs(classesRef);
          
          // Filtruj klasy do których należy uczeń
          const studentClasses = classSnapshot.docs.filter(classDoc => {
            const classData = classDoc.data();
            return (studentData.classes && studentData.classes.includes(classDoc.id)) || 
                   (classData.students && classData.students.includes(foundStudentId));
          });
          
          for (const classDoc of studentClasses) {
            const classData = classDoc.data();
            if (classData.teacher_id) {
              const teacherDoc = await getDoc(doc(db, 'users', classData.teacher_id));
              if (teacherDoc.exists()) {
                const teacherData = teacherDoc.data();
                // Sprawdź czy kontakt już nie istnieje
                if (!contactsList.find(c => c.id === classData.teacher_id)) {
                  // Sprawdź czy nauczyciel ma specjalizację (instructorType lub role)
                  const instructorType = teacherData.instructorType || 
                                        (teacherData.role === 'teacher' ? 'wychowawca' : null);
                  
                  contactsList.push({
                    id: classData.teacher_id,
                    name: teacherData.displayName || teacherData.email || 'Wychowawca',
                    role: 'wychowawca',
                    email: teacherData.email,
                    phone: teacherData.phone,
                    instructorType: instructorType,
                    specialization: teacherData.specialization || []
                  });
                }
              }
            }
          }
        }

        // Specjaliści - znajdź użytkowników z odpowiednimi rolami
        const usersRef = collection(db, 'users');
        const specialists = [
          { role: 'psycholog' as const, dbRole: 'psycholog' },
          { role: 'pedagog' as const, dbRole: 'pedagog' },
          { role: 'pedagog_specjalny' as const, dbRole: 'pedagog' }
        ];

        for (const specialist of specialists) {
          const specialistQuery = query(usersRef, where('role', '==', specialist.dbRole));
          const specialistSnapshot = await getDocs(specialistQuery);
          
          for (const specDoc of specialistSnapshot.docs) {
            const specData = specDoc.data();
            // Sprawdź czy to właściwy specjalista (instructorType lub role)
            const isCorrectSpecialist = 
              specData.instructorType === specialist.role || 
              specData.role === specialist.dbRole ||
              (specialist.role === 'pedagog_specjalny' && specData.instructorType === 'pedagog_specjalny');
            
            if (isCorrectSpecialist) {
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
          }
        }

        setContacts(contactsList);
      } catch (error) {
        console.error('Error fetching contacts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, [user]);

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

  useEffect(() => {
    if (!user) return;

    const fetchSentMessages = async () => {
      try {
        const messagesRef = collection(db, 'messages');
        // Pobierz wszystkie wiadomości gdzie rodzic jest nadawcą LUB odbiorcą
        const [sentMessages, receivedMessages] = await Promise.all([
          getDocs(query(messagesRef, where('from', '==', user.uid))),
          getDocs(query(messagesRef, where('to', '==', user.uid)))
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
      } catch (error) {
        console.error('Error fetching sent messages:', error);
      }
    };

    fetchSentMessages();
    
    // Odświeżaj wiadomości co 5 sekund, aby zobaczyć nowe odpowiedzi
    const interval = setInterval(fetchSentMessages, 5000);
    
    return () => clearInterval(interval);
  }, [user]);

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

        // Wyczyść formularz i szkic
        setSubject('');
        setMessageContent('');
        setSelectedContact(null);
        localStorage.removeItem(`message_draft_${user.uid}`);
        setDraft(null);
        
        // Odśwież listę wysłanych wiadomości
        const messagesRef = collection(db, 'messages');
        const sentMessagesQuery = query(messagesRef, where('from', '==', user.uid));
        const sentMessagesSnapshot = await getDocs(sentMessagesQuery);
        const messagesList = sentMessagesSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Message))
          .sort((a, b) => {
            const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp);
            const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp);
            return bTime.getTime() - aTime.getTime();
          });
        setSentMessages(messagesList);
        
        alert('Wiadomość została wysłana pomyślnie!');
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

  const getRoleLabel = (role: string) => {
    const labels: { [key: string]: string } = {
      'wychowawca': 'Wychowawca',
      'sekretariat': 'Sekretariat',
      'psycholog': 'Psycholog',
      'pedagog': 'Pedagog',
      'pedagog_specjalny': 'Pedagog specjalny'
    };
    return labels[role] || role;
  };

  // Funkcja do formatowania opisu kontaktu z rolą i specjalizacją
  const getContactDescription = (contact: Contact) => {
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
  };

  const getContactName = (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return 'Nieznany odbiorca';
    
    // Zwróć nazwę z rolą i specjalizacją
    let name = `${contact.name} (${getRoleLabel(contact.role)})`;
    
    // Dodaj specjalizację jeśli jest
    if (contact.specialization && contact.specialization.length > 0) {
      name += ` - ${contact.specialization.join(', ')}`;
    }
    
    return name;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Wyślij wiadomość
        </h1>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-4xl mx-auto">
          {/* Formularz wysyłania */}
          <div className="bg-white rounded-xl shadow-lg border border-white/20 p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Mail className="w-6 h-6 text-blue-600" />
              Nowa wiadomość
            </h2>

            <div className="space-y-4">
              {/* Odbiorca */}
              <div className="relative" ref={contactDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                    placeholder="Wyszukaj po imieniu, nazwisku lub specjalizacji..."
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    required
                  />
                  {showContactDropdown && (
                    <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto mt-1">
                      {contacts
                        .filter(contact => {
                          if (!contactSearchTerm && !selectedContact) return true;
                          const searchTerm = contactSearchTerm.toLowerCase();
                          const name = contact.name.toLowerCase();
                          const role = getRoleLabel(contact.role).toLowerCase();
                          const specialization = contact.specialization?.join(' ').toLowerCase() || '';
                          const email = contact.email?.toLowerCase() || '';
                          
                          return name.includes(searchTerm) || 
                                 role.includes(searchTerm) || 
                                 specialization.includes(searchTerm) ||
                                 email.includes(searchTerm);
                        })
                        .map(contact => (
                          <button
                            key={contact.id}
                            type="button"
                            onClick={() => {
                              setSelectedContact(contact);
                              setContactSearchTerm('');
                              setShowContactDropdown(false);
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900 dark:text-gray-100">{contact.name}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {getRoleLabel(contact.role)}
                              {contact.specialization && contact.specialization.length > 0 && (
                                <span className="ml-2">- {contact.specialization.join(', ')}</span>
                              )}
                            </div>
                            {contact.email && (
                              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">{contact.email}</div>
                            )}
                          </button>
                        ))}
                      {contacts.filter(contact => {
                        if (!contactSearchTerm && !selectedContact) return true;
                        const searchTerm = contactSearchTerm.toLowerCase();
                        const name = contact.name.toLowerCase();
                        const role = getRoleLabel(contact.role).toLowerCase();
                        const specialization = contact.specialization?.join(' ').toLowerCase() || '';
                        const email = contact.email?.toLowerCase() || '';
                        
                        return name.includes(searchTerm) || 
                               role.includes(searchTerm) || 
                               specialization.includes(searchTerm) ||
                               email.includes(searchTerm);
                      }).length === 0 && (
                        <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                          Brak wyników wyszukiwania
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {selectedContact && !selectedContact.email && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    ⚠️ Ten kontakt nie ma przypisanego adresu email. Wiadomość nie zostanie wysłana.
                  </p>
                )}
              </div>

              {/* Temat */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temat
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Temat wiadomości (opcjonalnie)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              {/* Treść wiadomości */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Treść wiadomości <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Napisz swoją wiadomość..."
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none"
                  required
                />
              </div>

              {/* Szkic wiadomości */}
              {draft && (draft.content.trim() || draft.subject.trim()) && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-yellow-600" />
                    <p className="text-sm text-yellow-800">
                      <strong>Szkic wiadomości zapisany.</strong> Możesz kontynuować później.
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
                    className="text-sm text-yellow-700 hover:text-yellow-900 font-medium underline"
                  >
                    Przywróć szkic
                  </button>
                </div>
              )}

              {/* Informacja */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>💡 Uwaga:</strong> Wiadomość zostanie wysłana na email odbiorcy. 
                  Odpowiedź zobaczysz w historii wysłanych wiadomości poniżej. 
                  Wiadomości odświeżają się automatycznie.
                </p>
              </div>

              {/* Przycisk wysyłania */}
              <div className="flex justify-end">
                <button
                  onClick={sendMessage}
                  disabled={sending || !messageContent.trim() || !selectedContact?.email}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                >
                  {sending ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Wysyłanie...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      <span>Wyślij wiadomość</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Historia wysłanych wiadomości */}
          <div className="bg-white rounded-xl shadow-lg border border-white/20 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FileText className="w-6 h-6 text-blue-600" />
                Historia konwersacji
              </h2>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {showHistory ? 'Ukryj' : 'Pokaż'}
              </button>
            </div>

            {showHistory && (
              <div className="space-y-4">
                {sentMessages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>Brak konwersacji</p>
                  </div>
                ) : (
                  sentMessages.map((message) => {
                    const contactId = message.from === user?.uid ? message.to : message.from;
                    const contact = contacts.find(c => c.id === contactId);
                    const isSelected = selectedConversation?.contactId === contactId;
                    return (
                      <div
                        key={message.id}
                        className={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                          isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                        }`}
                        onClick={async () => {
                          // Pobierz wszystkie wiadomości w konwersacji
                          const [sentMsgs, receivedMsgs] = await Promise.all([
                            getDocs(query(collection(db, 'messages'), where('from', '==', user?.uid), where('to', '==', contactId))),
                            getDocs(query(collection(db, 'messages'), where('from', '==', contactId), where('to', '==', user?.uid)))
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
                          
                          setSelectedConversation({ contactId, messages: uniqueConvMessages });
                          if (contact) {
                            setSelectedContact(contact);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <User className="w-4 h-4 text-gray-500" />
                              <span className="font-semibold text-gray-800">
                                {getContactName(contactId)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {message.from === user?.uid ? 'Ty: ' : ''}{message.content.substring(0, 100)}{message.content.length > 100 ? '...' : ''}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>
                                  {message.timestamp?.toDate?.()?.toLocaleString('pl-PL') || 
                                   new Date(message.timestamp).toLocaleString('pl-PL')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
            
            {/* Wyświetl pełną konwersację */}
            {selectedConversation && (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Konwersacja z {getContactName(selectedConversation.contactId)}
                  </h3>
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Zamknij
                  </button>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto p-4 bg-gray-50 rounded-lg">
                  {selectedConversation.messages.map((msg) => {
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
                              : 'bg-white text-gray-800 border border-gray-200'
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
                  })}
                </div>
                
                {/* Formularz do kontynuowania konwersacji */}
                <div className="mt-4 border-t border-gray-200 pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kontynuuj konwersację:
                  </label>
                  <textarea
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    placeholder="Napisz wiadomość..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none"
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={sendMessage}
                      disabled={sending || !messageContent.trim() || !selectedContact?.email}
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
