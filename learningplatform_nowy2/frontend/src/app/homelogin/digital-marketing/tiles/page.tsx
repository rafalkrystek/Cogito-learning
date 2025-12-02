"use client";
import Image from "next/image";
import { ArrowLeft } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

const tiles = [
  { title: "Analytics", description: "Track your marketing performance.", icon: "/puzzleicon.png" },
  { title: "Campaigns", description: "Manage your ad campaigns.", icon: "/puzzleicon.png" },
  { title: "Leads", description: "View and manage your leads.", icon: "/puzzleicon.png" },
];

export default function TilesPage() {
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
            Funkcje marketingowe
          </h1>
          
          <div className="w-20"></div>
        </div>
      </div>
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {tiles.map((tile) => (
              <div key={tile.title} className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg p-6 flex flex-col items-center gap-4 border border-white/20 hover:shadow-xl transition-all duration-300">
              <Image src={tile.icon} alt={tile.title} width={48} height={48} className="rounded-lg" />
              <div className="font-semibold text-lg text-gray-800">{tile.title}</div>
              <div className="text-sm text-gray-500 text-center">{tile.description}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
} 

