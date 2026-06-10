'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Send,
  AlertTriangle,
  Loader2,
  CheckCircle,
  Circle,
  Flag,
} from 'lucide-react';
import { useQuizState } from '@/hooks/useQuizState';
import MultipleChoiceQuestion from '@/components/quiz/MultipleChoiceQuestion';
import TrueFalseQuestion from '@/components/quiz/TrueFalseQuestion';
import OpenEndedQuestion from '@/components/quiz/OpenEndedQuestion';
import QuestionFeedback from '@/components/quiz/QuestionFeedback';

// ============================================================================
// QuizPage — Pagina principală de susținere a unui test
// ============================================================================

export default function QuizPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = use(params);
  const router = useRouter();
  const [showFinishDialog, setShowFinishDialog] = useState(false);

  const {
    questions,
    currentQuestion,
    currentIndex,
    answers,
    submittedAnswers,
    testResult,
    testTitle,
    timeRemaining,
    totalTime,
    status,
    isSubmitting,
    setAnswer,
    submitAnswer,
    finishTest,
    goToQuestion,
    nextQuestion,
    prevQuestion,
  } = useQuizState(testId);

  // --- Navigare la rezultate după finalizare ---
  if (status === 'submitted' && testResult) {
    router.push(`/dashboard/elev/quiz/${testId}/results`);
  }

  // --- Format timer ---
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const timerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const isTimeLow = timeRemaining < 30;
  const timerPercentage = totalTime > 0 ? (timeRemaining / totalTime) * 100 : 100;

  // --- Progress ---
  const answeredCount = Object.keys(answers).filter((id) => answers[id]?.trim()).length;
  const progressPercentage = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  // --- Render ---
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto" />
          <p className="text-slate-400 text-lg">Se încarcă testul...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
          <p className="text-red-300 text-lg">Eroare la încărcarea testului.</p>
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

  const currentQuestionId = currentQuestion?.id || '';
  const currentAnswer = answers[currentQuestionId];
  const currentFeedback = submittedAnswers[currentQuestionId];
  const isCurrentSubmitted = !!currentFeedback;
  const hasAnswered = currentAnswer !== undefined && currentAnswer.trim() !== '';

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-purple-500/30 relative">
      {/* Background Effects */}
      <div className="fixed top-[-15%] left-[-10%] w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-15%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none" />

      {/* ================================================================ */}
      {/* TOP BAR — Timer + Progress */}
      {/* ================================================================ */}
      <header className="sticky top-0 z-30 bg-[#020617]/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-3">
          {/* Row 1: Title + Timer */}
          <div className="flex items-center justify-between mb-3">
            {/* Left: back + title */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard/elev')}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors group"
                title="Înapoi la Dashboard"
              >
                <ChevronLeft className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
              </button>
              <div>
                <h1 className="text-sm md:text-base font-bold text-white truncate max-w-[200px] md:max-w-none">
                  {testTitle}
                </h1>
                <p className="text-xs text-slate-500">
                  Întrebarea {currentIndex + 1} din {questions.length}
                </p>
              </div>
            </div>

            {/* Right: Timer */}
            <div className={`
              flex items-center gap-2 px-4 py-2 rounded-xl border transition-all duration-300
              ${isTimeLow
                ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse'
                : 'bg-white/[0.03] border-white/10 text-slate-300'
              }
            `}>
              <Clock className={`w-4 h-4 ${isTimeLow ? 'text-red-400' : 'text-slate-500'}`} />
              <span className={`font-mono text-lg font-bold ${isTimeLow ? 'text-red-400' : 'text-white'}`}>
                {timerText}
              </span>
            </div>
          </div>

          {/* Row 2: Progress bar */}
          <div className="flex items-center gap-3">
            {/* Progress bar */}
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>

            {/* Timer bar mini */}
            <div className="w-20 h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  isTimeLow ? 'bg-red-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${timerPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ================================================================ */}
      {/* MAIN CONTENT — Question */}
      {/* ================================================================ */}
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 relative z-10">
        {/* Question navigator dots */}
        <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
          {questions.map((q, idx) => {
            const isActive = idx === currentIndex;
            const isAnswered = answers[q.id]?.trim();
            const isVerified = !!submittedAnswers[q.id];

            return (
              <button
                key={q.id}
                onClick={() => goToQuestion(idx)}
                className={`
                  w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-200
                  ${isActive
                    ? 'bg-purple-500 text-white scale-110 shadow-[0_0_15px_rgba(168,85,247,0.5)]'
                    : isVerified
                      ? submittedAnswers[q.id].isCorrect
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : isAnswered
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-white/5 text-slate-500 border border-white/10 hover:bg-white/10'
                  }
                `}
                title={`Întrebarea ${idx + 1}`}
              >
                {isVerified ? (
                  submittedAnswers[q.id].isCorrect ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <span>✗</span>
                  )
                ) : isAnswered ? (
                  <Circle className="w-3.5 h-3.5 fill-current" />
                ) : (
                  idx + 1
                )}
              </button>
            );
          })}
        </div>

        {/* Question card */}
        {currentQuestion && (
          <div className="bg-white/[0.02] border border-white/10 backdrop-blur-md rounded-3xl p-6 md:p-10">
            {/* Question type badge */}
            <div className="flex items-center gap-2 mb-6">
              <span className={`
                px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider border
                ${currentQuestion.type === 'multiple_choice'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : currentQuestion.type === 'true_false'
                    ? 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }
              `}>
                {currentQuestion.type === 'multiple_choice'
                  ? 'Grilă'
                  : currentQuestion.type === 'true_false'
                    ? 'Adevărat / Fals'
                    : 'Răspuns deschis'
                }
              </span>
              <span className="text-xs text-slate-500">
                {currentQuestion.points} puncte
              </span>
            </div>

            {/* Render question by type */}
            {currentQuestion.type === 'multiple_choice' && (
              <MultipleChoiceQuestion
                questionId={currentQuestionId}
                text={currentQuestion.text}
                options={currentQuestion.options || []}
                selectedAnswer={currentAnswer}
                isSubmitted={isCurrentSubmitted}
                isCorrect={currentFeedback?.isCorrect}
                correctAnswer={currentFeedback?.correctAnswer}
                onSelect={(answer) => setAnswer(currentQuestionId, answer)}
              />
            )}

            {currentQuestion.type === 'true_false' && (
              <TrueFalseQuestion
                questionId={currentQuestionId}
                text={currentQuestion.text}
                selectedAnswer={currentAnswer}
                isSubmitted={isCurrentSubmitted}
                isCorrect={currentFeedback?.isCorrect}
                correctAnswer={currentFeedback?.correctAnswer}
                onSelect={(answer) => setAnswer(currentQuestionId, answer)}
              />
            )}

            {currentQuestion.type === 'open_ended' && (
              <OpenEndedQuestion
                questionId={currentQuestionId}
                text={currentQuestion.text}
                currentAnswer={currentAnswer}
                isSubmitted={isCurrentSubmitted}
                isCorrect={currentFeedback?.isCorrect}
                onChange={(answer) => setAnswer(currentQuestionId, answer)}
              />
            )}

            {/* Feedback */}
            {currentFeedback && (
              <QuestionFeedback
                feedback={currentFeedback}
                correctAnswer={currentFeedback.correctAnswer || ''}
              />
            )}

            {/* Submit answer button */}
            {!isCurrentSubmitted && hasAnswered && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => submitAnswer(currentQuestionId, currentAnswer!)}
                  disabled={isSubmitting}
                  className="
                    flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-white
                    bg-gradient-to-r from-purple-600 to-fuchsia-600
                    hover:from-purple-500 hover:to-fuchsia-500
                    shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)]
                    transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                  "
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Se verifică...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Verifică Răspunsul
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* NAVIGATION — Prev / Next + Finish */}
        {/* ================================================================ */}
        <div className="mt-8 flex items-center justify-between gap-4">
          {/* Prev */}
          <button
            onClick={prevQuestion}
            disabled={currentIndex === 0}
            className="
              flex items-center gap-2 px-5 py-3 rounded-xl font-medium
              bg-white/5 border border-white/10 text-slate-300
              hover:bg-white/10 hover:text-white transition-all
              disabled:opacity-30 disabled:cursor-not-allowed
            "
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Înapoi</span>
          </button>

          {/* Center: answered count */}
          <div className="text-sm text-slate-500">
            {answeredCount} din {questions.length} răspunse
          </div>

          {/* Next / Finish */}
          <div className="flex items-center gap-3">
            {currentIndex < questions.length - 1 ? (
              <button
                onClick={nextQuestion}
                className="
                  flex items-center gap-2 px-5 py-3 rounded-xl font-medium
                  bg-white/5 border border-white/10 text-slate-300
                  hover:bg-white/10 hover:text-white transition-all
                "
              >
                <span className="hidden sm:inline">Înainte</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : null}

            {/* Finish button */}
            <button
              onClick={() => setShowFinishDialog(true)}
              className="
                flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-white
                bg-gradient-to-r from-emerald-600 to-teal-600
                hover:from-emerald-500 hover:to-teal-500
                shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]
                transition-all
              "
            >
              <Flag className="w-5 h-5" />
              <span className="hidden sm:inline">Finalizează</span>
            </button>
          </div>
        </div>
      </main>

      {/* ================================================================ */}
      {/* DIALOG CONFIRMARE FINALIZARE */}
      {/* ================================================================ */}
      {showFinishDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowFinishDialog(false)}
          />
          <div className="relative bg-slate-900 border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-[slideUp_0.3s_ease-out]">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Finalizezi testul?</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Ai răspuns la <span className="text-white font-semibold">{answeredCount}</span> din{' '}
                <span className="text-white font-semibold">{questions.length}</span> întrebări.
                {answeredCount < questions.length && (
                  <span className="block mt-1 text-amber-400">
                    {questions.length - answeredCount} întrebări nu au răspuns și vor primi 0 puncte.
                  </span>
                )}
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowFinishDialog(false)}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors font-medium"
                >
                  Continuă testul
                </button>
                <button
                  onClick={() => {
                    setShowFinishDialog(false);
                    finishTest();
                  }}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold hover:from-emerald-500 hover:to-teal-500 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Se finalizează...' : 'Finalizează'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
