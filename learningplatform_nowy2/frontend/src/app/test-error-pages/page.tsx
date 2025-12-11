'use client';

import React, { useState } from 'react';
import { NotFound } from '@/components/NotFound';
import { CourseNotFound } from '@/components/CourseNotFound';
import { QuizNotFound } from '@/components/QuizNotFound';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function TestErrorPages() {
  const [activeComponent, setActiveComponent] = useState<string>('menu');

  const renderComponent = () => {
    switch (activeComponent) {
      case 'not-found':
        return <NotFound />;
      case 'course-not-found':
        return <CourseNotFound />;
      case 'quiz-not-found':
        return <QuizNotFound />;
      case 'error-display-inline':
        return (
          <div className="p-8">
            <ErrorDisplay 
              error="To jest test błędu inline" 
              variant="inline" 
              onRetry={() => alert('Retry clicked!')}
            />
          </div>
        );
      case 'error-display-card':
        return (
          <div className="p-8">
            <ErrorDisplay 
              error="To jest test błędu w karcie" 
              variant="card" 
              onRetry={() => alert('Retry clicked!')}
            />
          </div>
        );
      case 'error-display-full':
        return (
          <ErrorDisplay 
            error="To jest test błędu pełnoekranowego" 
            variant="full" 
            onRetry={() => alert('Retry clicked!')}
          />
        );
      case 'error-boundary':
        return (
          <ErrorBoundary>
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-4">Test ErrorBoundary</h2>
              <button 
                onClick={() => {
                  throw new Error('Test error for ErrorBoundary');
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Rzuć błąd
              </button>
            </div>
          </ErrorBoundary>
        );
      default:
        return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-8">
                🧪 Test Komponentów Błędów
              </h1>
              
              <p className="text-xl text-gray-600 mb-8">
                Wybierz komponent do przetestowania. Wszystkie komponenty są w pełni responsywne.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto">
                <button
                  onClick={() => setActiveComponent('not-found')}
                  className="p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-all duration-200 hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">NotFound</h3>
                  <p className="text-sm text-gray-600">Główny komponent 404 z wyszukiwarką</p>
                </button>

                <button
                  onClick={() => setActiveComponent('course-not-found')}
                  className="p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-all duration-200 hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">CourseNotFound</h3>
                  <p className="text-sm text-gray-600">Specjalizowany dla nieistniejących kursów</p>
                </button>

                <button
                  onClick={() => setActiveComponent('quiz-not-found')}
                  className="p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-all duration-200 hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">QuizNotFound</h3>
                  <p className="text-sm text-gray-600">Specjalizowany dla nieistniejących quizów</p>
                </button>

                <button
                  onClick={() => setActiveComponent('error-display-inline')}
                  className="p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-all duration-200 hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">ErrorDisplay - Inline</h3>
                  <p className="text-sm text-gray-600">Mały błąd w linii</p>
                </button>

                <button
                  onClick={() => setActiveComponent('error-display-card')}
                  className="p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-all duration-200 hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">ErrorDisplay - Card</h3>
                  <p className="text-sm text-gray-600">Błąd w karcie</p>
                </button>

                <button
                  onClick={() => setActiveComponent('error-display-full')}
                  className="p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-all duration-200 hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">ErrorDisplay - Full</h3>
                  <p className="text-sm text-gray-600">Pełnoekranowy błąd</p>
                </button>

                <button
                  onClick={() => setActiveComponent('error-boundary')}
                  className="p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-all duration-200 hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">ErrorBoundary</h3>
                  <p className="text-sm text-gray-600">React Error Boundary</p>
                </button>
              </div>

              <div className="mt-12 p-6 bg-blue-50 rounded-lg border border-blue-200 max-w-2xl mx-auto">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">📱 Test Responsywności</h3>
                <p className="text-sm text-blue-700">
                  Zmień rozmiar okna przeglądarki lub użyj DevTools do sprawdzenia różnych rozmiarów ekranu.
                  Wszystkie komponenty automatycznie dostosowują się do rozmiaru ekranu.
                </p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {activeComponent !== 'menu' && (
        <div className="fixed top-4 left-4 z-50">
          <button
            onClick={() => setActiveComponent('menu')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Powrót do menu
          </button>
        </div>
      )}
      
      {renderComponent()}
    </div>
  );
}














