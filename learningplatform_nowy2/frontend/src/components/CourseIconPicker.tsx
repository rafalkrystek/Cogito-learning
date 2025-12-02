'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Search, X } from 'lucide-react';
import { FaImage } from 'react-icons/fa';

interface CourseIcon {
  id: string;
  name: string;
  url: string;
  category?: string;
}

interface CourseIconPickerProps {
  selectedIconUrl?: string;
  onIconSelect: (iconUrl: string) => void;
  label?: string;
}

export default function CourseIconPicker({
  selectedIconUrl,
  onIconSelect,
  label = 'Wybierz ikonę kursu'
}: CourseIconPickerProps) {
  const [icons, setIcons] = useState<CourseIcon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lista ikon z lokalnego katalogu - useMemo zapobiega rekre acji tablicy przy każdym renderze
  const localIcons: CourseIcon[] = React.useMemo(() => [
    { id: 'biologia', name: 'Biologia', url: '/course-icons/Biologia.png', category: 'Nauki przyrodnicze' },
    { id: 'biznes', name: 'Biznes i zarządzanie', url: '/course-icons/Biznes i zarządzanie.png', category: 'Biznes' },
    { id: 'chemia', name: 'Chemia', url: '/course-icons/Chemia.png', category: 'Nauki przyrodnicze' },
    { id: 'dietetyka', name: 'Dietetyka', url: '/course-icons/Dietetyka.png', category: 'Zdrowie' },
    { id: 'dziennikarstwo', name: 'Dziennikarstwo', url: '/course-icons/Dziennikarstwo.png', category: 'Media' },
    { id: 'edukacja-bezpieczenstwa', name: 'Edukacja dla bezpieczeństwa', url: '/course-icons/Edukacja dla bezpieczeństwa.png', category: 'Edukacja' },
    { id: 'filozofia', name: 'Filozofia', url: '/course-icons/Filozofia.png', category: 'Humanistyka' },
    { id: 'fizyka', name: 'Fizyka', url: '/course-icons/Fizyka.png', category: 'Nauki ścisłe' },
    { id: 'geografia', name: 'Geografia', url: '/course-icons/Geografia.png', category: 'Nauki społeczne' },
    { id: 'gotowanie', name: 'Gotowanie', url: '/course-icons/Gotowanie.png', category: 'Życie codzienne' },
    { id: 'historia-terazniejszosc', name: 'Historia i Teraźniejszość', url: '/course-icons/Historia i Teraźniejszość.png', category: 'Historia' },
    { id: 'historia', name: 'Historia', url: '/course-icons/Historia.png', category: 'Historia' },
    { id: 'ikigai', name: 'Ikigai', url: '/course-icons/Ikigai.png', category: 'Rozwój osobisty' },
    { id: 'informatyka', name: 'Informatyka', url: '/course-icons/Informatyka.png', category: 'Technologia' },
    { id: 'jezyk-angielski', name: 'Język angielski', url: '/course-icons/Język angielski.png', category: 'Języki obce' },
    { id: 'jezyk-hiszpanski', name: 'Język hiszpański', url: '/course-icons/Język hiszpański.png', category: 'Języki obce' },
    { id: 'jezyk-polski', name: 'Język Polski', url: '/course-icons/Język Polski.png', category: 'Języki' },
    { id: 'kreacje', name: 'Kreacje', url: '/course-icons/Kreacje.png', category: 'Sztuka' },
    { id: 'matematyka', name: 'Matematyka', url: '/course-icons/Matematyka.png', category: 'Nauki ścisłe' },
    { id: 'mikroekspresja', name: 'Mikroekspresja', url: '/course-icons/Mikroekspresja.png', category: 'Psychologia' },
    { id: 'mindfulness', name: 'Mindfulness', url: '/course-icons/Mindfulness.png', category: 'Rozwój osobisty' },
    { id: 'neurodydaktyka', name: 'Neurodydaktyka', url: '/course-icons/Neurodydaktyka.png', category: 'Edukacja' },
    { id: 'pedagogika', name: 'Pedagogika', url: '/course-icons/Pedagogika.png', category: 'Edukacja' },
    { id: 'podstawy-prawa', name: 'Podstawy prawa', url: '/course-icons/Podstawy prawa.png', category: 'Prawo' },
    { id: 'podstawy-przedsiebiorczosci', name: 'Podstawy przedsiębiorczości', url: '/course-icons/Podstawy przedsiębiorczości.png', category: 'Biznes' },
    { id: 'psychologia', name: 'Psychologia', url: '/course-icons/Psychologia.png', category: 'Psychologia' },
    { id: 'rodzicielstwo', name: 'Rodzicielstwo', url: '/course-icons/Rodzicielstwo.png', category: 'Życie codzienne' },
    { id: 'rysunek', name: 'Rysunek', url: '/course-icons/Rysunek.png', category: 'Sztuka' },
    { id: 'social-media', name: 'Social media', url: '/course-icons/Social media\'.png', category: 'Media' },
    { id: 'szachy', name: 'Szachy', url: '/course-icons/Szachy.png', category: 'Rozrywka' },
    { id: 'wychowanie-fizyczne', name: 'Wychowanie fizyczne', url: '/course-icons/Wychowanie fizyczne.png', category: 'Sport' },
    { id: 'zarzadzanie', name: 'Zarządzanie', url: '/course-icons/Zarządzenie.png', category: 'Biznes' }
  ], []);

  useEffect(() => {
    const initializeIcons = async () => {
      try {
        // Sprawdź czy ikony są już w Firestore
        const iconsRef = collection(db, 'courseIcons');
        const snapshot = await getDocs(iconsRef);
        
        if (snapshot.empty) {
          // Jeśli nie ma ikon w Firestore, dodaj je
          const batch = localIcons.map(icon => 
            setDoc(doc(db, 'courseIcons', icon.id), {
              name: icon.name,
              url: icon.url,
              category: icon.category,
              createdAt: new Date().toISOString()
            })
          );
          await Promise.all(batch);
          setIcons(localIcons);
        } else {
          // Pobierz ikony z Firestore
          const firestoreIcons: CourseIcon[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            firestoreIcons.push({
              id: doc.id,
              name: data.name,
              url: data.url,
              category: data.category
            });
          });
          setIcons(firestoreIcons.sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch (error) {
        console.error('Error initializing icons:', error);
        // Fallback do lokalnych ikon
        setIcons(localIcons);
      } finally {
        setLoading(false);
      }
    };

    initializeIcons();
  }, [localIcons]);

  const filteredIcons = icons.filter(icon =>
    icon.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    icon.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedIcon = icons.find(icon => icon.url === selectedIconUrl);

  const renderModal = () => {
    if (!showPicker || !mounted) return null;
    
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ position: 'fixed' }}>
        {/* Backdrop with glassmorphism */}
        <div 
          className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm"
          onClick={() => setShowPicker(false)}
        ></div>
        {/* Modal Content with glassmorphism */}
        <div 
          className="relative z-[10000] w-full max-w-4xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 max-h-[85vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header with close button */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <FaImage className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Wybierz ikonę kursu</h3>
          </div>
          <button
            onClick={() => setShowPicker(false)}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors group"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200" />
          </button>
        </div>
        
        {/* Content with scroll */}
        <div className="flex-1 overflow-y-auto p-6">
        
          {/* Search */}
          <div className="mb-6 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Szukaj ikony..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Icons Grid */}
          {loading ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
              Ładowanie ikon...
            </div>
          ) : filteredIcons.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <p className="text-lg font-medium">Nie znaleziono ikon</p>
              <p className="text-sm mt-2">Spróbuj zmienić kryteria wyszukiwania</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredIcons.map((icon) => (
                <button
                  key={icon.id}
                  type="button"
                  onClick={() => {
                    onIconSelect(icon.url);
                    setShowPicker(false);
                    setSearchTerm('');
                  }}
                  className={`
                    p-4 rounded-xl border-2 transition-all duration-200
                    hover:scale-105 hover:shadow-lg bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm
                    ${
                      selectedIconUrl === icon.url
                        ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-900/30 shadow-md'
                        : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                    }
                  `}
                >
                  <div className="w-full aspect-square relative mb-3 bg-white/50 dark:bg-gray-800/50 rounded-lg p-2">
                    <Image
                      src={icon.url}
                      alt={icon.name}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="text-xs text-center text-gray-700 dark:text-gray-300 font-medium truncate">
                    {icon.name}
                  </div>
                  {icon.category && (
                    <div className="text-[10px] text-center text-gray-500 dark:text-gray-400 mt-1 truncate">
                      {icon.category}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>,
      document.body
    );
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      
      {/* Selected Icon Preview */}
      <div className="mb-3">
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="flex items-center gap-3 p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors w-full"
        >
          {selectedIcon ? (
            <>
              <div className="w-12 h-12 relative flex-shrink-0">
                <Image
                  src={selectedIcon.url}
                  alt={selectedIcon.name}
                  fill
                  className="object-contain"
                />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-900 dark:text-white">{selectedIcon.name}</div>
                {selectedIcon.category && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">{selectedIcon.category}</div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 text-left text-gray-500 dark:text-gray-400">
              Kliknij aby wybrać ikonę
            </div>
          )}
          <div className="text-gray-400 dark:text-gray-500">
            {showPicker ? <X className="w-5 h-5" /> : '▼'}
          </div>
        </button>
      </div>

      {/* Icon Picker Modal */}
      {renderModal()}
    </div>
  );
}
