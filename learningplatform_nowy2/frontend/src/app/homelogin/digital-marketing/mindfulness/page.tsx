"use client";
import { ArrowLeft } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

const mindfulnessResources = [
  { title: "Mindful Breathing", type: "Exercise", duration: "10 min" },
  { title: "Guided Meditation", type: "Audio", duration: "20 min" },
  { title: "Stress Relief Tips", type: "Article", duration: "5 min read" },
];

export default function MindfulnessPage() {
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
            Zasoby mindfulness
          </h1>
          
          <div className="w-20"></div>
        </div>
      </div>
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {mindfulnessResources.map((item) => (
            <div key={item.title} className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg p-6 flex flex-col gap-2 border border-white/20 hover:shadow-xl transition-all duration-300">
              <div className="font-semibold text-lg text-gray-800">{item.title}</div>
              <div className="text-sm text-gray-500">{item.type}</div>
              <div className="text-xs text-gray-400">{item.duration}</div>
              <button className="mt-2 bg-gradient-to-r from-[#4067EC] to-[#5577FF] text-white px-4 py-2 rounded-lg font-semibold hover:from-[#3155d4] hover:to-[#4067EC] transition-all duration-200 shadow-sm hover:shadow-lg">Rozpocznij</button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
} 

