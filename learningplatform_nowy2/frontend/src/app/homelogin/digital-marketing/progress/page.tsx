"use client";
import { ArrowLeft } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

export default function ProgressPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full">
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Header z przyciskiem powrotu */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => window.location.href = '/homelogin'}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Powrót
          </button>
          
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Twój postęp
          </h1>
          
          <div className="w-20"></div>
        </div>
      </div>
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg p-8 flex flex-col items-center border border-white/20">
          <div className="mb-4 text-lg text-gray-700">Progress Chart</div>
          <svg viewBox="0 0 200 80" className="w-full h-24">
            <rect x="20" y="40" width="20" height="30" fill="#4067EC" rx="4" />
            <rect x="50" y="30" width="20" height="40" fill="#4067EC" rx="4" />
            <rect x="80" y="20" width="20" height="50" fill="#4067EC" rx="4" />
            <rect x="110" y="10" width="20" height="60" fill="#4067EC" rx="4" />
            <rect x="140" y="25" width="20" height="45" fill="#4067EC" rx="4" />
          </svg>
        </div>
      </main>
    </div>
  );
} 

