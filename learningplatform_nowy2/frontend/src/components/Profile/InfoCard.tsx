'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface InfoCardProps {
  icon: LucideIcon;
  label: string;
  value: string | React.ReactNode;
  iconBg: string;
  onClick?: () => void;
  editable?: boolean;
}

export default function InfoCard({
  icon: Icon,
  label,
  value,
  iconBg,
  onClick,
  editable = false
}: InfoCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        group relative overflow-hidden rounded-xl p-5
        bg-white dark:bg-gray-800
        border border-gray-200 dark:border-gray-700
        hover:shadow-xl hover:shadow-blue-500/10
        transition-all duration-300
        transform hover:scale-[1.02] hover:-translate-y-1
        ${onClick || editable ? 'cursor-pointer' : ''}
      `}
    >
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/5 group-hover:to-purple-500/5 transition-all duration-300"></div>

      <div className="relative z-10 flex items-start gap-4">
        {/* Icon */}
        <div className={`
          w-12 h-12 rounded-xl ${iconBg}
          flex items-center justify-center
          group-hover:scale-110 group-hover:rotate-3
          transition-transform duration-300
          shadow-md group-hover:shadow-lg
          flex-shrink-0
        `}>
          <Icon className="w-6 h-6 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
            {label}
          </div>
          <div className="text-base font-semibold text-gray-900 dark:text-white break-words">
            {value}
          </div>
        </div>

        {/* Edit indicator */}
        {editable && (
          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
          </div>
        )}
      </div>

      {/* Bottom border accent */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
    </div>
  );
}

