"use client";
import React, { useRef, useCallback, useEffect, useState } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  List, 
  ListOrdered, 
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo,
  Redo,
  Type,
  Palette
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = "Wpisz tekst...",
  minHeight = "120px",
  className = ""
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(!value);
  const [showFontSize, setShowFontSize] = useState(false);
  const [showColors, setShowColors] = useState(false);

  // Inicjalizacja zawartości
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value;
      setIsEmpty(!value || value === '<br>' || value === '');
    }
  }, [value]);

  // Wykonaj polecenie formatowania
  const execCommand = useCallback((command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    
    // Aktualizuj wartość
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  // Obsługa zmiany zawartości
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      setIsEmpty(!content || content === '<br>' || content === '');
      onChange(content);
    }
  }, [onChange]);

  // Obsługa wklejania - usuń formatowanie HTML z zewnątrz
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  // Obsługa skrótów klawiszowych
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          execCommand('bold');
          break;
        case 'i':
          e.preventDefault();
          execCommand('italic');
          break;
        case 'u':
          e.preventDefault();
          execCommand('underline');
          break;
        case 'z':
          e.preventDefault();
          execCommand('undo');
          break;
        case 'y':
          e.preventDefault();
          execCommand('redo');
          break;
      }
    }
  }, [execCommand]);

  const fontSizes = [
    { label: 'Mały', value: '1' },
    { label: 'Normalny', value: '3' },
    { label: 'Średni', value: '4' },
    { label: 'Duży', value: '5' },
    { label: 'Bardzo duży', value: '6' },
  ];

  const colors = [
    '#000000', '#374151', '#6B7280', '#EF4444', '#F97316', 
    '#EAB308', '#22C55E', '#14B8A6', '#3B82F6', '#8B5CF6', 
    '#EC4899', '#FFFFFF'
  ];

  const toolbarButtons = [
    { 
      icon: Undo, 
      title: 'Cofnij (Ctrl+Z)', 
      action: () => execCommand('undo'),
    },
    { 
      icon: Redo, 
      title: 'Ponów (Ctrl+Y)', 
      action: () => execCommand('redo'),
    },
    { type: 'separator' },
    { 
      icon: Bold, 
      title: 'Pogrubienie (Ctrl+B)', 
      action: () => execCommand('bold'),
    },
    { 
      icon: Italic, 
      title: 'Kursywa (Ctrl+I)', 
      action: () => execCommand('italic'),
    },
    { 
      icon: Underline, 
      title: 'Podkreślenie (Ctrl+U)', 
      action: () => execCommand('underline'),
    },
    { 
      icon: Strikethrough, 
      title: 'Przekreślenie', 
      action: () => execCommand('strikeThrough'),
    },
    { type: 'separator' },
    { 
      icon: Type, 
      title: 'Rozmiar czcionki', 
      action: () => setShowFontSize(!showFontSize),
      isDropdown: true,
      dropdownOpen: showFontSize,
    },
    { 
      icon: Palette, 
      title: 'Kolor tekstu', 
      action: () => setShowColors(!showColors),
      isDropdown: true,
      dropdownOpen: showColors,
    },
    { type: 'separator' },
    { 
      icon: AlignLeft, 
      title: 'Wyrównaj do lewej', 
      action: () => execCommand('justifyLeft'),
    },
    { 
      icon: AlignCenter, 
      title: 'Wyśrodkuj', 
      action: () => execCommand('justifyCenter'),
    },
    { 
      icon: AlignRight, 
      title: 'Wyrównaj do prawej', 
      action: () => execCommand('justifyRight'),
    },
    { 
      icon: AlignJustify, 
      title: 'Wyjustuj (wyrównaj do obu marginesów)', 
      action: () => execCommand('justifyFull'),
    },
    { type: 'separator' },
    { 
      icon: List, 
      title: 'Lista punktowana', 
      action: () => execCommand('insertUnorderedList'),
    },
    { 
      icon: ListOrdered, 
      title: 'Lista numerowana', 
      action: () => execCommand('insertOrderedList'),
    },
  ];

  return (
    <div className={`border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-sm ${className}`}>
      {/* Pasek narzędzi */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 relative">
        {toolbarButtons.map((button, index) => {
          if ('type' in button && button.type === 'separator') {
            return (
              <div 
                key={`sep-${index}`} 
                className="w-px h-6 bg-gray-300 dark:bg-gray-500 mx-1"
              />
            );
          }
          
          if (!('action' in button) || !button.action) return null;
          const Icon = button.icon;
          return (
            <div key={index} className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  button.action();
                }}
                onMouseDown={(e) => e.preventDefault()}
                title={button.title}
                className={`p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors ${
                  'dropdownOpen' in button && button.dropdownOpen ? 'bg-gray-200 dark:bg-gray-600' : ''
                }`}
              >
                <Icon size={18} />
              </button>
            </div>
          );
        })}

        {/* Dropdown rozmiaru czcionki */}
        {showFontSize && (
          <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 py-1">
            {fontSizes.map((size) => (
              <button
                key={size.value}
                type="button"
                onClick={() => {
                  execCommand('fontSize', size.value);
                  setShowFontSize(false);
                }}
                onMouseDown={(e) => e.preventDefault()}
                className="block w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                {size.label}
              </button>
            ))}
          </div>
        )}

        {/* Dropdown kolorów */}
        {showColors && (
          <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 p-2">
            <div className="grid grid-cols-6 gap-1">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    execCommand('foreColor', color);
                    setShowColors(false);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  className="w-6 h-6 rounded border border-gray-300 dark:border-gray-500 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edytor WYSIWYG */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            setShowFontSize(false);
            setShowColors(false);
          }}
          className="w-full px-4 py-3 focus:outline-none dark:text-white prose prose-sm max-w-none
            [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4
            [&>*]:my-1"
          style={{ minHeight }}
          suppressContentEditableWarning
        />
        
        {/* Placeholder */}
        {isEmpty && (
          <div 
            className="absolute top-3 left-4 text-gray-400 dark:text-gray-500 pointer-events-none"
          >
            {placeholder}
          </div>
        )}
      </div>

      {/* Stopka z podpowiedziami */}
      <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 flex justify-between items-center">
        <span>
          <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs">Ctrl+B</kbd> Pogrubienie
          <span className="mx-2">•</span>
          <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs">Ctrl+I</kbd> Kursywa
          <span className="mx-2">•</span>
          <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs">Ctrl+U</kbd> Podkreślenie
        </span>
      </div>
    </div>
  );
};

export default RichTextEditor;

