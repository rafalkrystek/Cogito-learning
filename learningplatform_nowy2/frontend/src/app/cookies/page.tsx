"use client";
import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function CookiesPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center group">
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
            </Link>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Link 
                href="/" 
                className="px-6 py-2.5 text-blue-600 font-semibold hover:bg-blue-50 rounded-xl transition-all duration-200"
              >
                Powrót do strony głównej
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
              Polityka Cookies
            </h1>
            <p className="text-xl text-slate-600">
              Ostatnia aktualizacja: {new Date().toLocaleDateString('pl-PL')}
            </p>
          </div>

          <div className="prose prose-lg max-w-none">
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">1. Czym są pliki cookies?</h2>
              <p className="text-slate-700 mb-4">
                Pliki cookies (tzw. &quot;ciasteczka&quot;) to małe pliki tekstowe, które są zapisywane na urządzeniu użytkownika 
                podczas przeglądania strony internetowej. Służą one do przechowywania informacji o preferencjach 
                użytkownika i umożliwiają poprawne funkcjonowanie platformy.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">2. Rodzaje cookies używane na platformie</h2>
              <div className="space-y-6">
                <div className="bg-green-50 rounded-xl p-6 border-l-4 border-green-400">
                  <h3 className="text-xl font-semibold text-green-800 mb-4">🍪 Cookies niezbędne (Essential)</h3>
                  <p className="text-green-700 mb-3">
                    Te pliki są absolutnie niezbędne do prawidłowego funkcjonowania platformy. Bez nich strona nie może działać poprawnie.
                  </p>
                  <ul className="space-y-2 text-green-700">
                    <li>• Utrzymanie sesji użytkownika</li>
                    <li>• Bezpieczeństwo logowania</li>
                    <li>• Podstawowe funkcje platformy</li>
                  </ul>
                </div>

                <div className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-400">
                  <h3 className="text-xl font-semibold text-blue-800 mb-4">📊 Cookies analityczne (Analytics)</h3>
                  <p className="text-blue-700 mb-3">
                    Pomagają nam zrozumieć, jak użytkownicy korzystają z platformy, co pozwala na jej ciągłe ulepszanie.
                  </p>
                  <ul className="space-y-2 text-blue-700">
                    <li>• Statystyki odwiedzin</li>
                    <li>• Popularne funkcje</li>
                    <li>• Problemy techniczne</li>
                  </ul>
                </div>

                <div className="bg-purple-50 rounded-xl p-6 border-l-4 border-purple-400">
                  <h3 className="text-xl font-semibold text-purple-800 mb-4">⚙️ Cookies funkcjonalne (Functional)</h3>
                  <p className="text-purple-700 mb-3">
                    Zapewniają dodatkowe funkcje i personalizację doświadczenia użytkownika.
                  </p>
                  <ul className="space-y-2 text-purple-700">
                    <li>• Zapamiętywanie preferencji</li>
                    <li>• Personalizacja interfejsu</li>
                    <li>• Ustawienia języka</li>
                  </ul>
                </div>

                <div className="bg-orange-50 rounded-xl p-6 border-l-4 border-orange-400">
                  <h3 className="text-xl font-semibold text-orange-800 mb-4">🎯 Cookies marketingowe (Marketing)</h3>
                  <p className="text-orange-700 mb-3">
                    Używane do wyświetlania spersonalizowanych reklam i treści edukacyjnych.
                  </p>
                  <ul className="space-y-2 text-orange-700">
                    <li>• Rekomendacje kursów</li>
                    <li>• Spersonalizowane treści</li>
                    <li>• Analiza zainteresowań</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">3. Jak długo przechowujemy cookies?</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">Sesyjne (Session cookies)</h3>
                  <p className="text-slate-700 text-sm">
                    Usuwane automatycznie po zamknięciu przeglądarki. Służą do utrzymania sesji użytkownika.
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">Stałe (Persistent cookies)</h3>
                  <p className="text-slate-700 text-sm">
                    Przechowywane przez określony czas (od 30 dni do 2 lat). Zapamiętują preferencje użytkownika.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">4. Cookies stron trzecich</h2>
              <p className="text-slate-700 mb-4">
                Na naszej platformie mogą być używane cookies od zaufanych partnerów:
              </p>
              <div className="bg-slate-50 rounded-xl p-6">
                <ul className="space-y-3 text-slate-700">
                  <li><strong>Google Analytics</strong> - analiza ruchu na stronie</li>
                  <li><strong>Firebase</strong> - funkcje techniczne platformy</li>
                  <li><strong>YouTube</strong> - osadzone filmy edukacyjne</li>
                  <li><strong>Social Media</strong> - przyciski udostępniania</li>
                </ul>
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">5. Zarządzanie cookies</h2>
              <div className="space-y-6">
                <div className="bg-blue-50 rounded-xl p-6">
                  <h3 className="text-xl font-semibold text-blue-800 mb-4">🔧 Ustawienia przeglądarki</h3>
                  <p className="text-blue-700 mb-3">
                    Możesz zmienić ustawienia cookies w swojej przeglądarce:
                  </p>
                  <ul className="space-y-2 text-blue-700">
                    <li>• Chrome: Ustawienia → Prywatność i bezpieczeństwo → Cookies</li>
                    <li>• Firefox: Opcje → Prywatność → Historia</li>
                    <li>• Safari: Preferencje → Prywatność</li>
                    <li>• Edge: Ustawienia → Pliki cookie i uprawnienia witryn</li>
                  </ul>
                </div>

                <div className="bg-green-50 rounded-xl p-6">
                  <h3 className="text-xl font-semibold text-green-800 mb-4">✅ Nasze narzędzia</h3>
                  <p className="text-green-700 mb-3">
                    Na platformie COGITO oferujemy:
                  </p>
                  <ul className="space-y-2 text-green-700">
                    <li>• Panel zarządzania cookies</li>
                    <li>• Możliwość wyłączenia poszczególnych kategorii</li>
                    <li>• Szczegółowe informacje o każdym pliku</li>
                    <li>• Łatwe usuwanie wszystkich cookies</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">6. Wpływ wyłączenia cookies</h2>
              <div className="bg-amber-50 rounded-xl p-6 border-l-4 border-amber-400">
                <h3 className="text-xl font-semibold text-amber-800 mb-4">⚠️ Uwaga</h3>
                <p className="text-amber-700 mb-3">
                  Wyłączenie niektórych cookies może wpłynąć na funkcjonalność platformy:
                </p>
                <ul className="space-y-2 text-amber-700">
                  <li>• Problemy z logowaniem</li>
                  <li>• Utrata personalizacji</li>
                  <li>• Ograniczone funkcje analityczne</li>
                  <li>• Problemy z zapisywaniem preferencji</li>
                </ul>
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">7. Aktualizacje polityki</h2>
              <p className="text-slate-700 mb-4">
                Niniejsza polityka cookies może być aktualizowana w miarę rozwoju platformy i zmian w przepisach. 
                O wszelkich istotnych zmianach będziemy informować użytkowników.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">8. Kontakt</h2>
              <div className="bg-blue-50 rounded-xl p-6">
                <p className="text-slate-700 mb-4">
                  W przypadku pytań dotyczących polityki cookies, prosimy o kontakt:
                </p>
                <div className="space-y-2 text-slate-700">
                  <p><strong>E-mail:</strong> cookies@cogito.edu.pl</p>
                  <p><strong>Telefon:</strong> +48 123 456 789</p>
                  <p><strong>Adres:</strong> ul. Edukacyjna 1, 00-001 Warszawa</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-slate-400 text-sm">
            © {new Date().getFullYear()} COGITO. Wszelkie prawa zastrzeżone.
          </p>
        </div>
      </footer>
    </div>
  );
}
