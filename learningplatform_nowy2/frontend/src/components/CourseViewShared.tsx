"use client";
import React, { useState, useEffect } from 'react';
import { FaChevronDown, FaChevronUp, FaFilePdf, FaFolder, FaFolderOpen } from "react-icons/fa";
import { BookOpen, Calendar, GraduationCap, HelpCircle, Menu, X } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import YouTubePlayer from './YouTubePlayer';
import MathView from './MathView';
import ThemeToggle from './ThemeToggle';
import Image from 'next/image';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface CourseViewProps {
  course: any;
  sections: any[];
  quizzes: any[];
  isTeacherPreview?: boolean;
}

export const CourseViewShared: React.FC<CourseViewProps> = ({
  course,
  sections,
  quizzes,
  isTeacherPreview = false
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [showSection, setShowSection] = useState<{[id: string]: boolean}>({});
  const [showSubsection, setShowSubsection] = useState<{[id: string]: boolean}>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSidebarSection, setShowSidebarSection] = useState<{[id: string]: boolean}>({});
  const [quizTitles, setQuizTitles] = useState<{[quizId: string]: string}>({});
  const [quizAttempts, setQuizAttempts] = useState<{[quizId: string]: number}>({});

  // Pobierz nazwy quizów
  useEffect(() => {
    const fetchQuizTitles = async () => {
      const quizIds = new Set<string>();
      
      // Zbierz wszystkie quizId z sekcji
      sections.forEach((section: any) => {
        section.subsections?.forEach((subsection: any) => {
          subsection.contentBlocks?.forEach((block: any) => {
            if (block.type === 'quiz' && block.quizId) {
              quizIds.add(block.quizId);
            }
          });
        });
      });

      // Pobierz nazwy quizów z Firestore
      const titles: {[quizId: string]: string} = {};
      for (const quizId of Array.from(quizIds)) {
        try {
          const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
          if (quizDoc.exists()) {
            titles[quizId] = quizDoc.data().title || 'Quiz bez nazwy';
          }
        } catch (error) {
          console.error(`Error fetching quiz ${quizId}:`, error);
          titles[quizId] = 'Błąd wczytywania nazwy';
        }
      }
      
      setQuizTitles(titles);
    };

    fetchQuizTitles();
  }, [sections]);

  // Pobierz liczbę prób dla quizów
  useEffect(() => {
    const fetchQuizAttempts = async () => {
      if (!user || !quizzes.length) return;
      
      const attempts: {[quizId: string]: number} = {};
      
      for (const quiz of quizzes) {
        try {
          const attemptsQuery = query(
            collection(db, 'quiz_attempts'),
            where('user_id', '==', user.uid),
            where('quiz_id', '==', quiz.id)
          );
          const attemptsSnapshot = await getDocs(attemptsQuery);
          attempts[quiz.id] = attemptsSnapshot.size;
        } catch (error) {
          console.error(`Error fetching attempts for quiz ${quiz.id}:`, error);
          attempts[quiz.id] = 0;
        }
      }
      
      setQuizAttempts(attempts);
    };

    fetchQuizAttempts();
  }, [user, quizzes]);

  // Oblicz statystyki
  const stats = React.useMemo(() => {
    let totalSections = 0;
    let totalLessons = 0;
    let totalExams = 0;

    console.log('=== COURSE STRUCTURE DEBUG ===');
    console.log('Course:', course?.title || course?.name);
    console.log('Sections count:', sections.length);
    
    sections.forEach((section: any, sectionIndex: number) => {
      totalSections++;
      if (section.type === 'assignment') {
        totalExams++;
      }
      
      console.log(`Section ${sectionIndex}:`, {
        id: section.id,
        name: section.name,
        type: section.type,
        hasContents: !!section.contents,
        contentsLength: section.contents?.length || 0,
        hasSubsections: !!section.subsections,
        subsectionsLength: section.subsections?.length || 0
      });
      
      // Debug subsections
      if (section.subsections) {
        section.subsections.forEach((subsection: any, subIndex: number) => {
          console.log(`  Subsection ${subIndex}:`, {
            id: subsection.id,
            name: subsection.name,
            hasMaterials: !!subsection.materials,
            materialsLength: subsection.materials?.length || 0,
            hasContentBlocks: !!subsection.contentBlocks,
            contentBlocksLength: subsection.contentBlocks?.length || 0
          });
        });
      }
      
      // Licz lekcje z podsekcji (stary system) lub bezpośrednie materiały (nowy system)
      if (section.subsections && section.subsections.length > 0) {
        totalLessons += section.subsections.length;
      } else if (section.contents && section.contents.length > 0) {
        totalLessons += 1; // Każda sekcja z materiałami to jedna lekcja
      }
    });

    return {
      sections: totalSections,
      lessons: totalLessons,
      exams: totalExams,
      quizzes: quizzes.length
    };
  }, [sections, quizzes, course]);

  // Pobierz tylko egzaminy
  const exams = React.useMemo(() => {
    return sections
      .filter((section: any) => section.type === 'assignment')
      .map((section: any) => ({
        id: section.id,
        name: section.name,
        deadline: section.deadline,
        description: section.description
      }));
  }, [sections]);

  // Funkcja do scrollowania do sekcji
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Funkcja do scrollowania do lekcji
  const scrollToLesson = (sectionId: string, subsectionId: string) => {
    // Najpierw rozwiń sekcję
    setShowSection(prev => ({ ...prev, [sectionId]: true }));
    
    // Poczekaj na rozwinięcie, potem scroll
    setTimeout(() => {
      const element = document.getElementById(`lesson-${subsectionId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header with course info */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-4">
            <button
              onClick={() => {
                // Nauczyciel → /homelogin/teacher/courses
                // Uczeń → /homelogin/my-courses
                if (isTeacherPreview || user?.role === 'teacher') {
                  router.push('/homelogin/teacher/courses');
                } else {
                  router.push('/homelogin/my-courses');
                }
              }}
              className="text-white hover:text-gray-200 transition-colors flex items-center gap-2"
            >
              ← Powrót do moich kursów
            </button>
            <ThemeToggle />
          </div>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-3">{course?.title || 'Ładowanie...'}</h1>
              <p className="text-blue-100 text-lg">
                Nauczyciel: {course?.instructor_name || course?.teacherEmail || 'Brak informacji'}
              </p>
              {isTeacherPreview && (
                <div className="mt-3 inline-block bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  👁️ Tryb podglądu
                </div>
              )}
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 flex items-center justify-center">
              {course?.iconUrl ? (
                <div className="w-24 h-24 relative">
                  <Image
                    src={course.iconUrl}
                    alt={course.title || 'Course icon'}
                    fill
                    className="object-contain"
                  />
                </div>
              ) : (
                <div className="text-6xl mb-2">🎓</div>
              )}
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Postęp kursu</span>
              <span className="text-sm font-medium">0%</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3">
              <div 
                className="bg-white h-3 rounded-full transition-all duration-500"
                style={{ width: '0%' }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-all ${
                activeTab === 'overview'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <BookOpen className="h-5 w-5" />
              Przegląd
            </button>
            <button
              onClick={() => setActiveTab('exams')}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-all ${
                activeTab === 'exams'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <GraduationCap className="h-5 w-5" />
              Egzaminy
            </button>
            <button
              onClick={() => setActiveTab('quizzes')}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-all ${
                activeTab === 'quizzes'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <HelpCircle className="h-5 w-5" />
              Quizy
            </button>
          </div>
        </div>
      </div>

      {/* Content with Sidebar */}
      <div className="w-full px-4 lg:px-8 xl:px-12 2xl:px-16 py-8 flex gap-6 relative">
        {/* Sidebar - Table of Contents */}
        {activeTab === 'overview' && (
          <>
            {/* Mobile Toggle Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden fixed bottom-6 right-6 z-50 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
            >
              {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>

            {/* Sidebar */}
            <div
              className={`${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
              } lg:translate-x-0 fixed lg:sticky top-20 left-0 h-[calc(100vh-5rem)] w-80 lg:w-72 xl:w-80 bg-white rounded-2xl shadow-lg p-6 overflow-y-auto transition-transform duration-300 z-40 lg:z-0 flex-shrink-0`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Spis treści</h3>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-2">
                {sections.map((section: any) => (
                  <div key={section.id} className="border-l-2 border-gray-200 pl-3">
                    {/* Section in Sidebar */}
                    <button
                      onClick={() => {
                        setShowSidebarSection(prev => ({
                          ...prev,
                          [section.id]: !prev[section.id]
                        }));
                        scrollToSection(section.id);
                      }}
                      className="flex items-center justify-between w-full text-left py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-gray-400 group-hover:text-blue-600">
                          {showSidebarSection[section.id] ? <FaChevronUp className="h-3 w-3" /> : <FaChevronDown className="h-3 w-3" />}
                        </span>
                        <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 truncate">
                          {section.name}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {section.subsections?.reduce((total: number, sub: any) => total + (sub.materials?.length || sub.contentBlocks?.length || 0), 0) || 0}
                      </span>
                    </button>

                    {/* Subsections/Lessons in Sidebar */}
                    {showSidebarSection[section.id] && section.subsections && (
                      <div className="ml-4 mt-1 space-y-1">
                        {section.subsections.map((subsection: any) => (
                          <button
                            key={subsection.id}
                            onClick={() => {
                              scrollToLesson(section.id, subsection.id);
                              setSidebarOpen(false); // Close on mobile
                            }}
                            className="flex items-center gap-2 w-full text-left py-2 px-3 rounded-lg hover:bg-blue-50 transition-colors group"
                          >
                            <FaFolder className="h-3 w-3 text-blue-600" />
                            <span className="text-xs text-gray-600 group-hover:text-blue-600 truncate">
                              {subsection.name}
                            </span>
                            <span className="text-[10px] text-gray-400 ml-auto">
                              {section.contents?.length || subsection.contentBlocks?.length || 0}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Overlay dla mobile */}
            {sidebarOpen && (
              <div
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
              />
            )}
          </>
        )}

        {/* Main Content */}
        {activeTab === 'overview' && (
          <div className="flex-1 min-w-0 max-w-none space-y-6">
            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <BookOpen className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-gray-900">{stats.sections}</div>
                    <div className="text-sm text-gray-600">Rozdziały</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-3 rounded-lg">
                    <FaFolder className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-gray-900">{stats.lessons}</div>
                    <div className="text-sm text-gray-600">Lekcje</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <GraduationCap className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-gray-900">{stats.exams}</div>
                    <div className="text-sm text-gray-600">Egzaminy</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="bg-orange-100 p-3 rounded-lg">
                    <HelpCircle className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-gray-900">{stats.quizzes}</div>
                    <div className="text-sm text-gray-600">Quizy</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Course content - Sections */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900">Przegląd kursu</h2>
                <p className="text-gray-600 mt-1">Rozdziały, lekcje i materiały</p>
              </div>

              <div className="p-6 space-y-4">
                {sections.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <BookOpen className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p>Brak rozdziałów w tym kursie</p>
                  </div>
                ) : (
                  sections.map((section: any) => (
                    <div
                      key={section.id}
                      id={`section-${section.id}`}
                      className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-shadow scroll-mt-24"
                    >
                      {/* Section Header */}
                      <button
                        onClick={() => setShowSection(prev => ({
                          ...prev,
                          [section.id]: !prev[section.id]
                        }))}
                        className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          {showSection[section.id] ? (
                            <FaChevronUp className="text-blue-600" />
                          ) : (
                            <FaChevronDown className="text-gray-400" />
                          )}
                          <div className="text-left">
                            <h3 className="font-semibold text-gray-900 text-lg">{section.name}</h3>
                            <span className="text-sm text-gray-600">
                              ({section.type === 'assignment' ? 'Egzamin' : 'Materiał'})
                            </span>
                            {section.type === 'assignment' && section.deadline && (
                              <span className="ml-2 text-sm text-red-600">
                                • Termin: {new Date(section.deadline).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '/')}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm text-gray-500">
                          {section.contents?.length || section.subsections?.reduce((total: number, sub: any) => total + (sub.materials?.length || sub.contentBlocks?.length || 0), 0) || 0} materiałów
                        </span>
                      </button>

                      {/* Section Content - Materials or Subsections */}
                      {(() => {
                        console.log(`Checking showSection for ${section.id}:`, showSection[section.id]);
                        return showSection[section.id];
                      })() && (
                        <div className="p-4 space-y-3 bg-white">
                          {/* Sprawdź czy sekcja ma bezpośrednie materiały (nowy system) */}
                          {section.contents && section.contents.length > 0 ? (
                            <div className="space-y-3">
                              {(() => {
                                console.log('=== DEBUGGING SECTION CONTENTS ===');
                                console.log('Section ID:', section.id);
                                console.log('Section name:', section.name);
                                console.log('Contents array:', section.contents);
                                console.log('Contents length:', section.contents.length);
                                section.contents.forEach((block: any, index: number) => {
                                  console.log(`Block ${index}:`, {
                                    id: block.id,
                                    type: block.type,
                                    title: block.title,
                                    videoUrl: block.videoUrl,
                                    youtubeUrl: block.youtubeUrl,
                                    fileUrl: block.fileUrl,
                                    content: block.content?.substring(0, 50),
                                    link: block.link,
                                    url: block.url,
                                    text: block.text,
                                    description: block.description,
                                    hasContent: !!block.content,
                                    hasVideoUrl: !!block.videoUrl,
                                    hasYoutubeUrl: !!block.youtubeUrl,
                                    hasFileUrl: !!block.fileUrl,
                                    hasLink: !!block.link,
                                    hasUrl: !!block.url,
                                    hasText: !!block.text,
                                    hasDescription: !!block.description,
                                    ALL_PROPERTIES: Object.keys(block)
                                  });
                                });
                                return section.contents.map((block: any) => {
                                  // Automatycznie określ typ na podstawie dostępnych danych
                                  let blockType = block.type;
                                  if (!blockType) {
                                    if (block.link) {
                                      // Sprawdź czy link to YouTube
                                      if (block.link.includes('youtube.com') || block.link.includes('youtu.be')) {
                                        blockType = 'video';
                                      } else {
                                        blockType = 'link';
                                      }
                                    } else if (block.text) {
                                      blockType = 'text';
                                    } else if (block.fileUrl) {
                                      blockType = 'file';
                                    } else if (block.videoUrl || block.youtubeUrl) {
                                      blockType = 'video';
                                    } else {
                                      blockType = 'text'; // domyślny typ
                                    }
                                  }
                                  
                                  console.log(`About to render content block ${block.id} of type ${blockType} (auto-detected from ${block.type})`);
                                  console.log('Full block object:', JSON.stringify(block, null, 2));
                                  
                                  // Użyj automatycznie określonego typu
                                  const blockWithType = { ...block, type: blockType };
                                  
                                  return (
                                <div
                                  key={block.id}
                                  className="bg-white p-4 rounded-lg hover:bg-gray-50 transition-colors"
                                >

                                  {/* Text content */}
                                  {blockWithType.type === 'text' && (blockWithType.content || blockWithType.text || blockWithType.description) && !blockWithType.description?.startsWith('http') && (
                                    <div className="prose prose-sm max-w-none text-gray-700">
                                      <p className="whitespace-pre-wrap">{blockWithType.content || blockWithType.text || blockWithType.description}</p>
                                    </div>
                                  )}

                                  {/* Link content */}
                                  {blockWithType.type === 'link' && (blockWithType.link || blockWithType.url) && (
                                    <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <div className="bg-blue-100 p-2 rounded-lg">
                                            <span className="text-blue-600 text-lg">🔗</span>
                                          </div>
                                          <div>
                                            <p className="font-medium text-gray-900">
                                              {blockWithType.title || 'Link zewnętrzny'}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate max-w-md">
                                              {blockWithType.link || blockWithType.url}
                                            </p>
                                          </div>
                                        </div>
                                        <a
                                          href={blockWithType.link || blockWithType.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                        >
                                          Otwórz link
                                        </a>
                                      </div>
                                    </div>
                                  )}

                                  {/* Video - YouTube */}
                                  {blockWithType.type === 'video' && (blockWithType.youtubeUrl || (blockWithType.link && (blockWithType.link.includes('youtube.com') || blockWithType.link.includes('youtu.be')))) && (
                                    <div className="mt-3">
                                      <YouTubePlayer
                                        youtubeUrl={blockWithType.youtubeUrl || blockWithType.link}
                                        title={blockWithType.title || 'Video'}
                                      />
                                    </div>
                                  )}

                                  {/* Video - Upload */}
                                  {blockWithType.type === 'video' && blockWithType.videoUrl && !blockWithType.youtubeUrl && !blockWithType.link && (
                                    <div className="mt-3">
                                      <VideoPlayer
                                        videoUrl={blockWithType.videoUrl}
                                        title={blockWithType.title || 'Video'}
                                      />
                                    </div>
                                  )}

                                  {/* Text content with URL in description (new system) */}
                                  {blockWithType.type === 'text' && blockWithType.description?.startsWith('http') && (
                                    <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <div className="bg-blue-100 p-2 rounded-lg">
                                            <span className="text-blue-600 text-lg">🔗</span>
                                          </div>
                                          <div>
                                            <p className="font-medium text-gray-900">
                                              {block.title || 'Link zewnętrzny'}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate max-w-md">
                                              {block.description}
                                            </p>
                                          </div>
                                        </div>
                                        <a
                                          href={block.description}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                        >
                                          Otwórz link
                                        </a>
                                      </div>
                                    </div>
                                  )}

                                  {/* Math content */}
                                  {block.type === 'math' && block.mathContent && (
                                    <div className="border border-gray-300 rounded-lg p-3 bg-white">
                                      <MathView content={block.mathContent} />
                                    </div>
                                  )}

                                  {/* Video - Upload */}
                                  {blockWithType.type === 'video' && blockWithType.videoUrl && !blockWithType.youtubeUrl && !blockWithType.link && (
                                    <div className="mt-3">
                                      <VideoPlayer
                                        videoUrl={blockWithType.videoUrl}
                                        title={blockWithType.title || 'Video'}
                                      />
                                    </div>
                                  )}

                                  {/* File */}
                                  {block.type === 'file' && (() => {
                                    // Sprawdź czy to obraz - obsługa Firebase Storage URLs z parametrami
                                    const fileName = block.title || block.fileUrl || '';
                                    const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(fileName) || 
                                                  (block.fileUrl && /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?|$)/i.test(block.fileUrl));
                                    
                                    if (isImage) {
                                      console.log('Rendering image:', {
                                        fileName: fileName,
                                        fileUrl: block.fileUrl,
                                        title: block.title,
                                        blockId: block.id
                                      });
                                      
                                      return (
                                        <div className="mt-3">
                                          {/* Image Container with aspect ratio like VideoPlayer */}
                                          <div className="relative bg-black rounded-lg overflow-hidden">
                                            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                                              <img
                                                src={block.fileUrl}
                                                alt={block.title || 'Obraz'}
                                                className="absolute top-0 left-0 w-full h-full object-contain"
                                                loading="lazy"
                                                decoding="async"
                                                onError={() => {
                                                  // Silent error handling - no console in production
                                                  if (process.env.NODE_ENV === 'development') {
                                                    console.error('Image failed to load:', {
                                                      src: block.fileUrl,
                                                      fileName: fileName,
                                                      blockId: block.id
                                                    });
                                                  }
                                                }}
                                              />
                                            </div>
                                            
                                            {/* Title Overlay */}
                                            {block.title && (
                                              <div className="absolute top-4 left-4 right-4">
                                                <h3 className="text-white text-lg font-semibold bg-black/50 px-3 py-1 rounded">
                                                  {block.title}
                                                </h3>
                                              </div>
                                            )}
                                            
                                            {/* Download Button Overlay */}
                                            <div className="absolute bottom-4 right-4 flex gap-2">
                                              <a
                                                href={block.fileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                                              >
                                                Otwórz
                                              </a>
                                              <a
                                                href={block.fileUrl}
                                                download
                                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
                                              >
                                                Pobierz
                                              </a>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    
                                    return (
                                      <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <FaFilePdf className="text-red-600 text-2xl" />
                                            <div>
                                              <p className="font-medium text-gray-900">
                                                {block.title || 'Plik bez nazwy'}
                                              </p>
                                              {block.fileUrl && (
                                                <p className="text-xs text-gray-500 truncate max-w-md">
                                                  {block.fileUrl.split('/').pop()}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                          {block.fileUrl ? (
                                            <div className="flex gap-2">
                                              <a
                                                href={block.fileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                              >
                                                Otwórz
                                              </a>
                                              <a
                                                href={block.fileUrl}
                                                download
                                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                                              >
                                                Pobierz
                                              </a>
                            </div>
                          ) : (
                                            <span className="text-xs text-red-600">Brak pliku</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {/* Quiz */}
                                  {block.type === 'quiz' && block.quizId && (
                                    <div className="mt-3 p-4 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 rounded-xl shadow-sm">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <div className="bg-orange-100 p-3 rounded-lg">
                                            <HelpCircle className="h-6 w-6 text-orange-600" />
                                          </div>
                                          <div>
                                            <p className="font-semibold text-gray-900">
                                              {quizTitles[block.quizId] || 'Wczytywanie...'}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                              Quiz • Próby: {quizAttempts[block.quizId] || 0}
                                            </p>
                                          </div>
                                        </div>
                                        {!isTeacherPreview && (
                                          <a
                                            href={`/courses/${course?.slug || course?.id}/quiz/${block.quizId}`}
                                            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all shadow-md hover:shadow-lg font-medium"
                                          >
                                            Rozpocznij quiz
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                );
                              });
                            })()}
                            </div>
                          ) : section.subsections && section.subsections.length > 0 ? (
                            /* Stary system z podsekcjami */
                            (() => {
                              console.log('=== DEBUGGING SUBSECTIONS ===');
                              console.log('Section ID:', section.id);
                              console.log('Section name:', section.name);
                              console.log('Subsections array:', section.subsections);
                              console.log('Subsections length:', section.subsections.length);
                              section.subsections.forEach((subsection: any, index: number) => {
                                console.log(`Subsection ${index}:`, {
                                  id: subsection.id,
                                  name: subsection.name,
                                  contentBlocks: subsection.contentBlocks,
                                  materials: subsection.materials,
                                  contentBlocksLength: subsection.contentBlocks?.length || 0,
                                  materialsLength: subsection.materials?.length || 0
                                });
                                
                                // Debug each content block in subsection
                                if (subsection.contentBlocks) {
                                  subsection.contentBlocks.forEach((block: any, blockIndex: number) => {
                                    console.log(`  Subsection ${index} Block ${blockIndex}:`, {
                                      id: block.id,
                                      type: block.type,
                                      title: block.title,
                                      videoUrl: block.videoUrl,
                                      youtubeUrl: block.youtubeUrl,
                                      fileUrl: block.fileUrl,
                                      content: block.content?.substring(0, 50),
                                      link: block.link,
                                      url: block.url,
                                      text: block.text,
                                      ALL_PROPERTIES: Object.keys(block)
                                    });
                                  });
                                }
                                
                                // Debug each material in subsection
                                if (subsection.materials) {
                                  subsection.materials.forEach((material: any, materialIndex: number) => {
                                    console.log(`  Subsection ${index} Material ${materialIndex}:`, {
                                      id: material.id,
                                      type: material.type,
                                      title: material.title,
                                      videoUrl: material.videoUrl,
                                      youtubeUrl: material.youtubeUrl,
                                      fileUrl: material.fileUrl,
                                      content: material.content?.substring(0, 50),
                                      link: material.link,
                                      url: material.url,
                                      text: material.text,
                                      description: material.description,
                                      ALL_PROPERTIES: Object.keys(material),
                                      FULL_OBJECT: material
                                    });
                                  });
                                }
                              });
                              return section.subsections.map((subsection: any) => (
                              <div
                                key={subsection.id}
                                id={`lesson-${subsection.id}`}
                                className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl overflow-hidden shadow-sm scroll-mt-24"
                              >
                                {/* Subsection/Lesson Header */}
                                <button
                                  onClick={() => setShowSubsection(prev => ({
                                    ...prev,
                                    [subsection.id]: !prev[subsection.id]
                                  }))}
                                  className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-100 to-indigo-100 hover:from-blue-200 hover:to-indigo-200 transition-all"
                                >
                                  <div className="flex items-center gap-3">
                                    {showSubsection[subsection.id] ? (
                                      <FaFolderOpen className="text-blue-600" />
                                    ) : (
                                      <FaFolder className="text-blue-600" />
                                    )}
                                    <span className="font-medium text-gray-900">
                                      {subsection.name}
                                    </span>
                                  </div>
                                  <span className="text-xs text-gray-600">
                                    {subsection.materials?.length || subsection.contentBlocks?.length || 0} materiałów
                                  </span>
                                </button>

                                {/* Subsection Description */}
                                {subsection.description && (
                                  <div className="px-4 py-3 bg-blue-50/50 border-b border-blue-100">
                                    <div 
                                      className="prose prose-sm max-w-none text-gray-700"
                                      dangerouslySetInnerHTML={{ __html: subsection.description }}
                                    />
                                  </div>
                                )}

                                {/* DEBUG: Pokaż wszystkie dane podsekcji - USUŃ PO DEBUGOWANIU */}
                                {process.env.NODE_ENV === 'development' && (
                                  <details className="px-4 py-2 bg-yellow-50 border-b border-yellow-200 text-xs">
                                    <summary className="cursor-pointer text-yellow-700 font-medium">
                                      🔍 Debug: Dane podsekcji &quot;{subsection.name}&quot;
                                    </summary>
                                    <pre className="mt-2 p-2 bg-yellow-100 rounded overflow-auto max-h-60 text-xs">
                                      {JSON.stringify({
                                        id: subsection.id,
                                        name: subsection.name,
                                        description: subsection.description,
                                        materials: subsection.materials?.map((m: any) => ({
                                          id: m.id,
                                          type: m.type,
                                          title: m.title,
                                          content: m.content?.substring(0, 100),
                                          text: m.text?.substring(0, 100),
                                          description: m.description?.substring(0, 100),
                                          hasVideo: !!(m.videoUrl || m.youtubeUrl),
                                          hasFile: !!m.fileUrl,
                                        })),
                                        contentBlocks: subsection.contentBlocks?.map((b: any) => ({
                                          id: b.id,
                                          type: b.type,
                                          title: b.title,
                                          content: b.content?.substring(0, 100),
                                          text: b.text?.substring(0, 100),
                                          description: b.description?.substring(0, 100),
                                          hasVideo: !!(b.videoUrl || b.youtubeUrl),
                                          hasFile: !!b.fileUrl,
                                        })),
                                        allKeys: Object.keys(subsection),
                                      }, null, 2)}
                                    </pre>
                                  </details>
                                )}

                                {/* Lesson Materials */}
                                {(() => {
                                  console.log(`Checking showSubsection for ${subsection.id}:`, showSubsection[subsection.id]);
                                  return showSubsection[subsection.id];
                                })() && (
                                  <div className="p-4 space-y-3 bg-white">
                                    {(() => {
                                      // Preferuj contentBlocks (nowy system), jeśli nie ma to użyj materials (stary system)
                                      // contentBlocks ma priorytet bo zawiera pełniejsze dane
                                      const blocks = (subsection.contentBlocks && subsection.contentBlocks.length > 0) 
                                        ? subsection.contentBlocks 
                                        : (subsection.materials || []);
                                      
                                      console.log(`Rendering materials for subsection ${subsection.id}:`, {
                                        materials: subsection.materials,
                                        contentBlocks: subsection.contentBlocks,
                                        blocks: blocks,
                                        blocksLength: blocks.length
                                      });
                                      
                                      if (blocks.length === 0) {
                                        return (
                                          <div className="text-gray-400 italic text-sm text-center py-4">
                                            Brak materiałów w tej lekcji
                                          </div>
                                        );
                                      }
                                      
                                      return blocks.map((block: any) => {
                                        // Automatycznie określ typ na podstawie dostępnych danych (stary system)
                                        let blockType = block.type;
                                        if (!blockType) {
                                          if (block.link) {
                                            // Sprawdź czy link to YouTube
                                            if (block.link.includes('youtube.com') || block.link.includes('youtu.be')) {
                                              blockType = 'video';
                                            } else {
                                              blockType = 'link';
                                            }
                                          } else if (block.text) {
                                            blockType = 'text';
                                          } else if (block.fileUrl) {
                                            blockType = 'file';
                                          } else if (block.videoUrl || block.youtubeUrl) {
                                            blockType = 'video';
                                          } else {
                                            blockType = 'text'; // domyślny typ
                                          }
                                        }
                                        
                                        console.log(`Rendering block:`, block);
                                        console.log(`Auto-detected type: ${blockType} from ${block.type}`);
                                        // Debug logging
                                        console.log('Content Block:', {
                                          type: blockType,
                                          originalType: block.type,
                                          title: block.title,
                                          videoUrl: block.videoUrl,
                                          youtubeUrl: block.youtubeUrl,
                                          fileUrl: block.fileUrl,
                                          content: block.content?.substring(0, 50),
                                          description: block.description,
                                          text: block.text,
                                          link: block.link,
                                          url: block.url,
                                          ALL_PROPERTIES: Object.keys(block)
                                        });

                                        console.log(`About to render block ${block.id} of type ${block.type}`);
                                        return (
                                        <div
                                          key={block.id}
                                          className="bg-white p-4 rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                          {/* Block Header with Icon and Title */}
                                          {(block.title || blockType === 'video' || blockType === 'file') && (
                                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                                              <span className="text-lg">
                                                {blockType === 'text' && '📄'}
                                                {blockType === 'video' && '🎥'}
                                                {blockType === 'file' && '📎'}
                                                {blockType === 'link' && '🔗'}
                                                {blockType === 'quiz' && '❓'}
                                                {blockType === 'math' && '🧮'}
                                                {blockType === 'task' && '📋'}
                                              </span>
                                              <h4 className="font-medium text-gray-900">
                                                {block.title || (blockType === 'video' ? 'Video' : blockType === 'file' ? 'Plik' : '')}
                                              </h4>
                                            </div>
                                          )}

                                          {/* Text content */}
                                          {(() => {
                                            const hasTextContent = block.type === 'text' && (block.content || block.text || block.description) && !block.description?.startsWith('http');
                                            console.log(`Block ${block.id} text content check:`, {
                                              type: block.type,
                                              hasContent: !!block.content,
                                              hasText: !!block.text,
                                              hasDescription: !!block.description,
                                              isUrl: block.description?.startsWith('http'),
                                              hasTextContent
                                            });
                                            return hasTextContent;
                                          })() && (
                                            <div 
                                              className="prose prose-sm max-w-none text-gray-700
                                                [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4"
                                              dangerouslySetInnerHTML={{ __html: block.content || block.text || block.description }}
                                            />
                                          )}

                                          {/* Text content with only title (fallback) */}
                                          {(() => {
                                            const shouldShowFallback = block.type === 'text' && !(block.content || block.text || block.description) && block.title;
                                            console.log(`Block ${block.id} fallback check:`, {
                                              type: block.type,
                                              hasContent: !!block.content,
                                              hasText: !!block.text,
                                              hasDescription: !!block.description,
                                              hasTitle: !!block.title,
                                              shouldShowFallback
                                            });
                                            return shouldShowFallback;
                                          })() && (
                                            <div className="prose prose-sm max-w-none text-gray-700">
                                              <h3 className="font-semibold text-gray-900 mb-2">{block.title}</h3>
                                              <p className="text-gray-500 italic">Brak treści dla tego materiału</p>
                                            </div>
                                          )}

                                  {/* Fallback for any material type without content */}
                                  {!(block.type === 'text' && (block.content || block.text || block.description)) && 
                                   !(block.type === 'video' && (block.videoUrl || block.youtubeUrl)) && 
                                   !(block.type === 'file' && block.fileUrl) && 
                                   !(block.type === 'link' && (block.link || block.url)) && 
                                   !(block.type === 'quiz' && block.quizId) && 
                                   !(block.type === 'math' && block.mathContent) && 
                                   block.title && (
                                    <div className="prose prose-sm max-w-none text-gray-700">
                                      <h3 className="font-semibold text-gray-900 mb-2">{block.title}</h3>
                                      <p className="text-gray-500 italic">Materiał typu &quot;{block.type || 'undefined'}&quot; - brak treści</p>
                                    </div>
                                  )}

                                  {/* Fallback for materials without type */}
                                  {!block.type && block.title && (
                                    <div className="prose prose-sm max-w-none text-gray-700">
                                      <h3 className="font-semibold text-gray-900 mb-2">{block.title}</h3>
                                      <p className="text-gray-500 italic">Materiał bez typu - sprawdź dane w Firebase</p>
                                      <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                                        <p><strong>ID:</strong> {block.id}</p>
                                        <p><strong>Właściwości:</strong> {Object.keys(block).join(', ')}</p>
                                      </div>
                                    </div>
                                  )}

                                          {/* Link content */}
                                          {blockType === 'link' && (block.link || block.url) && (
                                            <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                  <div className="bg-blue-100 p-2 rounded-lg">
                                                    <span className="text-blue-600 text-lg">🔗</span>
                                                  </div>
                                                  <div>
                                                    <p className="font-medium text-gray-900">
                                                      {block.title || 'Link zewnętrzny'}
                                                    </p>
                                                    <p className="text-xs text-gray-500 truncate max-w-md">
                                                      {block.link || block.url}
                                                    </p>
                                                  </div>
                                                </div>
                                                <a
                                                  href={block.link || block.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                                >
                                                  Otwórz link
                                                </a>
                                              </div>
                                            </div>
                                          )}

                                          {/* Video - YouTube */}
                                          {blockType === 'video' && (block.youtubeUrl || (block.link && (block.link.includes('youtube.com') || block.link.includes('youtu.be')))) && (
                                            <div className="mt-3">
                                              <YouTubePlayer
                                                youtubeUrl={block.youtubeUrl || block.link}
                                                title={block.title || 'Video'}
                                              />
                                            </div>
                                          )}

                                          {/* Video - Upload */}
                                          {blockType === 'video' && block.videoUrl && !block.youtubeUrl && !block.link && (
                                            <div className="mt-3">
                                              <VideoPlayer
                                                videoUrl={block.videoUrl}
                                                title={block.title || 'Video'}
                                              />
                                            </div>
                                          )}

                                          {/* Text content with URL in description (special case) */}
                                          {blockType === 'text' && block.description?.startsWith('http') && (
                                            <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                  <div className="bg-blue-100 p-2 rounded-lg">
                                                    <span className="text-blue-600 text-lg">🔗</span>
                                                  </div>
                                                  <div>
                                                    <p className="font-medium text-gray-900">
                                                      {block.title || 'Link zewnętrzny'}
                                                    </p>
                                                    <p className="text-xs text-gray-500 truncate max-w-md">
                                                      {block.description}
                                                    </p>
                                                  </div>
                                                </div>
                                                <a
                                                  href={block.description}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                                >
                                                  Otwórz link
                                                </a>
                                              </div>
                                            </div>
                                          )}

                                          {/* Math content */}
                                          {blockType === 'math' && block.mathContent && (
                                            <div className="border border-gray-300 rounded-lg p-3 bg-white">
                                              <MathView content={block.mathContent} />
                                            </div>
                                          )}

                                          {/* Video - Upload */}
                                          {blockType === 'video' && block.videoUrl && !block.youtubeUrl && !block.link && (
                                            <div className="mt-3">
                                              <VideoPlayer
                                                videoUrl={block.videoUrl}
                                                title={block.title || 'Video'}
                                              />
                                            </div>
                                          )}

                                          {/* File */}
                                          {blockType === 'file' && (() => {
                                            // Sprawdź czy to obraz - obsługa Firebase Storage URLs z parametrami
                                            const fileName = block.title || block.fileUrl || '';
                                            const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(fileName) || 
                                                          (block.fileUrl && /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?|$)/i.test(block.fileUrl));
                                            
                                            if (isImage) {
                                              console.log('Rendering image (old system):', {
                                                fileName: fileName,
                                                fileUrl: block.fileUrl,
                                                title: block.title,
                                                blockId: block.id,
                                                isFirebaseUrl: block.fileUrl?.includes('firebasestorage.googleapis.com'),
                                                isBlobUrl: block.fileUrl?.startsWith('blob:'),
                                                isUuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(block.fileUrl || ''),
                                                fileUrlType: typeof block.fileUrl,
                                                fileUrlLength: block.fileUrl?.length
                                              });
                                              
                                              // Sprawdź czy to blob URL (tymczasowy)
                                              if (block.fileUrl?.startsWith('blob:')) {
                                                return (
                                                  <div className="mt-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                    <div className="flex items-center gap-3">
                                                      <div className="bg-yellow-100 p-2 rounded-lg">
                                                        <span className="text-yellow-600 text-lg">⚠️</span>
                                                      </div>
                                                      <div>
                                                        <p className="font-medium text-gray-900">
                                                          {block.title || 'Obraz'}
                                                        </p>
                                                        <p className="text-sm text-yellow-700">
                                                          Tymczasowy plik - nie został zapisany w Firebase Storage
                                                        </p>
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              }
                                              
                                              return (
                                                <div className="mt-3">
                                                  {/* Image Container with aspect ratio like VideoPlayer */}
                                                  <div className="relative bg-black rounded-lg overflow-hidden">
                                                    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                                                      <img
                                                        src={block.fileUrl}
                                                        alt={block.title || 'Obraz'}
                                                        className="absolute top-0 left-0 w-full h-full object-contain"
                                                        loading="lazy"
                                                        onError={() => {
                                                          console.error('Image failed to load (old system):', {
                                                            src: block.fileUrl,
                                                            fileName: fileName,
                                                            blockId: block.id
                                                          });
                                                        }}
                                                        onLoad={() => {
                                                          console.log('Image loaded successfully (old system):', block.fileUrl);
                                                        }}
                                                      />
                                                    </div>
                                                    
                                                    {/* Title Overlay */}
                                                    {block.title && (
                                                      <div className="absolute top-4 left-4 right-4">
                                                        <h3 className="text-white text-lg font-semibold bg-black/50 px-3 py-1 rounded">
                                                          {block.title}
                                                        </h3>
                                                      </div>
                                                    )}
                                                    
                                                    {/* Download Button Overlay */}
                                                    <div className="absolute bottom-4 right-4 flex gap-2">
                                                      <a
                                                        href={block.fileUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                                                      >
                                                        Otwórz
                                                      </a>
                                                      <a
                                                        href={block.fileUrl}
                                                        download
                                                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
                                                      >
                                                        Pobierz
                                                      </a>
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            }
                                            
                                            return (
                                              <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-3">
                                                    <FaFilePdf className="text-red-600 text-2xl" />
                                                    <div>
                                                      <p className="font-medium text-gray-900">
                                                        {block.title || 'Plik bez nazwy'}
                                                      </p>
                                                      {block.fileUrl && (
                                                        <p className="text-xs text-gray-500 truncate max-w-md">
                                                          {block.fileUrl.split('/').pop()}
                                                        </p>
                                                      )}
                                                    </div>
                                                  </div>
                                                  {block.fileUrl ? (
                                                    <div className="flex gap-2">
                                                      <a
                                                        href={block.fileUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                                      >
                                                        Otwórz
                                                      </a>
                                                      <a
                                                        href={block.fileUrl}
                                                        download
                                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                                                      >
                                                        Pobierz
                                                      </a>
                                                    </div>
                                                  ) : (
                                                    <span className="text-xs text-red-600">Brak pliku</span>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })()}

                                          {/* Quiz */}
                                          {blockType === 'quiz' && block.quizId && (
                                            <div className="mt-3 p-4 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 rounded-xl shadow-sm">
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                  <div className="bg-orange-100 p-3 rounded-lg">
                                                    <HelpCircle className="h-6 w-6 text-orange-600" />
                                                  </div>
                                                  <div>
                                                    <p className="font-semibold text-gray-900">
                                                      {quizTitles[block.quizId] || 'Wczytywanie...'}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                      Quiz • Próby: {quizAttempts[block.quizId] || 0}
                                                    </p>
                                                  </div>
                                                </div>
                                                {!isTeacherPreview && (
                                                  <a
                                                    href={`/courses/${course?.slug || course?.id}/quiz/${block.quizId}`}
                                                    className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all shadow-md hover:shadow-lg font-medium"
                                                  >
                                                    Rozpocznij quiz
                                                  </a>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                        );
                                      })
                                    })()}
                                  </div>
                                )}
                              </div>
                            ));
                            })()) : (
                            /* Brak materiałów i podsekcji */
                            <div className="text-gray-400 italic text-sm py-4 text-center">
                              Brak materiałów w tym rozdziale
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'exams' && (
          <div className="flex-1 min-w-0 max-w-none">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">Egzaminy</h2>
              <p className="text-gray-600 mt-1">Lista egzaminów przypisanych do kursu</p>
            </div>

            <div className="p-6">
              {exams.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <GraduationCap className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p>Brak egzaminów w tym kursie</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {exams.map((exam: any) => (
                                  <div
                                    key={exam.id}
                                    className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all hover:scale-[1.02]"
                                  >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <GraduationCap className="h-5 w-5 text-purple-600" />
                            <h3 className="text-lg font-semibold text-gray-900">{exam.name}</h3>
                          </div>
                          {exam.description && (
                            <p className="text-gray-600 mb-3">{exam.description}</p>
                          )}
                          {exam.deadline && (
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-red-600" />
                              <span className="text-red-600 font-medium">
                                Termin: {new Date(exam.deadline).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '/')}
                              </span>
                            </div>
                          )}
                        </div>
                        {!isTeacherPreview && (
                          <button className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors">
                            Otwórz egzamin
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          </div>
        )}

        {activeTab === 'quizzes' && (
          <div className="flex-1 min-w-0 max-w-none">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">Quizy</h2>
              <p className="text-gray-600 mt-1">Lista quizów przypisanych do kursu</p>
            </div>

            <div className="p-6">
              {quizzes.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <HelpCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p>Brak quizów w tym kursie</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {quizzes.map((quiz: any) => (
                    <div
                      key={quiz.id}
                      className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all hover:scale-[1.02]"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="bg-orange-100 p-2 rounded-lg">
                          <HelpCircle className="h-5 w-5 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{quiz.title}</h3>
                          {quiz.description && (
                            <p className="text-sm text-gray-600 mt-1">{quiz.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-gray-600">
                            {quiz.questions?.length || 0} pytań
                          </span>
                          <span className="text-xs text-gray-500">
                            Próby: {quizAttempts[quiz.id] || 0}/{quiz.max_attempts || 1}
                          </span>
                        </div>
                        {!isTeacherPreview && (
                          <a
                            href={`/courses/${course?.slug || course?.id}/quiz/${quiz.id}`}
                            className={`px-4 py-2 rounded-lg transition-colors text-sm inline-block ${
                              (quizAttempts[quiz.id] || 0) >= (quiz.max_attempts || 1)
                                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                : 'bg-orange-600 text-white hover:bg-orange-700'
                            }`}
                          >
                            {(quizAttempts[quiz.id] || 0) >= (quiz.max_attempts || 1) 
                              ? 'Wykorzystano próby' 
                              : 'Rozpocznij quiz'
                            }
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          </div>
        )}
      </div>
    </div>
  );
};
