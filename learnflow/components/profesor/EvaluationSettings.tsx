'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Settings, 
  Clock, 
  BrainCircuit, 
  Save, 
  Loader2, 
  CheckCircle,
  PlayCircle,
  X,
  ThumbsUp,
  ThumbsDown,
  AlertCircle
} from 'lucide-react';
import type { QuizQuestion } from '@/types/quiz';

export interface EvaluationConfig {
  numQuestions: number;
  questionTypes: {
    multipleChoice: boolean;
    trueFalse: boolean;
    openEnded: boolean;
  };
  difficulty: {
    easy: number;
    medium: number;
    hard: number;
  };
  timerEnabled: boolean;
  timerMinutes: number;
  focusWeakConcepts: boolean;
}

interface EvaluationSettingsProps {
  materialId?: string;
  initialConfig?: Partial<EvaluationConfig>;
}

export default function EvaluationSettings({ materialId = 'demo-material', initialConfig }: EvaluationSettingsProps) {
  // State pentru configurare
  const [config, setConfig] = useState<EvaluationConfig>({
    numQuestions: initialConfig?.numQuestions || 10,
    questionTypes: {
      multipleChoice: initialConfig?.questionTypes?.multipleChoice ?? true,
      trueFalse: initialConfig?.questionTypes?.trueFalse ?? true,
      openEnded: initialConfig?.questionTypes?.openEnded ?? false,
    },
    difficulty: {
      easy: initialConfig?.difficulty?.easy ?? 30,
      medium: initialConfig?.difficulty?.medium ?? 50,
      hard: initialConfig?.difficulty?.hard ?? 20,
    },
    timerEnabled: initialConfig?.timerEnabled ?? false,
    timerMinutes: initialConfig?.timerMinutes ?? 15,
    focusWeakConcepts: initialConfig?.focusWeakConcepts ?? true,
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState<QuizQuestion[]>([]);
  const [questionRatings, setQuestionRatings] = useState<Record<string, 'up' | 'down' | undefined>>({});
  
  const isFirstRender = useRef(true);

  // Funcție de debounce pentru salvarea automată
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        // Mock apel API pentru salvarea setărilor
        // await fetch('/api/evaluate/settings', { method: 'POST', body: JSON.stringify(config) });
        await new Promise(resolve => setTimeout(resolve, 600)); // Simulează rețeaua
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        console.error('Eroare la salvare:', err);
        setSaveStatus('error');
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [config]);

  // Logica de sincronizare a slider-elor de dificultate pentru a suma 100%
  const handleDifficultyChange = (key: 'easy' | 'medium' | 'hard', newValue: number) => {
    setConfig(prev => {
      const keys = ['easy', 'medium', 'hard'] as const;
      const otherKeys = keys.filter(k => k !== key);
      
      let delta = newValue - prev.difficulty[key];
      let nextDiff = { ...prev.difficulty, [key]: newValue };
      
      if (delta > 0) {
        // Scădem din celelalte pentru a compensa creșterea
        const [k1, k2] = otherKeys;
        if (nextDiff[k1] > nextDiff[k2]) {
          const take = Math.min(nextDiff[k1], delta);
          nextDiff[k1] -= take;
          delta -= take;
          nextDiff[k2] -= delta;
        } else {
          const take = Math.min(nextDiff[k2], delta);
          nextDiff[k2] -= take;
          delta -= take;
          nextDiff[k1] -= delta;
        }
      } else {
        // Adunăm la celelalte proporțional sau egal
        nextDiff[otherKeys[0]] -= delta / 2;
        nextDiff[otherKeys[1]] -= delta / 2;
      }
      
      // Fixăm rotunjirile și ne asigurăm că suma e exact 100
      nextDiff.easy = Math.max(0, Math.round(nextDiff.easy));
      nextDiff.medium = Math.max(0, Math.round(nextDiff.medium));
      nextDiff.hard = Math.max(0, 100 - nextDiff.easy - nextDiff.medium);
      
      // Ajustare finală în caz de erori de rotunjire
      const sum = nextDiff.easy + nextDiff.medium + nextDiff.hard;
      if (sum !== 100) {
        if (key !== 'medium') nextDiff.medium += (100 - sum);
        else nextDiff.easy += (100 - sum);
      }
      
      return { ...prev, difficulty: nextDiff };
    });
  };

  // Generare Preview Test
  const handlePreviewTest = async () => {
    setIsPreviewOpen(true);
    setIsPreviewLoading(true);
    setQuestionRatings({});
    
    try {
      // Mock API route (aici s-ar apela Agentul Evaluator real)
      // const res = await fetch('/api/evaluate/generate', { method: 'POST', body: JSON.stringify({ config, materialId }) });
      // const data = await res.json();
      
      // Simulare delay agent AI
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock data pentru preview în funcție de configurare
      const mockQuestions: QuizQuestion[] = Array.from({ length: Math.min(config.numQuestions, 5) }).map((_, i) => ({
        id: `preview-q-${i}`,
        type: config.questionTypes.multipleChoice ? 'multiple_choice' : 'true_false',
        text: `Aceasta este o întrebare de dificultate ${
          i % 3 === 0 ? 'grea' : i % 2 === 0 ? 'medie' : 'ușoară'
        } generată de Agentul Evaluator bazată pe setările tale. Cât de clară ți se pare formularea?`,
        options: config.questionTypes.multipleChoice ? ['Opțiunea A (Corectă)', 'Opțiunea B', 'Opțiunea C', 'Opțiunea D'] : undefined,
        correctAnswer: config.questionTypes.multipleChoice ? 'Opțiunea A (Corectă)' : 'Adevărat',
        explanation: 'Aceasta este o explicație generată de AI pentru răspunsul corect.',
        points: 10
      }));
      
      setPreviewQuestions(mockQuestions);
    } catch (err) {
      console.error('Eroare la generarea testului:', err);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleRateQuestion = (questionId: string, rating: 'up' | 'down') => {
    setQuestionRatings(prev => ({
      ...prev,
      [questionId]: prev[questionId] === rating ? undefined : rating // Toggle logic
    }));
    // În producție, aici am trimite feedback-ul către backend pentru a îmbunătăți modelul
  };

  return (
    <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 md:p-8 space-y-8 backdrop-blur-md">
      {/* HEADER & SAVE STATUS */}
      <div className="flex items-center justify-between border-b border-white/10 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <Settings className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Parametri Evaluator AI</h2>
            <p className="text-sm text-slate-400">Configurează cum agentul generează testele</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-2 text-sm text-slate-400 bg-white/5 px-3 py-1.5 rounded-full">
              <Loader2 className="w-4 h-4 animate-spin" /> Salvare...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full transition-all">
              <CheckCircle className="w-4 h-4" /> Salvat
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 px-3 py-1.5 rounded-full transition-all">
              <AlertCircle className="w-4 h-4" /> Eroare
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT COLUMN */}
        <div className="space-y-8">
          {/* Număr întrebări */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-semibold text-slate-200">Număr de întrebări pe test</label>
              <span className="text-sm font-bold text-purple-400">{config.numQuestions}</span>
            </div>
            <input 
              type="range" 
              min="5" 
              max="20" 
              value={config.numQuestions}
              onChange={(e) => setConfig({ ...config, numQuestions: parseInt(e.target.value) })}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>5 (Scurt)</span>
              <span>20 (Detaliat)</span>
            </div>
          </div>

          {/* Tipuri de întrebări */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-200">Tipuri de întrebări incluse</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] cursor-pointer hover:bg-white/[0.05] transition-colors">
                <input 
                  type="checkbox" 
                  checked={config.questionTypes.multipleChoice}
                  onChange={(e) => setConfig({ ...config, questionTypes: { ...config.questionTypes, multipleChoice: e.target.checked } })}
                  className="w-5 h-5 rounded border-slate-600 text-purple-500 focus:ring-purple-500 focus:ring-offset-slate-900 bg-slate-800"
                />
                <span className="text-sm text-slate-300">Grilă (Alegere multiplă)</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] cursor-pointer hover:bg-white/[0.05] transition-colors">
                <input 
                  type="checkbox" 
                  checked={config.questionTypes.trueFalse}
                  onChange={(e) => setConfig({ ...config, questionTypes: { ...config.questionTypes, trueFalse: e.target.checked } })}
                  className="w-5 h-5 rounded border-slate-600 text-purple-500 focus:ring-purple-500 focus:ring-offset-slate-900 bg-slate-800"
                />
                <span className="text-sm text-slate-300">Adevărat / Fals</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] cursor-pointer hover:bg-white/[0.05] transition-colors">
                <input 
                  type="checkbox" 
                  checked={config.questionTypes.openEnded}
                  onChange={(e) => setConfig({ ...config, questionTypes: { ...config.questionTypes, openEnded: e.target.checked } })}
                  className="w-5 h-5 rounded border-slate-600 text-purple-500 focus:ring-purple-500 focus:ring-offset-slate-900 bg-slate-800"
                />
                <span className="text-sm text-slate-300">Răspuns Deschis (Evaluare Semantică)</span>
              </label>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-8">
          {/* Dificultate (100% sync) */}
          <div className="bg-slate-950/50 p-5 rounded-2xl border border-white/5 space-y-5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-200">Distribuție Dificultate</label>
              <span className="text-xs px-2 py-1 bg-white/5 rounded text-slate-400 font-mono">100% Total</span>
            </div>
            
            <div className="space-y-4">
              {/* Ușor */}
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-emerald-400 w-12">Ușor</span>
                <input 
                  type="range" min="0" max="100" 
                  value={config.difficulty.easy}
                  onChange={(e) => handleDifficultyChange('easy', parseInt(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="text-xs font-mono text-slate-400 w-8 text-right">{config.difficulty.easy}%</span>
              </div>
              {/* Mediu */}
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-amber-400 w-12">Mediu</span>
                <input 
                  type="range" min="0" max="100" 
                  value={config.difficulty.medium}
                  onChange={(e) => handleDifficultyChange('medium', parseInt(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <span className="text-xs font-mono text-slate-400 w-8 text-right">{config.difficulty.medium}%</span>
              </div>
              {/* Greu */}
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-red-400 w-12">Greu</span>
                <input 
                  type="range" min="0" max="100" 
                  value={config.difficulty.hard}
                  onChange={(e) => handleDifficultyChange('hard', parseInt(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
                <span className="text-xs font-mono text-slate-400 w-8 text-right">{config.difficulty.hard}%</span>
              </div>
            </div>
          </div>

          {/* Opțiuni Avansate */}
          <div className="space-y-4">
            <label className="text-sm font-semibold text-slate-200">Setări Avansate de Testare</label>
            
            <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <BrainCircuit className="w-5 h-5 text-fuchsia-400" />
                <div>
                  <div className="text-sm font-medium text-white">Focalizare pe concepte slabe</div>
                  <div className="text-xs text-slate-400">Agentul va prioritiza subiectele la care elevii au greșit anterior</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={config.focusWeakConcepts}
                  onChange={(e) => setConfig({ ...config, focusWeakConcepts: e.target.checked })}
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-400" />
                <div>
                  <div className="text-sm font-medium text-white">Limită de timp</div>
                  <div className="text-xs text-slate-400">Impune un cronometru vizual pentru test</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {config.timerEnabled && (
                  <div className="flex items-center gap-1">
                    <input 
                      type="number" 
                      min="1" max="120"
                      value={config.timerMinutes}
                      onChange={(e) => setConfig({ ...config, timerMinutes: parseInt(e.target.value) || 15 })}
                      className="w-14 bg-slate-900 border border-white/10 rounded px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-purple-500"
                    />
                    <span className="text-xs text-slate-400">min</span>
                  </div>
                )}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={config.timerEnabled}
                    onChange={(e) => setConfig({ ...config, timerEnabled: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="pt-6 border-t border-white/10 flex justify-end">
        <button 
          onClick={handlePreviewTest}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors border border-white/5 hover:border-white/20"
        >
          <PlayCircle className="w-5 h-5" />
          Previzualizare Test Generat
        </button>
      </div>

      {/* MODAL PREVIEW */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsPreviewOpen(false)} />
          <div className="relative bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl animate-[slideUp_0.3s_ease-out]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10 bg-slate-900/50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                  <BrainCircuit className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Previzualizare Agent Evaluator</h3>
                  <p className="text-xs text-slate-400">Verifică calitatea întrebărilor generate</p>
                </div>
              </div>
              <button 
                onClick={() => setIsPreviewOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
              {isPreviewLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
                  <p className="text-slate-400 text-sm animate-pulse">Agentul analizează materialul și generează întrebările...</p>
                </div>
              ) : (
                previewQuestions.map((q, idx) => (
                  <div key={q.id} className="bg-slate-950/50 border border-white/5 rounded-xl p-5 relative group">
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 bg-white/5 px-2 py-1 rounded">Î{idx + 1}</span>
                        <span className="text-xs uppercase tracking-wider text-purple-400 font-semibold">{q.type.replace('_', ' ')}</span>
                      </div>
                      
                      {/* Rating Feedback System */}
                      <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] text-slate-500 uppercase mr-1">Calitate:</span>
                        <button 
                          onClick={() => handleRateQuestion(q.id, 'up')}
                          className={`p-1.5 rounded-md transition-colors ${questionRatings[q.id] === 'up' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
                          title="Întrebare bună"
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleRateQuestion(q.id, 'down')}
                          className={`p-1.5 rounded-md transition-colors ${questionRatings[q.id] === 'down' ? 'bg-red-500/20 text-red-400' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
                          title="Întrebare irelevantă / greșită"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-slate-200 text-sm leading-relaxed mb-4">{q.text}</p>
                    
                    {q.options && (
                      <div className="space-y-2 mb-4">
                        {q.options.map((opt, i) => (
                          <div key={i} className={`text-sm p-2 rounded-lg border ${opt === q.correctAnswer ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-white/5 border-white/5 text-slate-400'}`}>
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-3">
                      <p className="text-xs text-purple-300/70 font-medium mb-1">Răspuns Corect & Explicație AI:</p>
                      <p className="text-sm text-slate-300">{q.correctAnswer}</p>
                      <p className="text-xs text-slate-400 mt-2">{q.explanation}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-white/10 bg-slate-900/50 rounded-b-2xl flex justify-end gap-3">
              <button 
                onClick={() => setIsPreviewOpen(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/10 transition-colors"
              >
                Închide Previzualizarea
              </button>
              <button 
                onClick={() => {
                  alert('Setări și feedback salvate pentru antrenamentul agentului!');
                  setIsPreviewOpen(false);
                }}
                disabled={isPreviewLoading}
                className="px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Salvează Configurația
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
