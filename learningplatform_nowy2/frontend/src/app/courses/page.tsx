"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';

export default function CoursesPage() {
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
              <Link href="/about" className="text-slate-600 hover:text-blue-600 transition-colors duration-200 font-medium">
                O platformie
              </Link>
              <span className="text-blue-600 font-medium">Materiały</span>
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
            📚 Bogate zasoby edukacyjne
          </div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Materiały edukacyjne
            </span>
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Odkryj szeroką gamę materiałów edukacyjnych dostosowanych do różnych przedmiotów i poziomów nauczania. 
            Wszystko w jednym miejscu, łatwo dostępne i gotowe do użycia.
          </p>
        </div>
      </section>

      {/* Główne kategorie materiałów */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-slate-800 mb-12">
            Jakie materiały znajdziesz na platformie?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Kursy online */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Kursy online</h3>
              <p className="text-slate-600">
                Kompletne kursy edukacyjne z materiałami, quizami i zadaniami 
                dla różnych przedmiotów i poziomów.
              </p>
            </div>

            {/* Quizy i testy */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Quizy i testy</h3>
              <p className="text-slate-600">
                Interaktywne quizy z pytaniami ABCD i otwartymi, 
                automatycznie oceniane i dostosowane do poziomu ucznia.
              </p>
            </div>

            {/* Pliki i dokumenty */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Pliki i dokumenty</h3>
              <p className="text-slate-600">
                PDF-y, prezentacje, arkusze ćwiczeń i inne materiały 
                w różnych formatach do pobrania i drukowania.
              </p>
            </div>

            {/* Linki i zasoby */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Linki i zasoby</h3>
              <p className="text-slate-600">
                Sprawdzone linki do filmów edukacyjnych, stron internetowych 
                i innych zasobów online.
              </p>
            </div>

            {/* Zbiory zadań */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Zbiory zadań</h3>
              <p className="text-slate-600">
                Praktyczne zadania i ćwiczenia do utrwalania wiedzy, 
                z rozwiązaniami i wskazówkami.
              </p>
            </div>

            {/* Prezentacje */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2M9 12h6m-6 4h6" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Prezentacje</h3>
              <p className="text-slate-600">
                Interaktywne prezentacje multimedialne z grafami, 
                wykresami i animacjami dla lepszego zrozumienia.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Przedmioty */}
      <section className="py-16 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-slate-800 mb-12">
            Materiały dla różnych przedmiotów
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M9 11h.01M7 14h.01m8-3h.01M11 17h.01M15 14h.01M12 11h.01M10 14h.01" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-800">Matematyka</h3>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-800">Fizyka</h3>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-800">Chemia</h3>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-800">Biologia</h3>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-800">Języki obce</h3>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-800">Historia</h3>
          </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-800">Geografia</h3>
          </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-800">Informatyka</h3>
            </div>
          </div>
              </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white">
            <h2 className="text-3xl font-bold mb-4">Chcesz uzyskać dostęp do materiałów?</h2>
            <p className="text-xl text-blue-100 mb-8">
              Zarejestruj się i odkryj bogactwo zasobów edukacyjnych na platformie COGITO
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
              <h3 className="font-bold text-lg mb-4">Materiały</h3>
              <ul className="space-y-2 text-slate-400">
                <li><span className="hover:text-white transition-colors">Kursy online</span></li>
                <li><span className="hover:text-white transition-colors">Quizy i testy</span></li>
                <li><span className="hover:text-white transition-colors">Pliki i dokumenty</span></li>
                <li><span className="hover:text-white transition-colors">Zbiory zadań</span></li>
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