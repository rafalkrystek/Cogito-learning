"use client";
import { useState } from 'react';
import { ArrowLeft, Send, AlertTriangle, CheckCircle } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

interface BugReport {
  category: string;
  description: string;
  steps: string;
  expected: string;
  actual: string;
  browser: string;
  url: string;
}

export default function ReportBugPage() {
  const [formData, setFormData] = useState<BugReport>({
    category: '',
    description: '',
    steps: '',
    expected: '',
    actual: '',
    browser: '',
    url: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const categories = [
    'Błąd funkcjonalności',
    'Problem z logowaniem',
    'Błąd wyświetlania',
    'Problem z wydajnością',
    'Błąd w formularzach',
    'Problem z nawigacją',
    'Błąd w komunikacji',
    'Inny problem'
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/report-bug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setIsSubmitted(true);
        setFormData({
          category: '',
          description: '',
          steps: '',
          expected: '',
          actual: '',
          browser: '',
          url: ''
        });
      } else {
        setError(result.error || 'Wystąpił błąd podczas wysyłania zgłoszenia');
      }
    } catch {
      setError('Wystąpił błąd podczas wysyłania zgłoszenia');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => window.location.href = '/homelogin'}
              className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Powrót</span>
            </button>
            
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              Zgłoś błąd platformy
            </h1>
            
            <ThemeToggle />
          </div>
        </div>

        {/* Success Message */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg p-8 border border-white/20 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Zgłoszenie zostało wysłane!
              </h2>
              
              <p className="text-gray-600 mb-6">
                Dziękujemy za zgłoszenie błędu. Nasz zespół przeanalizuje problem i postara się go rozwiązać jak najszybciej.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <strong>Uwaga:</strong> Zgłoszenie zostało wysłane anonimowo. Jeśli chcesz otrzymać odpowiedź, 
                  skontaktuj się z nami bezpośrednio pod adresem: <strong>SosSojowy@outlook.com</strong>
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  <strong>Dla deweloperów:</strong> Jeśli email nie jest skonfigurowany, zgłoszenie zostanie zapisane w konsoli serwera.
                </p>
              </div>
              
              <button
                onClick={() => setIsSubmitted(false)}
                className="bg-[#4067EC] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#3155d4] transition-colors duration-200"
              >
                Zgłoś kolejny błąd
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => window.location.href = '/homelogin'}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Powrót</span>
          </button>
          
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
            Zgłoś błąd platformy
          </h1>
          
          <ThemeToggle />
        </div>
      </div>

      {/* Form */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg p-8 border border-white/20">
            {/* Info Box */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-orange-800 mb-1">Zgłoszenie anonimowe</h3>
                  <p className="text-sm text-orange-700">
                    Twoje zgłoszenie zostanie wysłane anonimowo do zespołu deweloperskiego. 
                    Nie zbieramy żadnych danych osobowych.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Category */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                  Kategoria błędu *
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC]"
                >
                  <option value="">Wybierz kategorię</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Krótki opis problemu *
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  rows={3}
                  placeholder="Opisz krótko, co się dzieje..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC]"
                />
              </div>

              {/* Steps to Reproduce */}
              <div>
                <label htmlFor="steps" className="block text-sm font-medium text-gray-700 mb-2">
                  Kroki do odtworzenia problemu
                </label>
                <textarea
                  id="steps"
                  name="steps"
                  value={formData.steps}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="1. Otwórz stronę...&#10;2. Kliknij przycisk...&#10;3. Zobacz błąd..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC]"
                />
              </div>

              {/* Expected vs Actual */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="expected" className="block text-sm font-medium text-gray-700 mb-2">
                    Oczekiwane zachowanie
                  </label>
                  <textarea
                    id="expected"
                    name="expected"
                    value={formData.expected}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Co powinno się stać..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC]"
                  />
                </div>
                <div>
                  <label htmlFor="actual" className="block text-sm font-medium text-gray-700 mb-2">
                    Rzeczywiste zachowanie
                  </label>
                  <textarea
                    id="actual"
                    name="actual"
                    value={formData.actual}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Co się faktycznie dzieje..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC]"
                  />
                </div>
              </div>

              {/* Browser and URL */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="browser" className="block text-sm font-medium text-gray-700 mb-2">
                    Przeglądarka
                  </label>
                  <input
                    type="text"
                    id="browser"
                    name="browser"
                    value={formData.browser}
                    onChange={handleInputChange}
                    placeholder="np. Chrome 120, Firefox 119..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC]"
                  />
                </div>
                <div>
                  <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                    URL strony z błędem
                  </label>
                  <input
                    type="url"
                    id="url"
                    name="url"
                    value={formData.url}
                    onChange={handleInputChange}
                    placeholder="https://..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC]"
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-center">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 bg-[#4067EC] text-white px-8 py-3 rounded-lg font-semibold hover:bg-[#3155d4] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Wysyłanie...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Wyślij zgłoszenie
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
