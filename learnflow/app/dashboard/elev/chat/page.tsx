'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useElev } from '@/app/context/ElevContext';
import { MessageCircle, Send, User, BrainCircuit, Loader2, ChevronLeft, PenTool } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function StudentChatPage() {
  const { userName, className } = useElev();
  const router = useRouter();
  const searchParams = useSearchParams();
  const materialId = searchParams.get('materialId') || '';
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: `Salut, ${userName}! Sunt Tutorul tău AI. Cum te pot ajuta azi cu materialele de la clasă?` }
  ]);
  const [input, setInput] = useState(searchParams.get('prompt') || '');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          className,
          materialId
        }),
      });

      if (!response.ok) {
        throw new Error('Eroare la comunicarea cu serverul.');
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Scuze, a apărut o eroare la generarea răspunsului. Te rog încearcă din nou.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col relative h-screen overflow-hidden bg-[#020617] text-slate-200 font-sans selection:bg-purple-500/30">

      {/* Background Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white/[0.02] border-b border-white/10 relative z-10 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/elev')}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10 group"
          >
            <ChevronLeft className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
            <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Înapoi la Dashboard</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Tutor AI</h1>
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Online
              </p>
            </div>
          </div>
        </div>
        
        {materialId && (
          <button
            onClick={() => router.push(`/dashboard/elev/test/${materialId}`)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/20"
          >
            <PenTool className="w-4 h-4" />
            <span>Testează-mă</span>
          </button>
        )}
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex items-end gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-purple-600' : 'bg-blue-600'
                }`}>
                {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <MessageCircle className="w-4 h-4 text-white" />}
              </div>
              <div className={`max-w-[80%] px-5 py-3 rounded-2xl ${msg.role === 'user'
                  ? 'bg-purple-600 text-white rounded-br-sm'
                  : 'bg-slate-800 text-slate-200 rounded-bl-sm border border-white/5 shadow-lg'
                }`}>
                <div className="leading-relaxed overflow-x-auto text-sm md:text-base">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      p: ({ node, ...props }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap" {...props} />,
                      ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
                      ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-end gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <div className="px-5 py-4 rounded-2xl bg-slate-800 rounded-bl-sm border border-white/5 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                <span className="text-sm text-slate-400">Tutorul scrie...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white/[0.02] border-t border-white/10 relative z-10 backdrop-blur-md">
        <div className="max-w-4xl mx-auto relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            placeholder="Întreabă-mă orice din materialele tale..."
            className="w-full bg-black/40 border border-white/10 rounded-2xl pl-5 pr-14 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:bg-black/60 transition-all shadow-inner"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
