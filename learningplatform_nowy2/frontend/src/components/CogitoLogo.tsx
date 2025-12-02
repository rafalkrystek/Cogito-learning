import React from 'react';
import Image from 'next/image';

interface CogitoLogoProps {
  className?: string;
  size?: number;
  alt?: string;
}

export default function CogitoLogo({ className = '', size = 32, alt = 'Cogito Logo' }: CogitoLogoProps) {
  return (
    <div className={`relative ${className}`} style={{ width: `${size}px`, height: `${size}px` }}>
      <Image
        src="/cogito-logo.png"
        alt={alt}
        width={size}
        height={size}
        className="brightness-0 dark:brightness-100 object-contain"
        style={{ width: '100%', height: '100%' }}
        onError={(e) => {
          // Fallback jeśli logo nie może być załadowane
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
        }}
      />
    </div>
  );
}

