'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { Camera, User } from 'lucide-react';

interface ProfileHeaderProps {
  photoURL: string;
  displayName: string;
  email: string;
  classNames: string[];
  onPhotoChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading?: boolean;
  uploadSuccess?: boolean;
  uploadError?: string | null;
  canEdit?: boolean;
}

export default function ProfileHeader({
  photoURL,
  displayName,
  email,
  classNames,
  onPhotoChange,
  uploading = false,
  uploadSuccess = false,
  uploadError = null,
  canEdit = true
}: ProfileHeaderProps) {
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoClick = () => {
    if (canEdit && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="relative">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 opacity-10 rounded-3xl"></div>
      
      <div className="relative bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700 p-8">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Profile Photo */}
          <div className="relative group">
            <div
              className={`
                relative w-32 h-32 md:w-40 md:h-40 rounded-full
                border-4 border-white dark:border-gray-700
                shadow-2xl overflow-hidden
                transition-all duration-300
                ${canEdit ? 'cursor-pointer' : ''}
                ${isHovered && canEdit ? 'ring-4 ring-blue-500/50 scale-105' : ''}
              `}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={handlePhotoClick}
            >
              {photoURL ? (
                <Image
                  src={photoURL}
                  alt="Profile picture"
                  width={160}
                  height={160}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <User className="w-16 h-16 text-white" />
                </div>
              )}

              {/* Upload overlay */}
              {isHovered && canEdit && !uploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-300">
                  <div className="text-center text-white">
                    <Camera className="w-8 h-8 mx-auto mb-2" />
                    <div className="text-xs font-medium">Kliknij aby zmienić</div>
                  </div>
                </div>
              )}

              {/* Uploading indicator */}
              {uploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent"></div>
                </div>
              )}

              {/* Upload button */}
              {canEdit && (
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={onPhotoChange}
                />
              )}
            </div>

            {/* Status indicator */}
            <div className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 rounded-full border-4 border-white dark:border-gray-800 shadow-lg animate-pulse"></div>
          </div>

          {/* Profile Info */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
              {displayName || 'Brak imienia i nazwiska'}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-4 text-lg">
              {email || 'Brak adresu email'}
            </p>

            {/* Class badges */}
            {classNames.length > 0 && (
              <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
                {classNames.map((className, index) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full text-sm font-medium shadow-md hover:shadow-lg transition-shadow duration-300"
                  >
                    {className}
                  </span>
                ))}
              </div>
            )}

            {/* Upload status messages */}
            {uploadSuccess && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm font-medium">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Zdjęcie zostało zaktualizowane!
              </div>
            )}
            {uploadError && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm font-medium">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {uploadError}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

