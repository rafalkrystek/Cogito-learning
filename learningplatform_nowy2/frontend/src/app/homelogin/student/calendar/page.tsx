'use client';

import dynamic from 'next/dynamic';
import { Suspense, memo } from 'react';

// Lazy load Calendar - ciężki komponent z preload: false dla lepszej wydajności na mobile
const Calendar = dynamic(() => import('@/components/Calendar'), { 
  ssr: false,
  loading: () => (
    <div className="h-96 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg flex items-center justify-center">
      <div className="text-gray-500 dark:text-gray-400">Ładowanie kalendarza...</div>
    </div>
  )
});

const StudentCalendarPage = memo(function StudentCalendarPage() {
  return (
    <div className="p-4 sm:p-6 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-gray-900 dark:text-white">
        Kalendarz wydarzeń
      </h1>
      <Suspense 
        fallback={
          <div className="h-96 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg flex items-center justify-center">
            <div className="text-gray-500 dark:text-gray-400">Ładowanie kalendarza...</div>
          </div>
        }
      >
        <Calendar />
      </Suspense>
    </div>
  );
});

export default StudentCalendarPage;

