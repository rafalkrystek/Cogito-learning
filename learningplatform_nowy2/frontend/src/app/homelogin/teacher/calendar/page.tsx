'use client';
import dynamic from 'next/dynamic';
import { ArrowLeft } from 'lucide-react';
import { Suspense } from 'react';

// Lazy load ciężkie komponenty
const CreateEvent = dynamic(() => import('../../../../components/CreateEvent'), { 
  ssr: false,
  loading: () => <div className="h-32 bg-gray-100 animate-pulse rounded-lg" />
});
const Calendar = dynamic(() => import('../../../../components/Calendar'), { 
  ssr: false,
  loading: () => <div className="h-96 bg-gray-100 animate-pulse rounded-lg" />
});

export default function TeacherCalendarPage() {
  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full max-w-full overflow-hidden flex flex-col" style={{ maxWidth: '100vw' }}>
      {/* Header z przyciskiem powrotu - Fixed */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <button
            onClick={() => window.location.href = '/homelogin'}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Powrót</span>
          </button>

          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Kalendarz i Aktywności
          </h1>

          <div className="w-20"></div>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Header */}
        <header className="w-full bg-white/90 backdrop-blur-xl shadow-sm border-b border-white/20 flex items-center justify-between px-8 py-4 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-[#4067EC]">Kalendarz i Aktywności</h2>
            <p className="text-gray-600">Zarządzaj wydarzeniami i harmonogramem zajęć</p>
          </div>
        </header>

      {/* Main Content */}
      <main className="flex-1 p-2 lg:p-4">
        <div className="h-full flex flex-col">
          {/* Create Event Section - Compact */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6 mb-4 lg:mb-6">
            <Suspense fallback={<div className="h-32 bg-gray-100 animate-pulse rounded-lg" />}>
              <CreateEvent />
            </Suspense>
          </div>

          {/* Calendar Section - FULL WIDTH & HEIGHT */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 lg:p-4 flex-1 min-h-0">
            <h2 className="text-lg font-semibold text-gray-800 mb-3 lg:mb-4">Kalendarz wydarzeń</h2>
            <div className="h-full w-full flex-1">
              <Suspense fallback={<div className="h-96 bg-gray-100 animate-pulse rounded-lg" />}>
                <Calendar />
              </Suspense>
            </div>
          </div>
        </div>
      </main>
        </div>
    </div>
  );
} 