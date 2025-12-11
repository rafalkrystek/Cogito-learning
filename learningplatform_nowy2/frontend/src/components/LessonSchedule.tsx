"use client";
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

interface TimeSlot {
  startTime: string;
  endTime: string;
  label: string;
}

const timeSlots: TimeSlot[] = [
  { startTime: "8:00", endTime: "8:45", label: "1" },
  { startTime: "8:55", endTime: "9:40", label: "2" },
  { startTime: "9:50", endTime: "10:35", label: "3" },
  { startTime: "10:45", endTime: "11:30", label: "4" },
  { startTime: "11:40", endTime: "12:25", label: "5" },
  { startTime: "12:45", endTime: "13:30", label: "6" },
  { startTime: "13:40", endTime: "14:25", label: "7" },
  { startTime: "14:35", endTime: "15:20", label: "8" }
];

const daysOfWeek = [
  { id: 0, name: 'Poniedziałek' },
  { id: 1, name: 'Wtorek' },
  { id: 2, name: 'Środa' },
  { id: 3, name: 'Czwartek' },
  { id: 4, name: 'Piątek' }
];

const monthsPl = [
  'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
];

function formatDateRange(date: Date): string {
  const monday = new Date(date);
  const dayOfWeek = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - dayOfWeek);
  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);
  return `${monday.getDate()}-${friday.getDate()} ${monthsPl[monday.getMonth()]}`;
}

const LessonSchedule: React.FC = () => {
  const [current, setCurrent] = useState(() => new Date());
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  const prevWeek = () => setCurrent(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; });
  const nextWeek = () => setCurrent(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; });
  const prevDay = () => setSelectedDayIndex(prev => (prev > 0 ? prev - 1 : 4));
  const nextDay = () => setSelectedDayIndex(prev => (prev < 4 ? prev + 1 : 0));

  const selectedDay = daysOfWeek[selectedDayIndex];

  return (
    <div className="w-full">
      {/* ===== MOBILE: jeden dzień na raz ===== */}
      <div className="block lg:hidden">
        <div className="flex items-center justify-between mb-3 p-2 bg-slate-100 rounded-lg">
          <button onClick={prevWeek} className="p-2 bg-slate-200 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium">{formatDateRange(current)}</span>
          <button onClick={nextWeek} className="p-2 bg-slate-200 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
        </div>

        <div className="flex items-center justify-between mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4">
          <button onClick={prevDay} className="p-3 bg-white/20 rounded-xl"><ChevronLeft className="w-6 h-6 text-white" /></button>
          <div className="text-center">
            <div className="text-xl font-bold text-white">{selectedDay.name}</div>
            <div className="text-xs text-white/70">{selectedDayIndex + 1} / 5</div>
          </div>
          <button onClick={nextDay} className="p-3 bg-white/20 rounded-xl"><ChevronRight className="w-6 h-6 text-white" /></button>
        </div>

        <div className="space-y-2">
          {timeSlots.map((slot, i) => (
            <div key={i} className="flex bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="bg-blue-600 text-white p-3 flex flex-col justify-center items-center min-w-[70px]">
                <div className="text-sm font-bold">{slot.startTime}</div>
                <div className="text-[10px] opacity-70">{slot.endTime}</div>
              </div>
              <div className="flex-1 p-3 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Lekcja {slot.label}</div>
                  <div className="text-sm text-slate-600">Brak lekcji</div>
                </div>
                <button className="p-2 bg-slate-100 rounded-lg"><Plus className="w-4 h-4 text-blue-500" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== DESKTOP: cały tydzień ===== */}
      <div className="hidden lg:block">
        <div className="flex items-center justify-between mb-8 p-6 bg-slate-50 rounded-2xl">
          <button onClick={prevWeek} className="p-4 rounded-xl bg-blue-600 text-white"><ChevronLeft className="w-6 h-6" /></button>
          <div className="text-center">
            <div className="font-bold text-2xl">{monthsPl[current.getMonth()]} {current.getFullYear()}</div>
            <div className="text-sm text-slate-600">{formatDateRange(current)}</div>
          </div>
          <button onClick={nextWeek} className="p-4 rounded-xl bg-blue-600 text-white"><ChevronRight className="w-6 h-6" /></button>
        </div>

        <div className="border rounded-2xl overflow-hidden bg-white">
          <div className="grid grid-cols-6">
            <div className="font-bold p-4 text-center border-b border-r bg-blue-600 text-white">Godzina</div>
            {daysOfWeek.map(d => (
              <div key={d.id} className="font-bold p-4 text-center border-b border-r last:border-r-0 bg-blue-600 text-white">{d.name}</div>
            ))}
            {timeSlots.map((slot, i) => (
              <React.Fragment key={i}>
                <div className="border-r border-b p-4 bg-slate-50">
                  <div className="font-bold text-blue-600">{slot.startTime} - {slot.endTime}</div>
                  <div className="text-sm text-slate-500">Lekcja {slot.label}</div>
                </div>
                {daysOfWeek.map(d => (
                  <div key={`${i}-${d.id}`} className="border-r border-b last:border-r-0 p-4 hover:bg-slate-50 cursor-pointer">
                    <div className="text-sm text-slate-400">{slot.startTime}</div>
                    <div className="text-xs text-slate-300">Kliknij aby dodać</div>
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LessonSchedule;
