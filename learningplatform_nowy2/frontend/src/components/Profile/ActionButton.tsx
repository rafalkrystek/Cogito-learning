'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import Link from 'next/link';

interface ActionButtonProps {
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  gradient: string;
  hoverGradient?: string;
}

export default function ActionButton({
  icon: Icon,
  label,
  href,
  onClick,
  gradient,
  hoverGradient
}: ActionButtonProps) {
  const className = `
    group relative overflow-hidden
    flex items-center gap-3 w-full
    px-6 py-4 rounded-xl
    bg-gradient-to-r ${gradient}
    ${hoverGradient ? `hover:bg-gradient-to-r ${hoverGradient}` : ''}
    text-white font-semibold
    shadow-lg hover:shadow-2xl
    transition-all duration-300
    transform hover:scale-[1.02] hover:-translate-y-0.5
    active:scale-[0.98]
  `;

  const content = (
    <>
      {/* Icon */}
      <div className="relative z-10 w-6 h-6 flex items-center justify-center">
        <Icon className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
      </div>

      {/* Label */}
      <span className="relative z-10 flex-1 text-left">{label}</span>

      {/* Arrow indicator */}
      <div className="relative z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>

      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  );
}

