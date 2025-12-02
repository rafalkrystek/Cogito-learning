'use client';

import React, { useState } from 'react';
import { Trophy } from 'lucide-react';

interface BadgeLevel {
  name: string;
  threshold: number;
  gradient: string;
}

interface BadgeCardProps {
  id: string;
  name: string;
  icon: string;
  currentLevel: number;
  currentProgress: number;
  levels: BadgeLevel[];
  nextLevelThreshold?: number;
  description?: string;
  onClick?: () => void;
}

export default function BadgeCard({
  name,
  icon,
  currentLevel,
  currentProgress,
  levels,
  nextLevelThreshold,
  description,
  onClick
}: BadgeCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const currentLevelData = levels[currentLevel];
  const isMaxLevel = currentLevel === levels.length - 1;
  
  const progressPercentage = nextLevelThreshold && nextLevelThreshold > 0
    ? Math.min(100, (currentProgress / nextLevelThreshold) * 100)
    : 100;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      className={`
        relative group overflow-hidden rounded-2xl p-6
        bg-gradient-to-br ${currentLevelData.gradient}
        border-2 border-white/30 hover:border-white/60
        transition-all duration-500
        transform hover:scale-110 hover:rotate-1
        shadow-xl hover:shadow-2xl
        ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      {/* Animated glow effect */}
      <div className={`
        absolute inset-0 bg-gradient-to-br from-white/20 to-transparent
        opacity-0 group-hover:opacity-100
        transition-opacity duration-500
      `}></div>

      {/* Level badge */}
      <div className="absolute top-3 right-3 z-10">
        <div className="px-3 py-1 rounded-full text-xs font-bold text-white bg-white/20 backdrop-blur-sm border border-white/30">
          {currentLevelData.name}
        </div>
      </div>

      {/* Icon with animation */}
      <div className="relative z-10 flex justify-center mb-4">
        <div className={`
          text-5xl transition-transform duration-500
          ${isHovered ? 'scale-125 rotate-12' : ''}
        `}>
          {icon}
        </div>
      </div>

      {/* Name */}
      <h4 className="relative z-10 text-lg font-bold text-white mb-2 text-center">
        {name}
      </h4>

      {/* Description */}
      {description && (
        <p className="relative z-10 text-xs text-white/80 text-center mb-3">
          {description}
        </p>
      )}

      {/* Level info */}
      <p className="relative z-10 text-xs text-white/90 text-center mb-4">
        Poziom {currentLevel + 1} / {levels.length}
      </p>

      {/* Progress bar */}
      {!isMaxLevel && nextLevelThreshold ? (
        <div className="relative z-10 space-y-2">
          <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden backdrop-blur-sm">
            <div
              className={`
                h-full rounded-full transition-all duration-1000 ease-out
                bg-white/60 shadow-lg
                ${isHovered ? 'animate-pulse' : ''}
              `}
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <p className="text-xs text-white/80 text-center">
            {Math.round(currentProgress)} / {nextLevelThreshold}
          </p>
        </div>
      ) : (
        <div className="relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 rounded-full backdrop-blur-sm border border-white/30">
            <Trophy className="w-4 h-4 text-yellow-300" />
            <span className="text-xs font-semibold text-white">Maksymalny poziom!</span>
          </div>
        </div>
      )}

      {/* Shine effect on hover */}
      <div className={`
        absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent
        translate-x-[-100%] group-hover:translate-x-[100%]
        transition-transform duration-1000
      `}></div>
    </div>
  );
}

