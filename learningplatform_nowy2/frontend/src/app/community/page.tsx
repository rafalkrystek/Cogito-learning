"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';

export default function CommunityPage() {
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
              <Link href="/courses" className="text-slate-600 hover:text-blue-600 transition-colors duration-200 font-medium">
                Materiały
              </Link>
              <span className="text-blue-600 font-medium">Społeczność</span>
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
            🤝 Wspólnota edukacyjna
          </div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Społeczność COGITO
            </span>
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Dołącz do aktywnej społeczności nauczycieli, uczniów i rodziców edukacji domowej. 
            Wymieniaj się doświadczeniami, materiałami i wspieraj się nawzajem w podróży edukacyjnej.
          </p>
        </div>
      </section>

      {/* Główne funkcje społecznościowe */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-slate-800 mb-12">
            Jak platforma COGITO łączy społeczność?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Czaty grupowe */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Czaty grupowe</h3>
              <p className="text-slate-600">
                Komunikuj się w czasie rzeczywistym z uczniami, rodzicami i innymi nauczycielami 
                przez dedykowane czaty grupowe.
              </p>
            </div>

            {/* Współdzielenie materiałów */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Współdzielenie materiałów</h3>
              <p className="text-slate-600">
                Udostępniaj i pobieraj materiały edukacyjne, plany lekcji i inspiracje 
                od innych nauczycieli w społeczności.
              </p>
            </div>

            {/* Wspólne projekty */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Wspólne projekty</h3>
              <p className="text-slate-600">
                Twórz i realizuj wspólne projekty edukacyjne z innymi nauczycielami, 
                łącząc siły dla lepszych rezultatów.
              </p>
            </div>

            {/* Wsparcie i porady */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Wsparcie i porady</h3>
              <p className="text-slate-600">
                Otrzymuj wsparcie od doświadczonych nauczycieli i dziel się swoimi 
                sprawdzonymi metodami nauczania.
              </p>
            </div>

            {/* Networking */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Networking</h3>
              <p className="text-slate-600">
                Buduj profesjonalne kontakty z innymi nauczycielami, 
                wymieniaj się kontaktami i współpracuj nad projektami.
              </p>
            </div>

            {/* Wspólne wyzwania */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Wspólne wyzwania</h3>
              <p className="text-slate-600">
                Uczestnicz w edukacyjnych wyzwaniach i konkursach, 
                motywując siebie i uczniów do ciągłego rozwoju.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Korzyści z dołączenia */}
      <section className="py-16 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-slate-800 mb-12">
            Dlaczego warto dołączyć do społeczności COGITO?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Wymiana doświadczeń</h3>
                  <p className="text-slate-600">Ucz się od innych nauczycieli i dziel się swoimi sprawdzonymi metodami</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Dostęp do materiałów</h3>
                  <p className="text-slate-600">Korzystaj z bogatej biblioteki materiałów udostępnianych przez społeczność</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Motywacja i inspiracja</h3>
                  <p className="text-slate-600">Otrzymuj wsparcie w trudnych chwilach i inspirację do nowych pomysłów</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Współpraca</h3>
                  <p className="text-slate-600">Realizuj wspólne projekty i inicjatywy edukacyjne</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Rozwój zawodowy</h3>
                  <p className="text-slate-600">Rozwijaj swoje umiejętności dzięki kontaktom z ekspertami</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Przyjaźnie</h3>
                  <p className="text-slate-600">Buduj trwałe przyjaźnie z ludźmi o podobnych pasjach</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white">
            <h2 className="text-3xl font-bold mb-4">Gotowy dołączyć do społeczności?</h2>
            <p className="text-xl text-blue-100 mb-8">
              Dołącz do tysięcy nauczycieli i rodziców, którzy już korzystają z platformy COGITO
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/register" 
                className="px-8 py-4 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-all duration-200 shadow-lg"
              >
                Zarejestruj się teraz
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
              <h3 className="font-bold text-lg mb-4">Społeczność</h3>
              <ul className="space-y-2 text-slate-400">
                <li><span className="hover:text-white transition-colors">Czaty grupowe</span></li>
                <li><span className="hover:text-white transition-colors">Współdzielenie materiałów</span></li>
                <li><span className="hover:text-white transition-colors">Wspólne projekty</span></li>
                <li><span className="hover:text-white transition-colors">Networking</span></li>
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