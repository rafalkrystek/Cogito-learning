'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sublabel?: string;
  gradient: string;
  iconBg: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  onClick?: () => void;
}

export default function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  gradient,
  iconBg,
  trend,
  onClick
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        group relative overflow-hidden rounded-2xl p-6 
        bg-gradient-to-br ${gradient} 
        shadow-lg hover:shadow-2xl 
        transition-all duration-300 
        transform hover:scale-105 hover:-translate-y-1
        ${onClick ? 'cursor-pointer' : ''}
        border border-white/20
      `}
    >
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.3),transparent_50%)] animate-pulse"></div>
      </div>

      <div className="relative z-10">
        {/* Icon */}
        <div className={`
          w-14 h-14 rounded-xl ${iconBg} 
          flex items-center justify-center mb-4
          group-hover:scale-110 group-hover:rotate-3
          transition-transform duration-300
          shadow-lg
        `}>
          <Icon className="w-7 h-7 text-white" />
        </div>

        {/* Value */}
        <div className="text-3xl font-bold text-white mb-1 group-hover:scale-110 transition-transform duration-300">
          {value}
        </div>

        {/* Label */}
        <div className="text-sm font-medium text-white/90 mb-1">
          {label}
        </div>

        {/* Sublabel */}
        {sublabel && (
          <div className="text-xs text-white/70">
            {sublabel}
          </div>
        )}

        {/* Trend */}
        {trend && (
          <div className={`
            mt-3 flex items-center gap-1 text-xs font-semibold
            ${trend.isPositive ? 'text-green-200' : 'text-red-200'}
          `}>
            <span>{trend.isPositive ? '↑' : '↓'}</span>
            <span>{trend.value}</span>
          </div>
        )}
      </div>

      {/* Hover effect overlay */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300 rounded-2xl"></div>
    </div>
  );
}

