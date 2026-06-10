'use client';

import React, { useState, useEffect, useRef, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Trophy,
  Target,
  Flame,
  CheckCircle,
  XCircle,
  Sparkles,
  MessageCircle,
  RotateCcw,
  Home,
} from 'lucide-react';

// ============================================================================
// TestResults — Pagina de rezultate după test
// ============================================================================

interface ResultData {
  testId: string;
  score: number;
  totalPoints: number;
  percentage: number;
  submittedAnswers: Record<string, { answer: string; isCorrect: boolean; correctAnswer: string; explanation: string }>;
  completedAt: string;
}

interface QuestionData {
  id: string;
  type: string;
  text: string;
  options?: string[];
  points: number;
}

export default function TestResultsPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = use(params);
  const router = useRouter();
  const [resultData, setResultData] = useState<ResultData | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const scoreAnimated = useRef(false);

  // Încarcă datele testului
  useEffect(() => {
    async function loadResults() {
      try {
        // Încarcă întrebările
        const questionsRes = await fetch(`/api/quiz/${testId}`);
        const questionsData = await questionsRes.json();

        // Simulăm finalizarea testului pentru a obține rezultatele
        // În producție, rezultatele ar fi deja salvate în DB
        const savedAnswers = localStorage.getItem(`quiz-answers-${testId}`);
        let answers: Record<string, string> = {};

        if (savedAnswers) {
          answers = JSON.parse(savedAnswers);
        }

        // Obține rezultatele
        const finishRes = await fetch(`/api/quiz/${testId}/finish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers }),
        });
        const finishData = await finishRes.json();

        setQuestions(questionsData.questions);
        setResultData(finishData);
      } catch (err) {
        console.error('Error loading results:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadResults();
  }, [testId]);

  // Animație scor (0 → final)
  useEffect(() => {
    if (!resultData || scoreAnimated.current) return;
    scoreAnimated.current = true;

    const targetScore = resultData.percentage;
    const duration = 2000; // 2 secunde
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing: ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * targetScore);

      setAnimatedScore(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }, [resultData]);

  const toggleExpanded = useCallback((questionId: string) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }, []);

  // Mesaj motivațional
  const getMotivationalContent = (percentage: number) => {
    if (percentage >= 80) {
      return {
        emoji: '🏆',
        title: 'Excelent! Ești un adevărat campion!',
        message: 'Ai demonstrat o înțelegere excepțională a materialului. Continuă pe acest drum — ești pe calea spre mastering!',
        color: 'from-amber-500 to-yellow-500',
        bgColor: 'from-amber-500/10 to-yellow-500/10',
        borderColor: 'border-amber-500/30',
        textColor: 'text-amber-300',
        Icon: Trophy,
      };
    }
    if (percentage >= 50) {
      return {
        emoji: '🎯',
        title: 'Bună treabă! Ești pe drumul cel bun!',
        message: 'Ai o bază solidă de cunoștințe. Revizuiește întrebările unde ai greșit și data viitoare vei fi și mai bun. Focus pe conceptele de bază!',
        color: 'from-blue-500 to-cyan-500',
        bgColor: 'from-blue-500/10 to-cyan-500/10',
        borderColor: 'border-blue-500/30',
        textColor: 'text-blue-300',
        Icon: Target,
      };
    }
    return {
      emoji: '💪',
      title: 'Nu renunța! Fiecare greșeală e o lecție!',
      message: 'Rezultatele arată că sunt concepte de revizuit. Folosește butonul „Discută cu Tutorul" de mai jos pentru a înțelege unde ai greșit. Progresul vine cu practică!',
      color: 'from-purple-500 to-fuchsia-500',
      bgColor: 'from-purple-500/10 to-fuchsia-500/10',
      borderColor: 'border-purple-500/30',
      textColor: 'text-purple-300',
      Icon: Flame,
    };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto relative">
            <div className="absolute inset-0 rounded-full border-4 border-white/10" />
            <div className="absolute inset-0 rounded-full border-4 border-t-purple-500 animate-spin" />
          </div>
          <p className="text-slate-400">Se încarcă rezultatele...</p>
        </div>
      </div>
    );
  }

  if (!resultData) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-center space-y-4">
          <XCircle className="w-12 h-12 text-red-400 mx-auto" />
          <p className="text-red-300">Nu am putut încărca rezultatele.</p>
          <button
            onClick={() => router.push('/dashboard/elev')}
            className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
          >
            Înapoi la Dashboard
          </button>
        </div>
      </div>
    );
  }

  const motivational = getMotivationalContent(resultData.percentage);
  const correctCount = Object.values(resultData.submittedAnswers).filter((a) => a.isCorrect).length;
  const wrongCount = Object.values(resultData.submittedAnswers).filter((a) => !a.isCorrect).length;

  // Calculează circumferința SVG
  const circleRadius = 90;
  const circumference = 2 * Math.PI * circleRadius;
  const scoreOffset = circumference - (animatedScore / 100) * circumference;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-purple-500/30 relative pb-20">
      {/* Background Effects */}
      <div className="fixed top-[-15%] left-[-10%] w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-15%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-8 relative z-10">
        {/* ================================================================ */}
        {/* HEADER */}
        {/* ================================================================ */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.push('/dashboard/elev')}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors group"
          >
            <ChevronLeft className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">Rezultate Test</h1>
            <p className="text-xs text-slate-500">
              Finalizat la {new Date(resultData.completedAt).toLocaleString('ro-RO')}
            </p>
          </div>
        </div>

        {/* ================================================================ */}
        {/* SCORE CIRCLE — animat */}
        {/* ================================================================ */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative w-52 h-52 mb-6">
            {/* Background circle */}
            <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
              <circle
                cx="100"
                cy="100"
                r={circleRadius}
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="12"
              />
              <circle
                cx="100"
                cy="100"
                r={circleRadius}
                fill="none"
                stroke={`url(#scoreGradient)`}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={scoreOffset}
                className="transition-all duration-100 ease-out"
              />
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  {resultData.percentage >= 80 ? (
                    <>
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#eab308" />
                    </>
                  ) : resultData.percentage >= 50 ? (
                    <>
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </>
                  ) : (
                    <>
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#d946ef" />
                    </>
                  )}
                </linearGradient>
              </defs>
            </svg>

            {/* Score text center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-black text-white">{animatedScore}%</span>
              <span className="text-sm text-slate-400 mt-1">
                {resultData.score}/{resultData.totalPoints} puncte
              </span>
            </div>

            {/* Glow effect */}
            <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${motivational.bgColor} blur-[40px] opacity-30 pointer-events-none`} />
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-lg font-bold text-emerald-400">{correctCount}</div>
                <div className="text-xs text-slate-500">Corecte</div>
              </div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <XCircle className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <div className="text-lg font-bold text-red-400">{wrongCount}</div>
                <div className="text-xs text-slate-500">Greșite</div>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* MOTIVATIONAL MESSAGE */}
        {/* ================================================================ */}
        <div className={`
          rounded-3xl border-2 ${motivational.borderColor} p-6 md:p-8 mb-10
          bg-gradient-to-br ${motivational.bgColor}
          animate-[slideUp_0.6s_ease-out_0.5s_both]
        `}>
          <div className="flex items-start gap-4">
            <div className={`
              w-14 h-14 rounded-2xl bg-gradient-to-br ${motivational.color}
              flex items-center justify-center shrink-0 shadow-lg
            `}>
              <motivational.Icon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${motivational.textColor} mb-2`}>
                {motivational.emoji} {motivational.title}
              </h2>
              <p className="text-slate-300 leading-relaxed">
                {motivational.message}
              </p>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* QUESTION REVIEW LIST */}
        {/* ================================================================ */}
        <div className="space-y-4 mb-10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Revizuire Întrebări
          </h2>

          {questions.map((question, idx) => {
            const feedback = resultData.submittedAnswers[question.id];
            if (!feedback) return null;

            const isExpanded = expandedQuestions.has(question.id);
            const isCorrect = feedback.isCorrect;

            return (
              <div
                key={question.id}
                className={`
                  rounded-2xl border overflow-hidden transition-all duration-300
                  ${isCorrect
                    ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
                    : 'border-red-500/20 bg-red-500/[0.03]'
                  }
                `}
              >
                {/* Header — click to expand */}
                <button
                  onClick={() => toggleExpanded(question.id)}
                  className="w-full flex items-center gap-3 p-4 md:p-5 text-left hover:bg-white/[0.02] transition-colors"
                >
                  {/* Status icon */}
                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                    ${isCorrect ? 'bg-emerald-500/10' : 'bg-red-500/10'}
                  `}>
                    {isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>

                  {/* Question text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-slate-500">Î{idx + 1}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        isCorrect ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {isCorrect ? `+${question.points}p` : '0p'}
                      </span>
                    </div>
                    <p className="text-sm md:text-base text-slate-300 line-clamp-2">
                      {question.text}
                    </p>
                  </div>

                  {/* Expand icon */}
                  <div className="shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 md:px-5 pb-5 border-t border-white/5 pt-4 space-y-4 animate-[slideUp_0.3s_ease-out]">
                    {/* Răspunsul elevului */}
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                        Răspunsul tău
                      </div>
                      <div className={`
                        px-4 py-2.5 rounded-xl text-sm font-medium border
                        ${isCorrect
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                          : 'bg-red-500/10 border-red-500/20 text-red-300'
                        }
                      `}>
                        {feedback.answer || <span className="italic text-slate-500">Niciun răspuns</span>}
                      </div>
                    </div>

                    {/* Răspunsul corect (doar dacă e greșit) */}
                    {!isCorrect && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                          Răspunsul corect
                        </div>
                        <div className="px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                          {feedback.correctAnswer}
                        </div>
                      </div>
                    )}

                    {/* Explicație AI */}
                    <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-purple-400/70">
                          Explicație AI
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {feedback.explanation}
                      </p>
                    </div>

                    {/* Buton Discută cu Tutorul (doar dacă e greșit) */}
                    {!isCorrect && (
                      <button
                        onClick={() => {
                          const chatMessage = encodeURIComponent(
                            `Am greșit la următoarea întrebare într-un test:\n\n"${question.text}"\n\nRăspunsul meu a fost: "${feedback.answer}"\n\nPoți să-mi explici mai detaliat de ce e greșit și care este răspunsul corect?`
                          );
                          router.push(`/dashboard/elev/chat?message=${chatMessage}`);
                        }}
                        className="
                          w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                          bg-gradient-to-r from-blue-600/20 to-indigo-600/20
                          border border-blue-500/30 text-blue-300
                          hover:from-blue-600/30 hover:to-indigo-600/30 hover:text-blue-200
                          transition-all duration-300 font-medium text-sm
                          group
                        "
                      >
                        <MessageCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        Discută cu Tutorul despre această greșeală
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ================================================================ */}
        {/* FOOTER BUTTONS */}
        {/* ================================================================ */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => router.push('/dashboard/elev')}
            className="
              flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl
              bg-white/5 border border-white/10 text-slate-300
              hover:bg-white/10 hover:text-white transition-all font-medium
            "
          >
            <Home className="w-5 h-5" />
            Înapoi la Dashboard
          </button>
          <button
            onClick={() => router.push(`/dashboard/elev/quiz/${testId}`)}
            className="
              flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl
              bg-gradient-to-r from-purple-600 to-fuchsia-600
              hover:from-purple-500 hover:to-fuchsia-500
              text-white font-semibold
              shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)]
              transition-all
            "
          >
            <RotateCcw className="w-5 h-5" />
            Încearcă din nou
          </button>
        </div>
      </div>

    </div>
  );
}
