'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Loader2, BrainCircuit, ChevronLeft, CheckCircle } from 'lucide-react';

interface Question {
  text: string;
  raspuns: string;
  dificultate: 'usor' | 'mediu' | 'greu';
  tip: 'grila' | 'scris';
  optiuni: string[] | null;
}

export default function TestPage() {
  const params = useParams();
  const router = useRouter();
  const materialId = params.materialId as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testId, setTestId] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [evaluare, setEvaluare] = useState<any>(null);

  useEffect(() => {
    async function generateTest() {
      try {
        const res = await fetch('/api/tests/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ materialId })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to generate test');
        
        setTestId(data.testId);
        setQuestions(data.questions);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Eroare la generarea testului.');
      } finally {
        setLoading(false);
      }
    }
    
    if (materialId) {
      generateTest();
    }
  }, [materialId]);

  const handleSubmit = async () => {
    if (!testId || submitting) return;
    setSubmitting(true);
    
    try {
      const res = await fetch('/api/tests/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, answers })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit test');
      
      setEvaluare(data.evaluare);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Eroare la trimiterea testului.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <BrainCircuit className="w-10 h-10 text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Generăm un test unic pentru tine...</h1>
        <p className="text-slate-400 mb-8 text-center max-w-md">
          Asistentul AI citește materialul și creează întrebările. Procesul durează aproximativ 10 secunde. Nu închide pagina!
        </p>
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-xl text-red-400 mb-4">A apărut o eroare</h1>
        <p className="text-slate-400 mb-6">{error}</p>
        <button onClick={() => router.push('/dashboard/elev')} className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
          Înapoi la Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-6 md:p-12 selection:bg-blue-500/30">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push('/dashboard/elev')}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Înapoi
        </button>

        <header className="mb-10 pb-6 border-b border-white/10">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BrainCircuit className="text-blue-500 w-8 h-8" />
            Test Generat de AI
          </h1>
          <p className="text-slate-400 mt-2">Rezolvă întrebările de mai jos. Răspunsurile tale vor fi evaluate de sistem.</p>
        </header>

        {evaluare ? (
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-8 text-center mt-10">
            <h2 className="text-2xl font-bold text-white mb-6">Rezultatul Evaluării</h2>
            
            <div className="flex flex-col items-center justify-center mb-8">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="64" cy="64" r="60" className="stroke-slate-800" strokeWidth="8" fill="none" />
                  <circle 
                    cx="64" cy="64" r="60" 
                    className="stroke-blue-500 transition-all duration-1000 ease-out" 
                    strokeWidth="8" fill="none" 
                    strokeDasharray="377" 
                    strokeDashoffset={377 - (377 * evaluare.scor_total) / 100}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-3xl font-black text-white">{evaluare.scor_total}</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">/ 100</span>
                </div>
              </div>
            </div>

            <p className="text-slate-300 text-lg leading-relaxed max-w-2xl mx-auto mb-10">
              {evaluare.feedback_general}
            </p>

            <div className="space-y-4 text-left border-t border-white/10 pt-8 mt-8">
              <h3 className="text-xl font-bold text-white mb-6">Analiză pe Întrebări</h3>
              {questions.map((q, idx) => {
                const fb = evaluare.feedback_intrebari[idx];
                return (
                  <div key={idx} className={`p-4 rounded-xl border ${fb?.este_corect ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {fb?.este_corect ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <div className="w-5 h-5 rounded-full border-2 border-red-400 flex items-center justify-center"><div className="w-2.5 h-0.5 bg-red-400 rotate-45 absolute" /><div className="w-2.5 h-0.5 bg-red-400 -rotate-45 absolute" /></div>}
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-200 mb-1">Întrebarea {idx + 1}</h4>
                        <p className="text-slate-400 text-sm mb-2">{q.text}</p>
                        <div className="text-sm font-medium text-white mb-1">Răspunsul tău: <span className="text-slate-300 font-normal">{answers[idx] || 'Nu ai răspuns'}</span></div>
                        {!fb?.este_corect && (
                          <div className="text-sm font-medium text-emerald-400 mb-2">Răspuns corect: <span className="font-normal">{q.raspuns}</span></div>
                        )}
                        <div className={`text-sm ${fb?.este_corect ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fb?.explicatie_scurta}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <button 
              onClick={() => router.push('/dashboard/elev')}
              className="mt-10 px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
            >
              Înapoi la Dashboard
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-8">
              {questions.map((q, idx) => (
                <div key={idx} className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20 uppercase tracking-wider">
                      Întrebarea {idx + 1}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-md border ${
                      q.dificultate === 'usor' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      q.dificultate === 'mediu' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {q.dificultate}
                    </span>
                    <span className="text-xs text-slate-500 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                      {q.tip === 'grila' ? 'Grilă' : 'Răspuns Liber'}
                    </span>
                  </div>
                  
                  <h2 className="text-lg md:text-xl font-medium text-white mb-6 leading-relaxed">
                    {q.text}
                  </h2>

                  {q.tip === 'grila' && q.optiuni ? (
                    <div className="space-y-3">
                      {q.optiuni.map((opt, i) => (
                        <label 
                          key={i} 
                          onClick={() => setAnswers(prev => ({ ...prev, [idx]: opt }))}
                          className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                            answers[idx] === opt 
                            ? 'bg-blue-500/10 border-blue-500/50' 
                            : 'bg-white/5 border-transparent hover:bg-white/10'
                          }`}
                        >
                          <input 
                            type="radio" 
                            name={`q-${idx}`} 
                            className="hidden" 
                            checked={answers[idx] === opt}
                            onChange={() => {}}
                          />
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            answers[idx] === opt ? 'border-blue-500' : 'border-slate-500'
                          }`}>
                            {answers[idx] === opt && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                          </div>
                          <span className={answers[idx] === opt ? 'text-white font-medium' : 'text-slate-300'}>{opt}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      placeholder="Scrie răspunsul tău aici..."
                      className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                      value={answers[idx] || ''}
                      onChange={(e) => setAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-10 flex justify-end">
              <button 
                onClick={handleSubmit}
                disabled={submitting}
                className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold transition-all ${
                  submitting 
                  ? 'bg-blue-500/20 text-blue-400 cursor-not-allowed border border-blue-500/30' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> AI-ul Evaluează...
                  </>
                ) : (
                  'Finalizează Testul'
                )}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
