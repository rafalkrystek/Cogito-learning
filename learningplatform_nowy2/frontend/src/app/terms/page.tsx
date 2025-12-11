"use client";
import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function TermsOfService() {
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
              Regulamin Platformy COGITO
            </h1>
            <p className="text-xl text-slate-600">
              Ostatnia aktualizacja: {new Date().toLocaleDateString('pl-PL')}
            </p>
          </div>

          <div className="prose prose-lg max-w-none">
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">§1. Postanowienia ogólne</h2>
              <p className="text-slate-700 mb-4">
                Niniejszy regulamin określa zasady korzystania z platformy edukacyjnej COGITO dostępnej pod adresem cogito.edu.pl. 
                Platforma jest przeznaczona dla rodzin edukujących domowo, nauczycieli i uczniów.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">§2. Definicje</h2>
              <div className="bg-slate-50 rounded-xl p-6">
                <ul className="space-y-3 text-slate-700">
                  <li><strong>Platforma</strong> - serwis internetowy COGITO dostępny pod adresem cogito.edu.pl</li>
                  <li><strong>Użytkownik</strong> - osoba korzystająca z Platformy</li>
                  <li><strong>Konto</strong> - zbiór zasobów i uprawnień przypisanych Użytkownikowi</li>
                  <li><strong>Treści</strong> - materiały edukacyjne, kursy, quizy dostępne na Platformie</li>
                  <li><strong>Usługi</strong> - funkcjonalności Platformy dostępne dla Użytkowników</li>
                </ul>
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">§3. Warunki korzystania</h2>
              <div className="space-y-6">
                <div className="bg-blue-50 rounded-xl p-6">
                  <h3 className="text-xl font-semibold text-blue-800 mb-4">✅ Dozwolone:</h3>
                  <ul className="space-y-2 text-blue-700">
                    <li>• Korzystanie z materiałów edukacyjnych</li>
                    <li>• Tworzenie i udział w kursach</li>
                    <li>• Komunikacja z innymi użytkownikami</li>
                    <li>• Udostępnianie własnych materiałów</li>
                  </ul>
                </div>
                <div className="bg-red-50 rounded-xl p-6">
                  <h3 className="text-xl font-semibold text-red-800 mb-4">❌ Zabronione:</h3>
                  <ul className="space-y-2 text-red-700">
                    <li>• Naruszanie praw autorskich</li>
                    <li>• Publikowanie treści obraźliwych</li>
                    <li>• Spam i reklamy komercyjne</li>
                    <li>• Próby włamania do systemu</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">§4. Rejestracja i konto</h2>
              <p className="text-slate-700 mb-4">
                Aby korzystać z pełnych funkcji Platformy, Użytkownik musi utworzyć konto poprzez:
              </p>
              <ul className="space-y-2 text-slate-700 mb-6">
                <li>• Wypełnienie formularza rejestracyjnego</li>
                <li>• Potwierdzenie adresu e-mail</li>
                <li>• Akceptację niniejszego regulaminu</li>
                <li>• Akceptację polityki prywatności</li>
              </ul>
              <p className="text-slate-700">
                Użytkownik jest odpowiedzialny za bezpieczeństwo swojego konta i nie może udostępniać 
                danych logowania osobom trzecim.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">§5. Materiały edukacyjne</h2>
              <p className="text-slate-700 mb-4">
                Platforma udostępnia materiały edukacyjne w różnych formatach:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-slate-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">Dla uczniów:</h3>
                  <ul className="space-y-2 text-slate-700">
                    <li>• Interaktywne lekcje</li>
                    <li>• Quizy i testy</li>
                    <li>• Materiały do pobrania</li>
                    <li>• Ćwiczenia praktyczne</li>
                  </ul>
                </div>
                <div className="bg-slate-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">Dla nauczycieli:</h3>
                  <ul className="space-y-2 text-slate-700">
                    <li>• Tworzenie kursów</li>
                    <li>• Zarządzanie uczniami</li>
                    <li>• Analiza postępów</li>
                    <li>• Narzędzia dydaktyczne</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">§6. Odpowiedzialność</h2>
              <p className="text-slate-700 mb-4">
                Platforma COGITO nie ponosi odpowiedzialności za:
              </p>
              <ul className="space-y-2 text-slate-700 mb-6">
                <li>• Jakość materiałów tworzonych przez użytkowników</li>
                <li>• Wyniki edukacyjne użytkowników</li>
                <li>• Problemy techniczne po stronie użytkownika</li>
                <li>• Utratę danych w wyniku awarii</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">§7. Zmiany regulaminu</h2>
              <p className="text-slate-700 mb-4">
                Zastrzegamy sobie prawo do zmiany niniejszego regulaminu. O wszelkich zmianach 
                będziemy informować użytkowników drogą elektroniczną. Kontynuacja korzystania 
                z Platformy oznacza akceptację nowych warunków.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">§8. Kontakt</h2>
              <div className="bg-blue-50 rounded-xl p-6">
                <p className="text-slate-700 mb-4">
                  W przypadku pytań dotyczących regulaminu, prosimy o kontakt:
                </p>
                <div className="space-y-2 text-slate-700">
                  <p><strong>E-mail:</strong> terms@cogito.edu.pl</p>
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













