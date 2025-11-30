'use client';
import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, storage } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Providers from '@/components/Providers';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';

function StudentProfileContent() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [userClass, setUserClass] = useState('');
  const [phone, setPhone] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      setLoading(true);
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setDisplayName(data.displayName || '');
        setEmail(data.email || '');
        setUserClass(data.class || '');
        setPhone(data.phone || '');
        setPhotoURL(data.photoURL || '');
      }
      setLoading(false);
    };
    fetchUserData();
  }, [user]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      setUploadError('Proszę wybrać plik obrazu (JPG, PNG)');
      return;
    }
    
    // Sprawdź rozmiar pliku (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Plik jest za duży. Maksymalny rozmiar to 5MB.');
      return;
    }
    
    try {
      setUploading(true);
      setUploadError(null);
      setUploadSuccess(false);
      
      console.log('Starting upload for user:', user.uid);
      
      // Dodaj timeout dla uploadu (30 sekund)
      const uploadPromise = new Promise(async (resolve, reject) => {
        try {
          const storageRef = ref(storage, `profile_photos/${user.uid}`);
          console.log('Storage ref created:', storageRef);
          
          await uploadBytes(storageRef, file);
          console.log('File uploaded successfully');
          
          const url = await getDownloadURL(storageRef);
          console.log('Download URL obtained:', url);
          
          await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
          console.log('Firestore updated');
          
          resolve(url);
        } catch (error) {
          reject(error);
        }
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Upload timeout - sprawdź reguły Firebase Storage')), 30000);
      });
      
      const url = await Promise.race([uploadPromise, timeoutPromise]) as string;
      
      setPhotoURL(url);
      setUploadSuccess(true);
      
      // Odśwież stronę po 2 sekundach
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      if (error.message.includes('timeout')) {
        setUploadError('Upload się zatrzymał. Sprawdź reguły Firebase Storage.');
      } else {
        setUploadError('Błąd podczas uploadu: ' + error.message);
      }
    } finally {
      setUploading(false);
    }
  };

  const formatPhoneNumber = (value: string): string => {
    // Usuń wszystkie znaki niebędące cyframi lub +
    const cleaned = value.replace(/[^\d+]/g, '');
    
    // Jeśli zaczyna się od +, zostaw jak jest
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    
    // Jeśli zaczyna się od 0, zamień na +48
    if (cleaned.startsWith('0')) {
      return '+48' + cleaned.substring(1);
    }
    
    // Jeśli zaczyna się od 48, dodaj +
    if (cleaned.startsWith('48')) {
      return '+' + cleaned;
    }
    
    // W przeciwnym razie dodaj +48
    return '+48' + cleaned;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Pozwól na wprowadzanie cyfr, spacji, + i -
    const cleaned = value.replace(/[^\d+\s-]/g, '');
    setPhone(cleaned);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    // Walidacja numeru telefonu (jeśli został wprowadzony)
    let formattedPhone = phone.trim();
    if (formattedPhone) {
      formattedPhone = formatPhoneNumber(formattedPhone);
      
      // Sprawdź czy numer jest poprawny (min. 9 cyfr po +48)
      const phoneRegex = /^\+48\d{9}$/;
      if (!phoneRegex.test(formattedPhone)) {
        setSaveMessage({ 
          type: 'error', 
          text: 'Nieprawidłowy format numeru telefonu. Użyj formatu: +48123456789 lub 123456789' 
        });
        setTimeout(() => setSaveMessage(null), 5000);
        return;
      }
    }
    
    try {
      setSaveMessage(null);
      const updateData: any = {
        displayName,
        class: userClass
      };
      
      // Dodaj telefon tylko jeśli został wprowadzony
      if (formattedPhone) {
        updateData.phone = formattedPhone;
      } else {
        // Jeśli pole jest puste, usuń telefon z bazy
        updateData.phone = '';
      }
      
      await updateDoc(doc(db, 'users', user.uid), updateData);
      
      // Zaktualizuj stan telefonu
      setPhone(formattedPhone);
      
      // Pokaż komunikat o sukcesie
      setSaveMessage({ 
        type: 'success', 
        text: 'Profil został zaktualizowany pomyślnie!' 
      });
      setTimeout(() => setSaveMessage(null), 5000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setSaveMessage({ 
        type: 'error', 
        text: 'Błąd podczas aktualizacji profilu: ' + (error instanceof Error ? error.message : 'Nieznany błąd')
      });
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6FB] flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-4 border-[#4067EC] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full">
      {/* Header z przyciskiem powrotu */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => window.location.href = '/homelogin'}
            className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm text-gray-700 rounded-lg hover:bg-white hover:shadow-lg transition-all duration-200 ease-in-out border border-white/20"
          >
            <ArrowLeft className="w-4 h-4" />
            Powrót do strony głównej
          </button>
          
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Profil ucznia
          </h1>
          
          <div className="w-20"></div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg p-6 mb-8 border border-white/20">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Profile Photo */}
              <div 
                className="relative w-32 h-32"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
              >
                {photoURL ? (
                  <Image
                    src={photoURL}
                    alt="Profile"
                    width={128}
                    height={128}
                    className="w-32 h-32 h-32 rounded-full object-cover border-4 border-[#4067EC]"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gray-300 flex items-center justify-center text-4xl font-bold text-gray-600 border-4 border-[#4067EC]">
                    {displayName ? displayName.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
                  </div>
                )}
              
                {/* Upload Overlay */}
                {hovered && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center cursor-pointer">
                    <div className="text-white text-center">
                      <div className="text-2xl mb-2">📷</div>
                      <div className="text-sm">Kliknij aby zmienić</div>
                    </div>
                  </div>
                )}
              
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 bg-[#4067EC] text-white p-2 rounded-full hover:bg-[#3050b3] transition-colors"
                  disabled={uploading}
                >
                {uploading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                ) : (
                  '📷'
                )}
              </button>
            </div>
            
            {/* Profile Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">{displayName || 'Brak nazwy'}</h1>
              <p className="text-gray-600 mb-1">{email}</p>
              {userClass && <p className="text-gray-600">Klasa: {userClass}</p>}
              
              {/* Upload Status */}
              {uploading && (
                <div className="mt-4 text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent inline-block mr-2"></div>
                  Uploadowanie zdjęcia...
                </div>
              )}
              
              {uploadSuccess && (
                <div className="mt-4 text-green-600">
                  ✅ Zdjęcie zostało zaktualizowane!
                </div>
              )}
              
              {uploadError && (
                <div className="mt-4 text-red-600">
                  ❌ {uploadError}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg p-6 border border-white/20">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Edycja profilu</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Imię i nazwisko
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-transparent"
                placeholder="Wprowadź imię i nazwisko"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                placeholder="Email (nie można zmienić)"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Klasa
              </label>
              <input
                type="text"
                value={userClass}
                onChange={(e) => setUserClass(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-transparent"
                placeholder="Wprowadź klasę"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Numer telefonu <span className="text-gray-500 text-xs">(opcjonalnie)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-transparent"
                placeholder="+48123456789 lub 123456789"
              />
              <p className="text-xs text-gray-500 mt-1">
                Numer telefonu jest używany do wysyłania powiadomień SMS o nowych wydarzeniach w kalendarzu.
              </p>
            </div>
          </div>
          
          {/* Komunikat o zapisaniu */}
          {saveMessage && (
            <div className={`mt-4 p-4 rounded-lg ${
              saveMessage.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-700' 
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              <div className="flex items-center gap-2">
                {saveMessage.type === 'success' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                <span>{saveMessage.text}</span>
              </div>
            </div>
          )}
          
          <div className="mt-6">
            <button
              onClick={handleSaveProfile}
              className="bg-[#4067EC] text-white px-6 py-2 rounded-lg hover:bg-[#3050b3] transition-colors font-medium"
            >
              Zapisz zmiany
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

export default function StudentProfilePage() {
  return (
    <Providers>
      <StudentProfileContent />
    </Providers>
  );
} 