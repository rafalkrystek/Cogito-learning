'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Home, 
  Search, 
  BookOpen, 
  Users, 
  ArrowLeft, 
  RefreshCw,
  AlertTriangle,
  Lightbulb,
  Rocket
} from 'lucide-react';

interface NotFoundProps {
  title?: string;
  message?: string;
  showSearch?: boolean;
  showSuggestions?: boolean;
  primaryAction?: {
    label: string;
    href: string;
    icon?: React.ReactNode;
  };
}

export const NotFound: React.FC<NotFoundProps> = ({
  title = "Ups! Nie znaleziono",
  message = "Strona której szukasz nie istnieje lub została przeniesiona.",
  showSearch = true,
  showSuggestions = true,
  primaryAction
}) => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setIsSearching(true);
      // Symulacja wyszukiwania
      setTimeout(() => {
        setIsSearching(false);
        router.push(`/search?q=${encodeURIComponent(searchTerm)}`);
      }, 1000);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  const handleGoHome = () => {
    router.push('/homelogin');
  };

  const quickActions = [
    {
      label: 'Strona główna',
      href: '/homelogin',
      icon: <Home className="w-5 h-5" />,
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      label: 'Kursy',
      href: '/courses',
      icon: <BookOpen className="w-5 h-5" />,
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      label: 'Instruktorzy',
      href: '/homelogin/instructors',
      icon: <Users className="w-5 h-5" />,
      color: 'bg-purple-500 hover:bg-purple-600'
    }
  ];

  const suggestions = [
    'Sprawdź czy adres URL jest poprawny',
    'Użyj wyszukiwarki aby znaleźć to czego szukasz',
    'Przejdź do strony głównej i nawiguj stamtąd',
    'Skontaktuj się z administratorem jeśli problem się powtarza'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4 w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      <div className="max-w-4xl mx-auto text-center">
        
        {/* Główna ikona z animacją */}
        <div className="relative mb-8">
          <div className="w-32 h-32 mx-auto bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center animate-pulse">
            <AlertTriangle className="w-16 h-16 text-red-500" />
          </div>
          
          {/* Animowane kropki */}
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-yellow-400 rounded-full animate-bounce"></div>
          <div className="absolute -bottom-2 -left-2 w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="absolute top-1/2 -right-6 w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
        </div>

        {/* Tytuł i opis */}
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          {title}
        </h1>
        
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
          {message}
        </p>

        {/* Wyszukiwarka */}
        {showSearch && (
          <div className="mb-8">
            <form onSubmit={handleSearch} className="max-w-md mx-auto">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Czego szukasz?"
                  className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-full focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all duration-300 pr-20"
                />
                <button
                  type="submit"
                  disabled={isSearching || !searchTerm.trim()}
                  className="absolute right-2 top-2 px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2"
                >
                  {isSearching ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  {isSearching ? 'Szukam...' : 'Szukaj'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Szybkie akcje */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center justify-center gap-2">
            <Rocket className="w-5 h-5 text-blue-500" />
            Szybkie akcje
          </h3>
          <div className="flex flex-wrap justify-center gap-4">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => router.push(action.href)}
                className={`${action.color} text-white px-6 py-3 rounded-full font-medium transition-all duration-200 transform hover:scale-105 hover:shadow-lg flex items-center gap-2`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sugestie */}
        {showSuggestions && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center justify-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              Co możesz zrobić?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors duration-200 text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-gray-700">{suggestion}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Przyciski nawigacji */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={handleGoBack}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors duration-200 flex items-center gap-2 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Wróć
          </button>
          
          {primaryAction ? (
            <button
              onClick={() => router.push(primaryAction.href)}
              className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2 font-medium"
            >
              {primaryAction.icon}
              {primaryAction.label}
            </button>
          ) : (
            <button
              onClick={handleGoHome}
              className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2 font-medium"
            >
              <Home className="w-4 h-4" />
              Strona główna
            </button>
          )}
        </div>

        {/* Dekoracyjne elementy */}
        <div className="mt-12 opacity-30">
          <div className="flex justify-center gap-8">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" style={{ animationDelay: '0.9s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

