"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';

export default function ContactPage() {
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
              <Link href="/community" className="text-slate-600 hover:text-blue-600 transition-colors duration-200 font-medium">
                Społeczność
              </Link>
              <span className="text-blue-600 font-medium">Kontakt</span>
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
            📞 Skontaktuj się z nami
          </div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Kontakt
            </span>
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Masz pytania dotyczące platformy COGITO? Chcesz nawiązać współpracę? 
            Jesteśmy tutaj, żeby Ci pomóc. Skontaktuj się z nami w dogodny dla Ciebie sposób.
          </p>
        </div>
      </section>

      {/* Formularz kontaktowy */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-slate-200/50 shadow-lg">
            <h2 className="text-2xl font-bold text-center text-slate-800 mb-8">
              Napisz do nas
            </h2>
            
            <form className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-2">
                    Imię *
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    required
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Twoje imię"
                  />
                </div>
                
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-2">
                    Nazwisko *
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    required
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Twoje nazwisko"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="twoj.email@example.com"
                />
              </div>
              
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-slate-700 mb-2">
                  Temat *
                </label>
                <select
                  id="subject"
                  name="subject"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                >
                  <option value="">Wybierz temat</option>
                  <option value="general">Pytanie ogólne</option>
                  <option value="technical">Wsparcie techniczne</option>
                  <option value="partnership">Współpraca</option>
                  <option value="feedback">Opinia/Feedback</option>
                  <option value="other">Inne</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-2">
                  Wiadomość *
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={6}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                  placeholder="Opisz szczegółowo swój problem lub pytanie..."
                ></textarea>
              </div>
              
              <div className="text-center">
                <button
                  type="submit"
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
                >
                  Wyślij wiadomość
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Inne sposoby kontaktu */}
      <section className="py-16 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-slate-800 mb-12">
            Inne sposoby kontaktu
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Email</h3>
              <p className="text-slate-600 mb-4">
                Napisz do nas bezpośrednio
              </p>
              <a 
                href="mailto:kontakt@cogito.pl" 
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                kontakt@cogito.pl
              </a>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Telefon</h3>
              <p className="text-slate-600 mb-4">
                Zadzwoń do nas
              </p>
              <a 
                href="tel:+48123456789" 
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                +48 123 456 789
              </a>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Adres</h3>
              <p className="text-slate-600 mb-4">
                Odwiedź nas osobiście
              </p>
              <p className="text-slate-600">
                ul. Edukacyjna 123<br />
                00-000 Warszawa
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-slate-800 mb-12">
            Często zadawane pytania
          </h2>
          
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50">
              <h3 className="text-lg font-semibold text-slate-800 mb-3">
                Jak mogę zarejestrować się na platformie?
              </h3>
              <p className="text-slate-600">
                Rejestracja jest bardzo prosta! Kliknij przycisk &quot;Zarejestruj się&quot; w prawym górnym rogu strony, 
                wypełnij formularz z podstawowymi danymi i potwierdź swój email.
              </p>
            </div>
            
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50">
              <h3 className="text-lg font-semibold text-slate-800 mb-3">
                Jak mogę uzyskać pomoc techniczną?
              </h3>
              <p className="text-slate-600">
                Możesz skontaktować się z naszym zespołem wsparcia przez formularz kontaktowy, 
                email lub telefon. Odpowiadamy w ciągu 24 godzin.
              </p>
            </div>
            
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50">
              <h3 className="text-lg font-semibold text-slate-800 mb-3">
                Czy mogę współpracować z platformą?
              </h3>
              <p className="text-slate-600">
                Oczywiście! Jesteśmy otwarci na współpracę z nauczycielami, szkołami i organizacjami edukacyjnymi. 
                Skontaktuj się z nami, żeby omówić szczegóły.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white">
            <h2 className="text-3xl font-bold mb-4">Masz więcej pytań?</h2>
            <p className="text-xl text-blue-100 mb-8">
              Nie wahaj się skontaktować z nami. Jesteśmy tutaj, żeby Ci pomóc!
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
              <h3 className="font-bold text-lg mb-4">Kontakt</h3>
              <ul className="space-y-2 text-slate-400">
                <li><span className="hover:text-white transition-colors">Email: kontakt@cogito.pl</span></li>
                <li><span className="hover:text-white transition-colors">Telefon: +48 123 456 789</span></li>
                <li><span className="hover:text-white transition-colors">Adres: Warszawa</span></li>
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