"use client";

import LessonSchedule from '@/components/LessonSchedule';
import Providers from '@/components/Providers';
import ThemeToggle from '@/components/ThemeToggle';
import { ArrowLeft, Calendar } from 'lucide-react';

function SchedulePageContent() {
  return (
    <div className="min-h-screen bg-slate-50 w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      <div className="w-full bg-white border-b shadow-sm">
        <div className="px-3 sm:px-6 py-3">
          {/* Mobile */}
          <div className="flex items-center justify-between sm:hidden">
            <button onClick={() => window.location.href = '/homelogin'} className="p-2 bg-blue-600 text-white rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span className="font-bold">Plan lekcji</span>
            </div>
            <ThemeToggle />
          </div>
          {/* Desktop */}
          <div className="hidden sm:flex items-center justify-between">
            <button onClick={() => window.location.href = '/homelogin'} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg">
              <ArrowLeft className="w-5 h-5" />Powrót
            </button>
            <h1 className="text-2xl font-bold text-blue-600">Plan lekcji</h1>
            <ThemeToggle />
          </div>
        </div>
      </div>
      <div className="p-3 sm:p-6">
        <LessonSchedule />
      </div>
    </div>
  );
}

export default function SchedulePage() {
  return <Providers><SchedulePageContent /></Providers>;
}
