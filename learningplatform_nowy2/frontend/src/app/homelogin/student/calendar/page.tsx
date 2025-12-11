'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Lazy load Calendar - ciężki komponent
const Calendar = dynamic(() => import('@/components/Calendar'), { 
  ssr: false,
  loading: () => <div className="h-96 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />
});

export default function StudentCalendarPage() {
  return (
    <div className="p-6 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Kalendarz wydarzeń</h1>
      <Suspense fallback={<div className="h-96 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />}>
        <Calendar />
      </Suspense>
    </div>
  );
}

