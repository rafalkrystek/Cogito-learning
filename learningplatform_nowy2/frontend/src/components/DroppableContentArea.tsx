"use client";
import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { DropZoneIndicator } from './DropZoneIndicator';

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

interface DroppableContentAreaProps {
  contentBlocks: ContentBlock[];
  onReorder: (newOrder: ContentBlock[]) => void;
  children: React.ReactNode;
}

export const DroppableContentArea: React.FC<DroppableContentAreaProps> = ({
  contentBlocks,
  onReorder,
  children
}) => {
  const [activeId, setActiveId] = React.useState<string | number | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = contentBlocks.findIndex((block) => block.id === active.id);
      const newIndex = contentBlocks.findIndex((block) => block.id === over.id);

      const newOrder = arrayMove(contentBlocks, oldIndex, newIndex);
      
      // Aktualizuj kolejność w blokach
      const updatedOrder = newOrder.map((block, index) => ({
        ...block,
        order: index
      }));

      onReorder(updatedOrder);
    }
  };

  const activeBlock = contentBlocks.find(block => block.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis]}
    >
      <SortableContext
        items={contentBlocks.map(block => block.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {/* Drop zone indicator at the top */}
          <DropZoneIndicator 
            isVisible={!!activeId && contentBlocks.length === 0} 
            text="Upuść tutaj aby dodać pierwszy element"
          />
          {children}
        </div>
      </SortableContext>
      
      <DragOverlay>
        {activeBlock ? (
          <div className="bg-white p-4 rounded-lg border-2 border-blue-400 shadow-xl transform rotate-2 opacity-90">
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {activeBlock.type === 'text' && '📄'}
                {activeBlock.type === 'file' && '📎'}
                {activeBlock.type === 'video' && '🎥'}
                {activeBlock.type === 'quiz' && '❓'}
                {activeBlock.type === 'math' && '🧮'}
                {activeBlock.type === 'task' && '✏️'}
              </span>
              <span className="font-medium capitalize">{activeBlock.type}</span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
