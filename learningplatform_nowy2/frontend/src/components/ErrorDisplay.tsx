'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ErrorDisplayProps {
  error: string;
  onRetry?: () => void;
  showHomeButton?: boolean;
  showBackButton?: boolean;
  variant?: 'inline' | 'card' | 'full';
  className?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  showHomeButton = true,
  showBackButton = true,
  variant = 'card',
  className = ''
}) => {
  const router = useRouter();

  const handleGoHome = () => router.push('/homelogin');
  const handleGoBack = () => router.back();

  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 ${className}`}>
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm">{error}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-auto text-red-600 hover:text-red-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`bg-white border border-red-200 rounded-lg p-6 text-center ${className}`}>
        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Wystąpił błąd</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 justify-center"
            >
              <RefreshCw className="w-4 h-4" />
              Spróbuj ponownie
            </button>
          )}
          
          {showBackButton && (
            <button
              onClick={handleGoBack}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 justify-center"
            >
              <ArrowLeft className="w-4 h-4" />
              Wróć
            </button>
          )}
          
          {showHomeButton && (
            <button
              onClick={handleGoHome}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 justify-center"
            >
              <Home className="w-4 h-4" />
              Strona główna
            </button>
          )}
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <div className={`min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4 w-full overflow-x-hidden ${className}`} style={{ maxWidth: '100vw' }}>
      <div className="max-w-2xl mx-auto text-center">
        
        {/* Główna ikona z animacją */}
        <div className="relative mb-8">
          <div className="w-32 h-32 mx-auto bg-gradient-to-br from-red-100 to-orange-200 rounded-full flex items-center justify-center animate-pulse">
            <AlertTriangle className="w-16 h-16 text-red-500" />
          </div>
          
          {/* Animowane kropki */}
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-yellow-400 rounded-full animate-bounce"></div>
          <div className="absolute -bottom-2 -left-2 w-3 h-3 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>

        {/* Tytuł i opis */}
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
          Wystąpił błąd
        </h2>
        
        <p className="text-lg text-gray-600 mb-6">
          {error}
        </p>

        {/* Przyciski akcji */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors duration-200 flex items-center gap-2 font-medium transform hover:scale-105"
            >
              <RefreshCw className="w-4 h-4" />
              Spróbuj ponownie
            </button>
          )}
          
          {showBackButton && (
            <button
              onClick={handleGoBack}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors duration-200 flex items-center gap-2 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Wróć
            </button>
          )}
          
          {showHomeButton && (
            <button
              onClick={handleGoHome}
              className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2 font-medium"
            >
              <Home className="w-4 h-4" />
              Strona główna
            </button>
          )}
        </div>

        {/* Dodatkowe informacje */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200 max-w-lg mx-auto">
          <p className="text-sm text-blue-700">
            💡 <strong>Wskazówka:</strong> Jeśli problem się powtarza, 
            spróbuj odświeżyć stronę lub skontaktuj się z zespołem wsparcia.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ErrorDisplay;

