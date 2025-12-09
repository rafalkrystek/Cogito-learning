"use client";
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';

interface ContentBlock {
  id: string | number;
  type: "text" | "file" | "video" | "quiz" | "math" | "task";
  content?: string;
  title?: string;
  fileUrl?: string;
  videoUrl?: string;
  youtubeUrl?: string;
  videoSource?: 'upload' | 'youtube';
  quizId?: string;
  mathContent?: string;
  order: number;
  fileSize?: number;
  fileError?: string;
}

interface DraggableContentBlockProps {
  block: ContentBlock;
  onDelete: (blockId: number) => void;
  onAddAfter: (index: number) => void;
  index: number;
  children: React.ReactNode;
  showDropIndicator?: boolean;
}

export const DraggableContentBlock: React.FC<DraggableContentBlockProps> = ({
  block,
  onDelete,
  onAddAfter,
  index,
  children,
  showDropIndicator = false
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return '📄';
      case 'file': return '📎';
      case 'video': return '🎥';
      case 'quiz': return '❓';
      case 'math': return '🧮';
      case 'task': return '✏️';
      default: return '📄';
    }
  };

  return (
    <>
      {/* Drop indicator */}
      {showDropIndicator && (
        <div className="h-1 bg-blue-400 rounded-full mx-4 mb-2 animate-pulse"></div>
      )}
      
      <div
        ref={setNodeRef}
        style={style}
        className={`bg-white p-4 rounded-lg border-2 transition-all duration-200 ${
          isDragging 
            ? 'shadow-xl border-blue-400 bg-blue-50 transform rotate-1' 
            : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
        }`}
      >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab hover:cursor-grabbing p-2 hover:bg-gray-100 rounded transition-all duration-200 hover:scale-110"
            title="Przeciągnij aby zmienić kolejność"
          >
            <GripVertical className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          </div>
          
          <span className="text-lg">{getTypeIcon(block.type)}</span>
          <span className="font-medium capitalize">{block.type}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAddAfter(index + 1)}
            className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1 rounded hover:bg-blue-50 transition-colors"
          >
            + Dodaj po
          </button>
          <button
            onClick={() => onDelete(Number(block.id))}
            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
            title="Usuń blok"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {/* Zawartość bloku */}
      <div className="ml-6">
        {children}
      </div>
      </div>
    </>
  );
};
