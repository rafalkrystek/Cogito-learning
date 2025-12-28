"use client";
import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Send, AlertTriangle, CheckCircle, Bug, Info, FileText, Monitor, Globe, Zap } from 'lucide-react';
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

  const categories = useMemo(() => [
    { value: 'Błąd funkcjonalności', icon: Zap, color: 'bg-red-500' },
    { value: 'Problem z logowaniem', icon: AlertTriangle, color: 'bg-orange-500' },
    { value: 'Błąd wyświetlania', icon: Monitor, color: 'bg-yellow-500' },
    { value: 'Problem z wydajnością', icon: Zap, color: 'bg-purple-500' },
    { value: 'Błąd w formularzach', icon: FileText, color: 'bg-blue-500' },
    { value: 'Problem z nawigacją', icon: Globe, color: 'bg-indigo-500' },
    { value: 'Błąd w komunikacji', icon: Info, color: 'bg-pink-500' },
    { value: 'Inny problem', icon: Bug, color: 'bg-gray-500' }
  ], []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
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
  }, [formData]);

  const handleReset = useCallback(() => {
    setIsSubmitted(false);
    setError('');
  }, []);

  const isFormValid = useMemo(() => {
    return formData.category.trim() !== '' && formData.description.trim() !== '';
  }, [formData.category, formData.description]);

  // Auto-detect browser info
  const detectedBrowser = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const ua = navigator.userAgent;
    if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Edg')) return 'Edge';
    return '';
  }, []);

  // Auto-fill browser if empty
  const handleBrowserFocus = useCallback(() => {
    if (!formData.browser && detectedBrowser) {
      setFormData(prev => ({ ...prev, browser: detectedBrowser }));
    }
  }, [formData.browser, detectedBrowser]);

  // Auto-fill current URL if empty
  const handleUrlFocus = useCallback(() => {
    if (!formData.url && typeof window !== 'undefined') {
      setFormData(prev => ({ ...prev, url: window.location.href }));
    }
  }, [formData.url]);


  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:via-purple-900 dark:to-slate-900 w-full overflow-x-hidden">
        {/* Header */}
        <div className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-white/10 backdrop-blur-xl border-b border-gray-200 dark:border-white/20 z-50 flex items-center justify-between px-4 lg:px-6">
          <Link
            href="/homelogin"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Powrót</span>
          </Link>
          
          <div className="flex items-center gap-2">
            <Image src="/puzzleicon.png" alt="Logo" width={28} height={28} className="brightness-0 dark:brightness-100" />
            <h1 className="text-lg sm:text-xl font-bold text-[#4067EC]">COGITO</h1>
          </div>
          
          <ThemeToggle />
        </div>

        {/* Success Message */}
        <main className="pt-20 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="max-w-3xl mx-auto">
            <div className="bg-gradient-to-r from-green-50 via-blue-50 to-purple-50 dark:from-green-600/20 dark:via-blue-600/20 dark:to-purple-600/20 backdrop-blur-xl rounded-3xl p-8 sm:p-10 lg:p-12 border border-gray-200 dark:border-white/20 shadow-2xl text-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-green-100 dark:bg-green-500/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-green-600 dark:text-green-400" />
              </div>
              
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Zgłoszenie zostało wysłane! 🎉
              </h2>
              
              <p className="text-gray-600 dark:text-white/70 mb-8 text-base sm:text-lg">
                Dziękujemy za zgłoszenie błędu. Nasz zespół przeanalizuje problem i postara się go rozwiązać jak najszybciej.
              </p>
              
              <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-2xl p-6 mb-8 text-left">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
                    <Info className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2 text-lg">
                      Informacja o zgłoszeniu
                    </h3>
                    <p className="text-sm sm:text-base text-blue-700 dark:text-blue-300 mb-3">
                      <strong>Uwaga:</strong> Zgłoszenie zostało wysłane anonimowo. Jeśli chcesz otrzymać odpowiedź, 
                      skontaktuj się z nami bezpośrednio pod adresem: <strong className="break-all">SosSojowy@outlook.com</strong>
                    </p>
                    <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400">
                      <strong>Dla deweloperów:</strong> Jeśli email nie jest skonfigurowany, zgłoszenie zostanie zapisane w konsoli serwera.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleReset}
                  className="px-8 py-4 bg-gradient-to-r from-[#4067EC] to-indigo-600 hover:from-[#3155d4] hover:to-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center justify-center gap-2"
                >
                  <Bug className="w-5 h-5" />
                  Zgłoś kolejny błąd
                </button>
                <Link
                  href="/homelogin"
                  className="px-8 py-4 bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-xl font-semibold transition-all duration-200 border-2 border-gray-300 dark:border-white/30 shadow-md hover:shadow-lg transform hover:-translate-y-1 text-center"
                >
                  Wróć do dashboardu
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:via-purple-900 dark:to-slate-900 w-full overflow-x-hidden">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-white/10 backdrop-blur-xl border-b border-gray-200 dark:border-white/20 z-50 flex items-center justify-between px-4 lg:px-6">
        <Link
          href="/homelogin"
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Powrót</span>
        </Link>
        
        <div className="flex items-center gap-2">
          <Image src="/puzzleicon.png" alt="Logo" width={28} height={28} className="brightness-0 dark:brightness-100" />
          <h1 className="text-lg sm:text-xl font-bold text-[#4067EC]">COGITO</h1>
        </div>
        
        <ThemeToggle />
      </div>

      {/* Main Content */}
      <main className="pt-20 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="max-w-5xl mx-auto">
          {/* Welcome Header */}
          <div className="mb-8 mt-[80px]">
            <div className="bg-gradient-to-r from-red-50 via-orange-50 to-yellow-50 dark:from-red-600/20 dark:via-orange-600/20 dark:to-yellow-600/20 backdrop-blur-xl rounded-3xl p-6 sm:p-8 lg:p-10 border border-gray-200 dark:border-white/20 shadow-2xl" style={{ width: '1047px' }}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 dark:bg-red-500/30 rounded-2xl flex items-center justify-center shadow-lg">
                    <Bug className="w-8 h-8 sm:w-10 sm:h-10 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                      Zgłoś błąd platformy
                    </h1>
                    <p className="text-gray-600 dark:text-white/70 text-sm sm:text-base lg:text-lg">
                      Pomóż nam ulepszyć platformę - zgłoś napotkany problem
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white dark:bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-6 sm:p-8 lg:p-10 border border-gray-200 dark:border-white/20 mt-[80px]" style={{ position: 'absolute', top: '260px' }}>
            {/* Info Box */}
            <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-500/10 dark:to-yellow-500/10 border border-orange-200 dark:border-orange-500/30 rounded-2xl p-5 sm:p-6 mb-8">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-500/20 rounded-xl flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-orange-800 dark:text-orange-200 mb-2 text-lg">
                    Zgłoszenie anonimowe
                  </h3>
                  <p className="text-sm sm:text-base text-orange-700 dark:text-orange-300">
                    Twoje zgłoszenie zostanie wysłane anonimowo do zespołu deweloperskiego. 
                    Nie zbieramy żadnych danych osobowych.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
              {/* Category - Visual Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">
                  Kategoria błędu <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  {categories.map((category) => {
                    const Icon = category.icon;
                    const isSelected = formData.category === category.value;
                    return (
                      <button
                        key={category.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, category: category.value }))}
                        className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                          isSelected
                            ? `${category.color} border-transparent text-white shadow-lg scale-105`
                            : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/20 text-gray-700 dark:text-white/70 hover:border-gray-300 dark:hover:border-white/40 hover:shadow-md'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Icon className={`w-6 h-6 ${isSelected ? 'text-white' : ''}`} />
                          <span className="text-xs sm:text-sm font-medium text-center">{category.value}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <input
                  type="hidden"
                  name="category"
                  value={formData.category}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Krótki opis problemu <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  rows={4}
                  placeholder="Opisz krótko, co się dzieje..."
                  className="w-full p-4 border-2 border-gray-300 dark:border-white/20 rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC] transition-all duration-200 resize-none text-sm sm:text-base"
                />
              </div>

              {/* Steps to Reproduce */}
              <div>
                <label htmlFor="steps" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Kroki do odtworzenia problemu
                </label>
                <textarea
                  id="steps"
                  name="steps"
                  value={formData.steps}
                  onChange={handleInputChange}
                  rows={5}
                  placeholder="1. Otwórz stronę...&#10;2. Kliknij przycisk...&#10;3. Zobacz błąd..."
                  className="w-full p-4 border-2 border-gray-300 dark:border-white/20 rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC] transition-all duration-200 resize-none text-sm sm:text-base font-mono"
                />
              </div>

              {/* Expected vs Actual */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-green-50 dark:bg-green-500/10 rounded-2xl p-5 border border-green-200 dark:border-green-500/30">
                  <label htmlFor="expected" className="block text-sm font-bold text-green-800 dark:text-green-200 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Oczekiwane zachowanie
                  </label>
                  <textarea
                    id="expected"
                    name="expected"
                    value={formData.expected}
                    onChange={handleInputChange}
                    rows={4}
                    placeholder="Co powinno się stać..."
                    className="w-full p-4 border-2 border-green-200 dark:border-green-500/30 rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 resize-none text-sm sm:text-base"
                  />
                </div>
                <div className="bg-red-50 dark:bg-red-500/10 rounded-2xl p-5 border border-red-200 dark:border-red-500/30">
                  <label htmlFor="actual" className="block text-sm font-bold text-red-800 dark:text-red-200 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Rzeczywiste zachowanie
                  </label>
                  <textarea
                    id="actual"
                    name="actual"
                    value={formData.actual}
                    onChange={handleInputChange}
                    rows={4}
                    placeholder="Co się faktycznie dzieje..."
                    className="w-full p-4 border-2 border-red-200 dark:border-red-500/30 rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 resize-none text-sm sm:text-base"
                  />
                </div>
              </div>

              {/* Browser and URL */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="browser" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Przeglądarka
                  </label>
                  <input
                    type="text"
                    id="browser"
                    name="browser"
                    value={formData.browser}
                    onChange={handleInputChange}
                    onFocus={handleBrowserFocus}
                    placeholder={detectedBrowser ? `${detectedBrowser} (wykryto automatycznie)` : "np. Chrome 120, Firefox 119..."}
                    className="w-full p-4 border-2 border-gray-300 dark:border-white/20 rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC] transition-all duration-200 text-sm sm:text-base"
                  />
                </div>
                <div>
                  <label htmlFor="url" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    URL strony z błędem
                  </label>
                  <input
                    type="url"
                    id="url"
                    name="url"
                    value={formData.url}
                    onChange={handleInputChange}
                    onFocus={handleUrlFocus}
                    placeholder="https://..."
                    className="w-full p-4 border-2 border-gray-300 dark:border-white/20 rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC] transition-all duration-200 text-sm sm:text-base"
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 dark:bg-red-500/10 border-2 border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-5 py-4 rounded-xl text-sm sm:text-base flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex flex-col sm:flex-row gap-4 sm:justify-center pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting || !isFormValid}
                  className="flex items-center justify-center gap-3 bg-gradient-to-r from-[#4067EC] to-indigo-600 hover:from-[#3155d4] hover:to-indigo-700 text-white px-8 py-4 rounded-xl font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-1 text-base sm:text-lg"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Wysyłanie...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      <span>Wyślij zgłoszenie</span>
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
