"use client";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-[#F1F4FE] flex flex-col relative w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      
      <div className="max-w-5xl mx-auto py-16 px-4">
        <h1 className="text-3xl font-bold text-[#4067EC] mb-6">Wsparcie</h1>
        <p className="text-lg text-gray-700 mb-8">Potrzebujesz pomocy? Skorzystaj z poradników, FAQ lub skontaktuj się z naszym zespołem wsparcia edukacji domowej.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white rounded-lg shadow p-6 flex flex-col">
            <h2 className="text-xl font-semibold text-[#4067EC] mb-2">FAQ</h2>
            <ul className="text-gray-700 list-disc list-inside space-y-1">
              <li>Jak zacząć edukację domową?</li>
              <li>Jak zgłosić dziecko do egzaminu?</li>
              <li>Jak motywować dziecko do nauki?</li>
              <li>Jak planować dzień nauki?</li>
            </ul>
          </div>
          <div className="bg-white rounded-lg shadow p-6 flex flex-col">
            <h2 className="text-xl font-semibold text-[#4067EC] mb-2">Poradniki</h2>
            <ul className="text-gray-700 list-disc list-inside space-y-1">
              <li>Przewodnik po przepisach prawnych</li>
              <li>Planowanie nauki w domu</li>
              <li>Współpraca z nauczycielami</li>
              <li>Materiały dla rodziców</li>
            </ul>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 flex flex-col mb-12">
          <h2 className="text-xl font-semibold text-[#4067EC] mb-2">Kontakt do ekspertów</h2>
          <ul className="text-gray-700 list-disc list-inside space-y-1">
            <li>Wsparcie mailowe: pomoc@cogito.pl</li>
            <li>Konsultacje online z nauczycielami</li>
            <li>Webinary i spotkania Q&A</li>
          </ul>
        </div>
        <Link href="/homelogin" className="text-[#4067EC] hover:underline">Powrót na stronę główną</Link>
      </div>
    </div>
  );
} 