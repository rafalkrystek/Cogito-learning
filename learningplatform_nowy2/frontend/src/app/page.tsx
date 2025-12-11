"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import Providers from "@/components/Providers";
import ThemeToggle from "@/components/ThemeToggle";
import CogitoLogo from "@/components/CogitoLogo";
import { BookOpen, Users, Award, Clock, TrendingUp, CheckCircle, ArrowRight, GraduationCap, MessageSquare, BarChart3, Shield } from "lucide-react";

function HomeContent() {
  const router = useRouter();
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) return null;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
        {/* Header */}
        <header className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border-b border-slate-200/50 dark:border-gray-700/50 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center cursor-pointer group" onClick={() => router.push("/")}>
                <div className="relative overflow-hidden rounded-xl p-1.5 sm:p-2 bg-gradient-to-r from-[#4067EC] to-indigo-600 shadow-lg">
                  <CogitoLogo 
                    size={27}
                    className="w-5 h-5 sm:w-7 sm:h-7 transition-transform duration-300 group-hover:scale-110"
                  />
                </div>
                <span className="ml-2 sm:ml-3 text-lg sm:text-xl font-bold bg-gradient-to-r from-[#4067EC] to-indigo-600 bg-clip-text text-transparent">
                  COGITO
                </span>
              </div>
              <div className="hidden md:flex items-center space-x-4 lg:space-x-8">
                <Link href="/about" className="text-sm lg:text-base text-slate-600 dark:text-gray-300 hover:text-[#4067EC] dark:hover:text-blue-400 transition-colors duration-200 font-medium">
                  O platformie
                </Link>
                <Link href="/courses" className="text-sm lg:text-base text-slate-600 dark:text-gray-300 hover:text-[#4067EC] dark:hover:text-blue-400 transition-colors duration-200 font-medium">
                  Materiały
                </Link>
                <Link href="/contact" className="text-sm lg:text-base text-slate-600 dark:text-gray-300 hover:text-[#4067EC] dark:hover:text-blue-400 transition-colors duration-200 font-medium">
                  Kontakt
                </Link>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-4">
                <ThemeToggle />
                <Link 
                  href="/login" 
                  className="px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 text-xs sm:text-sm lg:text-base text-[#4067EC] dark:text-blue-400 font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-800 dark:hover:text-blue-300 rounded-lg sm:rounded-xl transition-all duration-200 whitespace-nowrap"
                >
                  Zaloguj
                </Link>
                <Link 
                  href="/register" 
                  className="px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 text-xs sm:text-sm lg:text-base bg-gradient-to-r from-[#4067EC] to-indigo-600 text-white font-semibold rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 whitespace-nowrap"
                >
                  Rejestracja
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1">
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24 xl:py-32">
            <div className="text-center max-w-4xl mx-auto">
              <div className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-100 dark:bg-blue-900/30 text-[#4067EC] dark:text-blue-400 rounded-full text-xs sm:text-sm font-medium mb-6 sm:mb-8">
                <GraduationCap className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                <span className="whitespace-nowrap">Nowoczesna platforma edukacyjna</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight mb-4 sm:mb-6 px-2">
                <span className="bg-gradient-to-r from-[#4067EC] via-indigo-600 to-purple-600 bg-clip-text text-transparent block mb-2">
                  Edukacja domowa
                </span>
                <span className="text-slate-800 dark:text-white block">w nowym wymiarze</span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-slate-600 dark:text-gray-300 leading-relaxed mb-8 sm:mb-12 max-w-3xl mx-auto px-4">
                Kompleksowa platforma edukacyjna wspierająca rodziny w skutecznym nauczaniu domowym. 
                Materiały, narzędzia i społeczność w jednym miejscu.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
                <Link 
                  href="/register" 
                  className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-[#4067EC] to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 text-base sm:text-lg flex items-center justify-center gap-2"
                >
                  Załóż konto
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </Link>
                <Link 
                  href="/about" 
                  className="px-6 sm:px-8 py-3 sm:py-4 border-2 border-[#4067EC] dark:border-blue-400 text-[#4067EC] dark:text-blue-400 font-bold rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-800 dark:hover:text-blue-300 transition-all duration-200 text-base sm:text-lg"
                >
                  Dowiedz się więcej
                </Link>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="py-12 sm:py-16 lg:py-20 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-8 sm:mb-12 lg:mb-16">
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-3 sm:mb-4 px-2">
                  Dlaczego <span className="bg-gradient-to-r from-[#4067EC] to-indigo-600 bg-clip-text text-transparent">COGITO</span>?
                </h2>
                <p className="text-base sm:text-lg lg:text-xl text-slate-600 dark:text-gray-300 max-w-2xl mx-auto px-4">
                  Kompleksowe rozwiązania dla rodzin edukujących domowo
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                {/* Feature 1 */}
                <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200/50 dark:border-gray-700/50 group">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-r from-[#4067EC] to-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                    <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" />
                  </div>
                  <h3 className="font-bold text-lg sm:text-xl lg:text-2xl mb-2 sm:mb-3 lg:mb-4 text-slate-900 dark:text-white">Bogate materiały</h3>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-gray-300 leading-relaxed">
                    Interaktywne lekcje, ćwiczenia, testy i quizy dla wszystkich poziomów edukacji – od przedszkola po liceum.
                  </p>
                </div>

                {/* Feature 2 */}
                <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200/50 dark:border-gray-700/50 group">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" />
                  </div>
                  <h3 className="font-bold text-lg sm:text-xl lg:text-2xl mb-2 sm:mb-3 lg:mb-4 text-slate-900 dark:text-white">Społeczność</h3>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-gray-300 leading-relaxed">
                    Dołącz do aktywnej społeczności rodziców i dzieci. Wymieniaj się materiałami, pomysłami i wsparciem.
                  </p>
                </div>

                {/* Feature 3 */}
                <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200/50 dark:border-gray-700/50 group">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                    <Award className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" />
                  </div>
                  <h3 className="font-bold text-lg sm:text-xl lg:text-2xl mb-2 sm:mb-3 lg:mb-4 text-slate-900 dark:text-white">Indywidualne podejście</h3>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-gray-300 leading-relaxed">
                    Dostosuj naukę do potrzeb swojego dziecka. Twórz własne ścieżki edukacyjne i korzystaj z gotowych planów.
                  </p>
                </div>

                {/* Feature 4 */}
                <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200/50 dark:border-gray-700/50 group">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                    <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" />
                  </div>
                  <h3 className="font-bold text-lg sm:text-xl lg:text-2xl mb-2 sm:mb-3 lg:mb-4 text-slate-900 dark:text-white">Śledź postępy</h3>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-gray-300 leading-relaxed">
                    Dziennik ocen, statystyki nauki i szczegółowe raporty postępów w nauce dla każdego dziecka.
                  </p>
                </div>

                {/* Feature 5 */}
                <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200/50 dark:border-gray-700/50 group">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                    <MessageSquare className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" />
                  </div>
                  <h3 className="font-bold text-lg sm:text-xl lg:text-2xl mb-2 sm:mb-3 lg:mb-4 text-slate-900 dark:text-white">Komunikacja</h3>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-gray-300 leading-relaxed">
                    Czaty grupowe, komunikacja z nauczycielami i specjalistami. Wszystko w jednym miejscu.
                  </p>
                </div>

                {/* Feature 6 */}
                <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200/50 dark:border-gray-700/50 group">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                    <Shield className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" />
                  </div>
                  <h3 className="font-bold text-lg sm:text-xl lg:text-2xl mb-2 sm:mb-3 lg:mb-4 text-slate-900 dark:text-white">Bezpieczeństwo</h3>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-gray-300 leading-relaxed">
                    Bezpieczna platforma z pełną kontrolą nad danymi. Twoja prywatność jest dla nas priorytetem.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Stats Section */}
          <section className="py-12 sm:py-16 lg:py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-[#4067EC] to-indigo-600 bg-clip-text text-transparent mb-2">
                    <Clock className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 mx-auto mb-2 text-[#4067EC] dark:text-blue-400" />
                    <span className="block">24/7</span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 font-medium">Dostęp do materiałów</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-[#4067EC] to-indigo-600 bg-clip-text text-transparent mb-2">
                    <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 mx-auto mb-2 text-[#4067EC] dark:text-blue-400" />
                    <span className="block">100%</span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 font-medium">Indywidualizacja</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-[#4067EC] to-indigo-600 bg-clip-text text-transparent mb-2">
                    <Shield className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 mx-auto mb-2 text-[#4067EC] dark:text-blue-400" />
                    <span className="block">100%</span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 font-medium">Bezpieczeństwo</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-[#4067EC] to-indigo-600 bg-clip-text text-transparent mb-2">
                    <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 mx-auto mb-2 text-[#4067EC] dark:text-blue-400" />
                    <span className="block">∞</span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 font-medium">Materiałów</div>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-12 sm:py-16 lg:py-20 bg-gradient-to-r from-[#4067EC] to-indigo-600">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6 px-2">
                Gotowy na start?
              </h2>
              <p className="text-base sm:text-lg lg:text-xl text-blue-100 mb-6 sm:mb-8 leading-relaxed px-4">
                Dołącz do społeczności COGITO i odkryj nowe możliwości edukacji domowej
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
                <Link 
                  href="/register" 
                  className="px-6 sm:px-8 lg:px-10 py-3 sm:py-4 lg:py-5 bg-white text-[#4067EC] font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 text-base sm:text-lg hover:bg-blue-50"
                >
                  Załóż konto
                </Link>
                <Link 
                  href="/login" 
                  className="px-6 sm:px-8 lg:px-10 py-3 sm:py-4 lg:py-5 border-2 border-white text-white font-bold rounded-xl hover:bg-white hover:text-[#4067EC] transition-all duration-200 text-base sm:text-lg"
                >
                  Zaloguj się
                </Link>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="bg-slate-800 dark:bg-gray-900 text-white py-8 sm:py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-6 sm:mb-8">
                <div className="col-span-2 sm:col-span-1">
                  <div className="flex items-center mb-3 sm:mb-4">
                    <div className="relative overflow-hidden rounded-xl p-1.5 sm:p-2 bg-gradient-to-r from-[#4067EC] to-indigo-600">
                      <CogitoLogo 
                        size={24}
                        className="w-5 h-5 sm:w-6 sm:h-6"
                      />
                    </div>
                    <span className="ml-2 text-lg sm:text-xl font-bold">COGITO</span>
                  </div>
                  <p className="text-slate-400 text-xs sm:text-sm">
                    Nowoczesna platforma edukacyjna dla edukacji domowej
                  </p>
                </div>
                
                <div>
                  <h3 className="font-bold text-sm sm:text-base lg:text-lg mb-3 sm:mb-4">Platforma</h3>
                  <ul className="space-y-1.5 sm:space-y-2 text-slate-400 text-xs sm:text-sm">
                    <li><Link href="/about" className="hover:text-white transition-colors">O platformie</Link></li>
                    <li><Link href="/courses" className="hover:text-white transition-colors">Materiały</Link></li>
                    <li><Link href="/contact" className="hover:text-white transition-colors">Kontakt</Link></li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-bold text-sm sm:text-base lg:text-lg mb-3 sm:mb-4">Funkcje</h3>
                  <ul className="space-y-1.5 sm:space-y-2 text-slate-400 text-xs sm:text-sm">
                    <li><span className="hover:text-white transition-colors cursor-default">Zarządzanie kursami</span></li>
                    <li><span className="hover:text-white transition-colors cursor-default">Quizy i testy</span></li>
                    <li><span className="hover:text-white transition-colors cursor-default">Czaty grupowe</span></li>
                    <li><span className="hover:text-white transition-colors cursor-default">Dziennik ocen</span></li>
                  </ul>
                </div>
                
                <div className="col-span-2 sm:col-span-1">
                  <h3 className="font-bold text-sm sm:text-base lg:text-lg mb-3 sm:mb-4">Prawne</h3>
                  <ul className="space-y-1.5 sm:space-y-2 text-slate-400 text-xs sm:text-sm">
                    <li><Link href="/privacy" className="hover:text-white transition-colors">Polityka prywatności</Link></li>
                    <li><Link href="/terms" className="hover:text-white transition-colors">Regulamin</Link></li>
                    <li><Link href="/cookies" className="hover:text-white transition-colors">Polityka cookies</Link></li>
                  </ul>
                </div>
              </div>
              
              <div className="pt-6 sm:pt-8 border-t border-slate-700 text-center">
                <p className="text-slate-400 text-xs sm:text-sm">
                  © {new Date().getFullYear()} COGITO. Wszelkie prawa zastrzeżone.
                </p>
              </div>
            </div>
          </footer>
        </main>
      </div>
    );
  }

  // Authenticated user view - redirect to dashboard
  // Poczekaj na załadowanie danych użytkownika przed przekierowaniem
  if (user) {
    router.push('/homelogin');
  }
  return null;
}

export default function Home() {
  return (
    <Providers>
      <HomeContent />
    </Providers>
  );
}
