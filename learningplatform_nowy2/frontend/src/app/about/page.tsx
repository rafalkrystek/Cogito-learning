"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';

export default function AboutPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center cursor-pointer group" onClick={() => router.push('/')}>
              <div className="relative overflow-hidden rounded-xl p-2 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg">
                <Image 
                  src="/puzzleicon.png" 
                  alt="COGITO Logo" 
                  width={32} 
                  height={32} 
                  className="w-8 h-8 transition-transform duration-300 group-hover:scale-110"
                />
              </div>
              <span className="ml-3 text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                COGITO
              </span>
            </div>
            
            <nav className="hidden md:flex items-center space-x-8">
              <Link href="/" className="text-slate-600 hover:text-blue-600 transition-colors duration-200 font-medium">
                Strona główna
              </Link>
              <span className="text-blue-600 font-medium">O platformie</span>
              <Link href="/courses" className="text-slate-600 hover:text-blue-600 transition-colors duration-200 font-medium">
                Materiały
              </Link>
              <Link href="/community" className="text-slate-600 hover:text-blue-600 transition-colors duration-200 font-medium">
                Społeczność
              </Link>
              <Link href="/contact" className="text-slate-600 hover:text-blue-600 transition-colors duration-200 font-medium">
                Kontakt
              </Link>
            </nav>

            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <Link 
                href="/login" 
                className="px-6 py-2.5 text-blue-600 font-semibold hover:bg-blue-50 rounded-xl transition-all duration-200"
              >
                Zaloguj się
              </Link>
              <Link 
                href="/register" 
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
              >
                Zarejestruj się
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-16 pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-6">
            ✨ Platforma edukacyjna COGITO
          </div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              O platformie
            </span>
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            COGITO to nowoczesna platforma edukacyjna zaprojektowana specjalnie dla edukacji domowej, 
            łącząca w sobie zaawansowane narzędzia nauczania z intuicyjnym interfejsem.
          </p>
        </div>
      </section>

      {/* Główne funkcje */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-slate-800 mb-12">
            Co oferuje platforma COGITO?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Zarządzanie kursami */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Zarządzanie kursami</h3>
              <p className="text-slate-600">
                Twórz i zarządzaj kursami edukacyjnymi z możliwością dodawania materiałów, 
                quizów i zadań dla uczniów.
              </p>
            </div>

            {/* System quizów */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">System quizów i testów</h3>
              <p className="text-slate-600">
                Twórz interaktywne quizy z pytaniami ABCD i otwartymi, 
                automatycznie oceniaj odpowiedzi uczniów.
              </p>
            </div>

            {/* Czaty grupowe */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Czaty grupowe</h3>
              <p className="text-slate-600">
                Komunikuj się z uczniami i rodzicami przez czaty grupowe, 
                dziel się materiałami i odpowiadaj na pytania.
              </p>
            </div>

            {/* Dziennik ocen */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Dziennik ocen</h3>
              <p className="text-slate-600">
                Śledź postępy uczniów, wystawiaj oceny i generuj raporty 
                z wyników nauczania.
              </p>
            </div>

            {/* Materiały edukacyjne */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Materiały edukacyjne</h3>
              <p className="text-slate-600">
                Udostępniaj pliki, linki i zasoby edukacyjne, 
                organizuj je w logiczne kategorie i sekcje.
              </p>
            </div>

            {/* Kalendarz i harmonogram */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Kalendarz i harmonogram</h3>
              <p className="text-slate-600">
                Planuj lekcje, terminy oddawania zadań i ważne wydarzenia 
                w intuicyjnym kalendarzu.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dla kogo */}
      <section className="py-16 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-slate-800 mb-12">
            Dla kogo jest platforma COGITO?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Nauczyciele</h3>
              <p className="text-slate-600">
                Twórz kursy, zarządzaj materiałami, oceniaj postępy uczniów 
                i komunikuj się z rodzicami w jednym miejscu.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Uczniowie</h3>
              <p className="text-slate-600">
                Ucz się w swoim tempie, rozwiązywuj quizy, 
                komunikuj się z nauczycielami i śledź swoje postępy.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Rodzice</h3>
              <p className="text-slate-600">
                Monitoruj postępy dziecka, komunikuj się z nauczycielami 
                i bądź na bieżąco z edukacją domową.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white">
            <h2 className="text-3xl font-bold mb-4">Gotowy do rozpoczęcia?</h2>
            <p className="text-xl text-blue-100 mb-8">
              Dołącz do platformy COGITO i odkryj nowe możliwości edukacji domowej
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/register" 
                className="px-8 py-4 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-all duration-200 shadow-lg"
              >
                Zarejestruj się
              </Link>
              <Link 
                href="/login" 
                className="px-8 py-4 border-2 border-white text-white font-bold rounded-xl hover:bg-white/10 transition-all duration-200"
              >
                Zaloguj się
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-800 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center mb-4">
                <div className="relative overflow-hidden rounded-xl p-2 bg-gradient-to-r from-blue-600 to-indigo-600">
                  <Image 
                    src="/puzzleicon.png" 
                    alt="COGITO Logo" 
                    width={24} 
                    height={24} 
                    className="w-6 h-6"
                  />
                </div>
                <span className="ml-2 text-xl font-bold">COGITO</span>
              </div>
              <p className="text-slate-400 text-sm">
                Nowoczesna platforma edukacyjna dla edukacji domowej
              </p>
            </div>
            
            <div>
              <h3 className="font-bold text-lg mb-4">Platforma</h3>
              <ul className="space-y-2 text-slate-400">
                <li><Link href="/about" className="hover:text-white transition-colors">O platformie</Link></li>
                <li><Link href="/courses" className="hover:text-white transition-colors">Materiały</Link></li>
                <li><Link href="/community" className="hover:text-white transition-colors">Społeczność</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Kontakt</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-lg mb-4">Funkcje</h3>
              <ul className="space-y-2 text-slate-400">
                <li><span className="hover:text-white transition-colors">Zarządzanie kursami</span></li>
                <li><span className="hover:text-white transition-colors">Quizy i testy</span></li>
                <li><span className="hover:text-white transition-colors">Czaty grupowe</span></li>
                <li><span className="hover:text-white transition-colors">Dziennik ocen</span></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-lg mb-4">Wsparcie</h3>
              <ul className="space-y-2 text-slate-400">
                <li><span className="hover:text-white transition-colors">Pomoc</span></li>
                <li><span className="hover:text-white transition-colors">FAQ</span></li>
                <li><span className="hover:text-white transition-colors">Kontakt</span></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-slate-700 text-center">
            <p className="text-slate-400 text-sm">
              © {new Date().getFullYear()} COGITO. Wszelkie prawa zastrzeżone.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}













