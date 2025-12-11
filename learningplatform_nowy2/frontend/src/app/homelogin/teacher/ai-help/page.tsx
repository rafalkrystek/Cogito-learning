"use client";

import React, { useState, useRef } from 'react';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import firebaseApp from '@/config/firebase';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft } from 'lucide-react';

interface Message {
  role: 'user' | 'ai';
  content: string;
}

// Inicjalizacja AI Logic SDK
const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, { model: 'gemini-2.5-flash' });

export default function AIHelpPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function getRecaptchaToken() {
    // @ts-expect-error grecaptcha is loaded dynamically
    if (window.grecaptcha) {
      // @ts-expect-error grecaptcha API types are not available
      return await window.grecaptcha.execute('khbjasd76892kbasbd89621-21', { action: 'chat' });
    }
    return '';
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    const userMsg: Message = { role: 'user', content: input };
    setMessages(msgs => [...msgs, userMsg]);
    const currentInput = input;
    setInput('');
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const recaptchaToken = await getRecaptchaToken();
      const result = await model.generateContent(currentInput);
      const response = result.response;
      const text = response.text();
      setMessages(msgs => [...msgs, { role: 'ai', content: text || 'Brak odpowiedzi AI.' }]);
    } catch (err) {
      setMessages(msgs => [...msgs, { role: 'ai', content: 'Wystąpił błąd AI.' }]);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Wystąpił nieznany błąd.');
      }
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Header z przyciskiem powrotu */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => window.location.href = '/homelogin'}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Powrót</span>
          </button>

          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Pomoc AI
          </h1>

          <div className="w-20"></div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Pomoc AI</h2>
            <p className="text-gray-600">Asystent AI dla nauczycieli</p>
          </div>

      {/* Main Chat Interface */}
      <div className="bg-white rounded-lg border border-gray-200 h-[calc(100vh-250px)] flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-semibold">AI</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Asystent Edukacyjny</h3>
              <p className="text-sm text-gray-500">Asystent AI dla nauczycieli</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-blue-600 text-xl font-bold">AI</span>
              </div>
              <p className="text-lg font-medium mb-2">Witaj w Pomocy AI!</p>
              <p>Zadaj pytanie dotyczące nauczania, planowania lekcji, quizów lub innych zadań edukacyjnych.</p>
            </div>
          )}
          
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg px-4 py-3 ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {msg.role === 'ai' ? (
                  <div className="space-y-2">
                    <ReactMarkdown 
                      components={{
                        p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({children}) => <ul className="list-disc list-inside space-y-1">{children}</ul>,
                        ol: ({children}) => <ol className="list-decimal list-inside space-y-1">{children}</ol>,
                        strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                        code: ({children}) => <code className="bg-gray-200 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
                        h1: ({children}) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                        h2: ({children}) => <h2 className="text-base font-bold mb-1">{children}</h2>,
                        h3: ({children}) => <h3 className="text-sm font-bold mb-1">{children}</h3>
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-800 rounded-lg px-4 py-3 max-w-[80%]">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-r-transparent"></div>
                  <span>AI myśli...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Message Input */}
        <form onSubmit={sendMessage} className="p-4 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Zadaj pytanie AI..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
            />
            <button 
              type="submit" 
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
              disabled={loading || !input.trim()}
            >
              Wyślij
            </button>
          </div>
          {error && (
            <div className="mt-2 text-red-500 text-sm">{error}</div>
          )}
        </form>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => setInput('Pomóż mi stworzyć quiz z matematyki dla 8 klasy')}
          className="p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
        >
          <div className="text-blue-600 mb-2">📝</div>
          <h3 className="font-medium">Generuj Quiz</h3>
          <p className="text-sm text-gray-500">Stwórz quiz na dowolny temat</p>
        </button>

        <button
          onClick={() => setInput('Stwórz plan lekcji z biologii na temat fotosynteza')}
          className="p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
        >
          <div className="text-green-600 mb-2">📚</div>
          <h3 className="font-medium">Plan Lekcji</h3>
          <p className="text-sm text-gray-500">Przygotuj szczegółowy plan</p>
        </button>

        <button
          onClick={() => setInput('Jak mogę ocenić pracę pisemną ucznia?')}
          className="p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
        >
          <div className="text-yellow-600 mb-2">⭐</div>
          <h3 className="font-medium">Ocena Prac</h3>
          <p className="text-sm text-gray-500">Porady dot. oceniania</p>
        </button>

        <button
          onClick={() => setInput('Znajdź materiały edukacyjne do nauki języka angielskiego')}
          className="p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
        >
          <div className="text-purple-600 mb-2">💡</div>
          <h3 className="font-medium">Materiały</h3>
          <p className="text-sm text-gray-500">Znajdź zasoby edukacyjne</p>
        </button>
      </div>
        </div>
      </div>
    </div>
  );
}