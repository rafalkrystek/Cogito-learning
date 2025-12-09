'use client';

import { useEffect, useRef, useState } from 'react';
import type { MathfieldElement } from 'mathlive';

interface MathViewProps {
  content: string;
}

export default function MathView({ content }: MathViewProps) {
  const mathFieldRef = useRef<MathfieldElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Dynamically import mathlive and configure fonts
  useEffect(() => {
    const loadMathLive = async () => {
      const MathLive = await import('mathlive');
      // Configure fonts directory to use CDN
      MathLive.MathfieldElement.fontsDirectory = 'https://unpkg.com/mathlive/dist/fonts/';
      setIsLoaded(true);
    };
    loadMathLive();
  }, []);

  useEffect(() => {
    if (mathFieldRef.current && isLoaded) {
      const mathField = mathFieldRef.current;
      mathField.value = content;
    }
  }, [content, isLoaded]);

  if (!isLoaded) {
    return <div className="animate-pulse bg-gray-200 h-8 rounded" style={{ minWidth: '200px' }} />;
  }

  return (
    // @ts-expect-error math-field is a custom element provided by mathlive
    <math-field
      ref={mathFieldRef as unknown as React.Ref<MathfieldElement>}
      read-only
      style={{ minWidth: '200px', padding: '8px', border: 'none', background: 'transparent' }}
    />
  );
}