"use client";
import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function PrivacyPolicy() {
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
              Polityka Prywatności
            </h1>
            <p className="text-xl text-slate-600">
              Ostatnia aktualizacja: {new Date().toLocaleDateString('pl-PL')}
            </p>
          </div>

          <div className="prose prose-lg max-w-none">
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">1. Wprowadzenie</h2>
              <p className="text-slate-700 mb-4">
                Platforma COGITO (&quot;my&quot;, &quot;nas&quot;, &quot;nasza&quot;) szanuje prywatność użytkowników i zobowiązuje się do ochrony ich danych osobowych. 
                Niniejsza Polityka Prywatności wyjaśnia, w jaki sposób zbieramy, używamy, przechowujemy i chronimy informacje o użytkownikach.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">2. Jakie dane zbieramy</h2>
              <div className="bg-slate-50 rounded-xl p-6 mb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-4">Dane osobowe:</h3>
                <ul className="space-y-2 text-slate-700">
                  <li>• Imię i nazwisko</li>
                  <li>• Adres e-mail</li>
                  <li>• Data urodzenia</li>
                  <li>• Informacje o edukacji</li>
                  <li>• Rola użytkownika (uczeń, nauczyciel, rodzic)</li>
                </ul>
              </div>
              <div className="bg-slate-50 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-4">Dane techniczne:</h3>
                <ul className="space-y-2 text-slate-700">
                  <li>• Adres IP</li>
                  <li>• Informacje o przeglądarce</li>
                  <li>• Dane o urządzeniu</li>
                  <li>• Pliki cookies</li>
                </ul>
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">3. Cel zbierania danych</h2>
              <p className="text-slate-700 mb-4">
                Zbieramy dane w następujących celach:
              </p>
              <ul className="space-y-2 text-slate-700 mb-6">
                <li>• Świadczenie usług edukacyjnych</li>
                <li>• Personalizacja doświadczeń użytkownika</li>
                <li>• Komunikacja z użytkownikami</li>
                <li>• Poprawa jakości platformy</li>
                <li>• Zapewnienie bezpieczeństwa</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">4. Udostępnianie danych</h2>
              <p className="text-slate-700 mb-4">
                Nie sprzedajemy, nie wymieniamy ani nie udostępniamy danych osobowych użytkowników stronom trzecim, 
                z wyjątkiem przypadków określonych w niniejszej polityce lub gdy jest to wymagane przez prawo.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">5. Bezpieczeństwo danych</h2>
              <p className="text-slate-700 mb-4">
                Stosujemy odpowiednie środki techniczne i organizacyjne w celu ochrony danych osobowych użytkowników 
                przed nieuprawnionym dostępem, zmianą, ujawnieniem lub zniszczeniem.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">6. Prawa użytkowników</h2>
              <p className="text-slate-700 mb-4">
                Użytkownicy mają prawo do:
              </p>
              <ul className="space-y-2 text-slate-700 mb-6">
                <li>• Dostępu do swoich danych osobowych</li>
                <li>• Poprawiania nieprawidłowych danych</li>
                <li>• Usuwania danych</li>
                <li>• Ograniczenia przetwarzania</li>
                <li>• Przenoszenia danych</li>
                <li>• Wniesienia sprzeciwu</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">7. Kontakt</h2>
              <div className="bg-blue-50 rounded-xl p-6">
                <p className="text-slate-700 mb-4">
                  W przypadku pytań dotyczących niniejszej Polityki Prywatności, prosimy o kontakt:
                </p>
                <div className="space-y-2 text-slate-700">
                  <p><strong>E-mail:</strong> privacy@cogito.edu.pl</p>
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













