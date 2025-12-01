"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { ArrowLeft, HelpCircle, MessageSquare, Mail, Phone, Clock, ChevronDown, ChevronUp, ExternalLink, BookOpen, Video, FileText, Users, Settings, Shield, Zap, Search } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

const faqs = [
  {
    question: "Jak zapisać się na egzamin?",
    answer:
      "Aby zapisać się na egzamin, przejdź do zakładki 'Moje kursy', wybierz odpowiedni przedmiot i kliknij przycisk 'Zapisz się na egzamin'. Potwierdź swój wybór i gotowe!",
    lazyLink: "/homelogin/my-courses",
  },
  {
    question: "Gdzie mogę sprawdzić swoje oceny?",
    answer:
      "Swoje oceny znajdziesz w zakładce 'Dziennik' lub w profilu użytkownika. Tam zobaczysz wszystkie wyniki z testów, egzaminów i zadań domowych.",
    lazyLink: "/homelogin/grades",
  },
  {
    question: "Co zrobić, gdy zapomnę hasła?",
    answer:
      "Kliknij na stronie logowania 'Nie pamiętasz hasła?', podaj swój e-mail i postępuj zgodnie z instrukcjami, które otrzymasz na maila.",
    lazyLink: "/forgot-password",
  },
  {
    question: "Czy mogę korzystać z platformy na telefonie?",
    answer:
      "Tak! Nasza platforma działa na smartfonach i tabletach. Wystarczy przeglądarka internetowa.",
  },
  {
    question: "Jak skontaktować się z nauczycielem?",
    answer:
      "Aby skontaktować się z nauczycielem, wejdź w zakładkę 'Moje kursy', a następnie kliknij w wybrany kurs. W nagłówku każdego kursu znajdziesz adres e-mail prowadzącego – napisz do niego bezpośrednio, aby uzyskać pomoc lub zadać pytanie.",
    lazyLink: "/homelogin/my-courses",
  },
  {
    question: "Gdzie znajdę materiały do nauki?",
    answer:
      "Materiały do nauki są dostępne w zakładce 'Biblioteka' oraz w poszczególnych kursach. Możesz je przeglądać online lub pobrać na komputer.",
    lazyLink: "/homelogin/library",
    extraLink: "/homelogin/my-courses",
  },
  {
    question: "Jak rozwiązywać zadania na platformie?",
    answer:
      "Po wejściu w wybrany kurs lub temat, znajdziesz sekcję 'Zadania'. Kliknij na zadanie, przeczytaj polecenie i wyślij swoją odpowiedź przez platformę.",
    lazyLink: "/homelogin/my-courses",
  },
  {
    question: "Czy mogę pobrać materiały na swój komputer?",
    answer:
      "Po wejściu w dany kurs w zakładce 'Moje kursy' znajdziesz materiały od prowadzącego. Tam możesz kliknąć ikonę pobrania przy wybranym pliku lub prezentacji, aby pobrać je na swój komputer.",
    lazyLink: "/homelogin/my-courses",
  },
  {
    question: "Co zrobić, gdy mam problem techniczny?",
    answer:
      "Jeśli napotkasz problem techniczny, napisz do nas przez zakładkę 'Support & FAQs', skontaktuj się z administratorem platformy lub napisz bezpośrednio na adres e-mail: learningtreatment.admin@gmail.com.",
    lazyLink: "/homelogin/support",
  },
  {
    question: "Jakie przedmioty są dostępne na platformie?",
    answer:
      "Na platformie znajdziesz przedmioty takie jak: matematyka, język polski, angielski, biologia, chemia, fizyka, historia i wiele innych!",
    lazyLink: "/courses",
  },
  {
    question: "Jak działa system oceniania?",
    answer:
      "System oceniania opiera się na skali 1-6. Oceny są automatycznie zapisywane w dzienniku i widoczne zarówno dla ucznia, jak i rodzica. Możesz sprawdzić szczegóły każdej oceny w zakładce 'Dziennik'.",
    lazyLink: "/homelogin/grades",
  },
  {
    question: "Czy mogę zmienić swoje dane osobowe?",
    answer:
      "Tak! Możesz edytować swoje dane osobowe w zakładce 'Profil'. Tam znajdziesz opcję zmiany imienia, nazwiska, adresu e-mail i numeru telefonu.",
    lazyLink: "/profile",
  },
  {
    question: "Jak działa kalendarz zajęć?",
    answer:
      "Kalendarz zajęć pozwala na przeglądanie wszystkich wydarzeń, egzaminów i terminów. Nauczyciele mogą dodawać wydarzenia, a uczniowie otrzymują powiadomienia o nowych terminach.",
    lazyLink: "/homelogin/student/calendar",
  },
  {
    question: "Co to są quizy i jak je rozwiązywać?",
    answer:
      "Quizy to interaktywne testy sprawdzające wiedzę. Znajdziesz je w poszczególnych kursach. Po rozwiązaniu quizu otrzymasz natychmiastowy wynik i szczegółowe informacje o poprawnych odpowiedziach.",
    lazyLink: "/homelogin/student/quizzes",
  },
  {
    question: "Jak korzystać z czatu grupowego?",
    answer:
      "Czat grupowy umożliwia komunikację z innymi uczniami i nauczycielami. Możesz zadawać pytania, dzielić się materiałami i współpracować z innymi uczestnikami kursu.",
    lazyLink: "/homelogin/group-chats",
  },
  {
    question: "Czy mogę pobrać certyfikat ukończenia kursu?",
    answer:
      "Tak! Po ukończeniu kursu i zdaniu wszystkich wymaganych egzaminów, certyfikat zostanie automatycznie wygenerowany i będzie dostępny do pobrania w sekcji 'Moje kursy'.",
    lazyLink: "/homelogin/my-courses",
  },
  {
    question: "Jak działa system powiadomień?",
    answer:
      "System powiadomień informuje Cię o nowych ocenach, terminach egzaminów, wiadomościach od nauczycieli i innych ważnych wydarzeniach. Powiadomienia możesz sprawdzić w prawym górnym rogu platformy.",
  },
];

const popularTopics = [
  {
    title: "Rozpoczęcie nauki",
    description: "Jak zacząć korzystać z platformy",
    icon: Zap,
    color: "from-blue-500 to-cyan-500",
    link: "/homelogin/my-courses"
  },
  {
    title: "Oceny i postępy",
    description: "Sprawdzanie wyników i statystyk",
    icon: BookOpen,
    color: "from-green-500 to-emerald-500",
    link: "/homelogin/grades"
  },
  {
    title: "Materiały edukacyjne",
    description: "Dostęp do zasobów i biblioteki",
    icon: FileText,
    color: "from-purple-500 to-pink-500",
    link: "/homelogin/library"
  },
  {
    title: "Komunikacja",
    description: "Kontakt z nauczycielami i uczniami",
    icon: Users,
    color: "from-orange-500 to-red-500",
    link: "/homelogin/group-chats"
  },
  {
    title: "Ustawienia konta",
    description: "Zarządzanie profilem i preferencjami",
    icon: Settings,
    color: "from-indigo-500 to-blue-500",
    link: "/profile"
  },
  {
    title: "Bezpieczeństwo",
    description: "Ochrona danych i prywatność",
    icon: Shield,
    color: "from-red-500 to-rose-500",
    link: "/homelogin/support"
  },
];

const guides = [
  {
    title: "Przewodnik dla początkujących",
    description: "Kompletny przewodnik po platformie dla nowych użytkowników",
    icon: BookOpen,
    steps: 5
  },
  {
    title: "Jak korzystać z quizów",
    description: "Instrukcja rozwiązywania testów i quizów",
    icon: FileText,
    steps: 3
  },
  {
    title: "Zarządzanie kursami",
    description: "Jak efektywnie organizować swoją naukę",
    icon: Video,
    steps: 4
  },
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const faqRefs = useRef<(HTMLDivElement | null)[]>([]);
  const router = useRouter();

  const filteredFaqs = faqs.filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F4F6FB] dark:bg-gray-900">
      {/* Header z przyciskiem powrotu */}
      <div className="w-full bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/homelogin')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 hover:shadow-md transition-all duration-200 ease-in-out border border-gray-200 dark:border-gray-600"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Powrót do strony głównej</span>
              <span className="sm:hidden">Powrót</span>
            </button>
            
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
              Wsparcie i FAQ
            </h1>
            
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Główny kontener */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-[#4067EC] to-[#5577FF] rounded-2xl shadow-xl p-6 lg:p-8 mb-6 text-white">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold mb-4">Centrum Wsparcia</h1>
            <p className="text-lg lg:text-xl text-white/90 mb-6">
              Znajdź odpowiedzi na swoje pytania lub skontaktuj się z naszym zespołem wsparcia. Jesteśmy tutaj, aby Ci pomóc!
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-6 py-3 bg-white text-[#4067EC] rounded-xl font-semibold hover:bg-gray-100 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Przeglądaj FAQ
              </button>
              <button
                onClick={() => document.getElementById('contact-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-6 py-3 bg-white/10 backdrop-blur-sm text-white border-2 border-white/30 rounded-xl font-semibold hover:bg-white/20 transition-all duration-200"
              >
                Skontaktuj się
              </button>
            </div>
          </div>
        </div>

        {/* Popularne tematy */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Popularne tematy</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {popularTopics.map((topic, idx) => {
              const Icon = topic.icon;
              return (
                <Link
                  key={idx}
                  href={topic.link}
                  className="group bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300 hover:scale-105"
                >
                  <div className={`w-12 h-12 bg-gradient-to-r ${topic.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{topic.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{topic.description}</p>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Sekcja kontaktowa */}
        <div id="contact-section" className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 lg:p-8 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-[#4067EC] rounded-xl flex items-center justify-center shadow-lg">
                  <HelpCircle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Potrzebujesz pomocy?</h2>
                  <p className="text-gray-600 dark:text-gray-400">Skontaktuj się z naszym zespołem wsparcia</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 hover:shadow-md transition-all duration-200">
                  <div className="w-12 h-12 bg-[#4067EC] rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white mb-1">Email</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">pomoc@cogito.pl</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 hover:shadow-md transition-all duration-200">
                  <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white mb-1">Telefon</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">+48 123 456 789</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800 hover:shadow-md transition-all duration-200">
                  <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white mb-1">Godziny pracy</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">pon-pt 9:00-17:00</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800 hover:shadow-md transition-all duration-200">
                  <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white mb-1">Czat</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Dostępny 24/7</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700 h-full">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Szybkie linki</h3>
              <div className="space-y-3">
                <Link 
                  href="/homelogin/my-courses"
                  className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all duration-200 border border-blue-200 dark:border-blue-800 hover:shadow-md"
                >
                  <div className="w-10 h-10 bg-[#4067EC] rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">K</span>
                  </div>
                  <span className="font-medium text-gray-800 dark:text-gray-200">Moje kursy</span>
                </Link>
                
                <Link 
                  href="/homelogin/grades"
                  className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/30 transition-all duration-200 border border-green-200 dark:border-green-800 hover:shadow-md"
                >
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">O</span>
                  </div>
                  <span className="font-medium text-gray-800 dark:text-gray-200">Dziennik ocen</span>
                </Link>
                
                <Link 
                  href="/homelogin/library"
                  className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all duration-200 border border-purple-200 dark:border-purple-800 hover:shadow-md"
                >
                  <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">B</span>
                  </div>
                  <span className="font-medium text-gray-800 dark:text-gray-200">Biblioteka</span>
                </Link>
                
                <Link 
                  href="/homelogin/group-chats"
                  className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-all duration-200 border border-orange-200 dark:border-orange-800 hover:shadow-md"
                >
                  <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">C</span>
                  </div>
                  <span className="font-medium text-gray-800 dark:text-gray-200">Czat grupowy</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Poradniki */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Przewodniki i poradniki</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {guides.map((guide, idx) => {
              const Icon = guide.icon;
              return (
                <div
                  key={idx}
                  className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200"
                >
                  <div className="w-12 h-12 bg-[#4067EC] rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{guide.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{guide.description}</p>
                  <div className="flex items-center gap-2 text-sm text-[#4067EC] font-medium">
                    <span>{guide.steps} kroków</span>
                    <ExternalLink className="w-4 h-4" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sekcja FAQ */}
        <div id="faq-section" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 lg:p-8 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-[#4067EC] rounded-xl flex items-center justify-center shadow-lg">
              <HelpCircle className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">FAQ – Najczęściej Zadawane Pytania</h2>
              <p className="text-gray-600 dark:text-gray-400">Tutaj znajdziesz odpowiedzi na najczęstsze pytania dotyczące korzystania z naszej platformy edukacyjnej.</p>
            </div>
          </div>

          {/* Wyszukiwarka FAQ */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Wyszukaj w FAQ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4067EC] focus:border-transparent transition-all duration-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <span className="text-xl">×</span>
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Znaleziono {filteredFaqs.length} {filteredFaqs.length === 1 ? 'wynik' : filteredFaqs.length < 5 ? 'wyniki' : 'wyników'}
              </p>
            )}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((faq, idx) => {
                const originalIndex = faqs.indexOf(faq);
                return (
                  <div
                    key={idx}
                    ref={(el) => {
                      faqRefs.current[originalIndex] = el;
                    }}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 hover:shadow-lg transition-all duration-200 flex flex-col"
                  >
                    <button
                      className="w-full flex justify-between items-center px-6 py-5 text-left focus:outline-none focus:ring-2 focus:ring-[#4067EC] hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors min-h-[80px]"
                      onClick={() => setOpenIndex(openIndex === originalIndex ? null : originalIndex)}
                      aria-expanded={openIndex === originalIndex}
                      aria-controls={`faq-panel-${originalIndex}`}
                    >
                      <span className="font-semibold text-gray-900 dark:text-white text-left pr-4">{faq.question}</span>
                      {openIndex === originalIndex ? (
                        <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                      )}
                    </button>
                    {openIndex === originalIndex && (
                      <div
                        id={`faq-panel-${originalIndex}`}
                        className="px-6 pb-6 text-gray-700 dark:text-gray-300 animate-fadeIn flex-1"
                      >
                        <div className="pt-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">{faq.answer}</p>
                          
                          <div className="flex flex-wrap gap-3">
                            {faq.lazyLink && (
                              <Link
                                href={faq.lazyLink}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-[#4067EC] hover:bg-[#3155d4] text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                              >
                                Przejdź do sekcji
                                <ExternalLink className="w-4 h-4" />
                              </Link>
                            )}
                            {faq.extraLink && (
                              <Link
                                href={faq.extraLink}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                              >
                                Materiały w kursach
                                <ExternalLink className="w-4 h-4" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="col-span-2 text-center py-12">
                <p className="text-gray-600 dark:text-gray-400 text-lg">Nie znaleziono wyników dla "{searchQuery}"</p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-4 text-[#4067EC] hover:underline"
                >
                  Wyczyść wyszukiwanie
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dodatkowe zasoby */}
        <div className="mt-8 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-8 border border-gray-200 dark:border-gray-600">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Nie znalazłeś odpowiedzi?</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Skontaktuj się z nami bezpośrednio - nasz zespół wsparcia jest gotowy, aby Ci pomóc!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:pomoc@cogito.pl"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#4067EC] hover:bg-[#3155d4] text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Mail className="w-5 h-5" />
                Napisz do nas
              </a>
              <a
                href="tel:+48123456789"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-gray-600 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
              >
                <Phone className="w-5 h-5" />
                Zadzwoń do nas
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 

