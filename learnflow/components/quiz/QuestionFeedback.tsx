'use client';

import React from 'react';
import { CheckCircle, XCircle, Sparkles } from 'lucide-react';
import type { SubmittedAnswer } from '@/types/quiz';

interface QuestionFeedbackProps {
  feedback: SubmittedAnswer;
  correctAnswer: string;
}

export default function QuestionFeedback({ feedback, correctAnswer }: QuestionFeedbackProps) {
  const { isCorrect, explanation } = feedback;

  return (
    <div
      className={`
        mt-6 rounded-2xl border-2 overflow-hidden transition-all duration-500 animate-[slideUp_0.4s_ease-out]
        ${isCorrect
          ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-900/10'
          : 'border-red-500/30 bg-gradient-to-br from-red-500/10 to-red-900/10'
        }
      `}
    >
      {/* Header */}
      <div className={`
        flex items-center gap-3 px-5 py-4 border-b
        ${isCorrect ? 'border-emerald-500/20' : 'border-red-500/20'}
      `}>
        {isCorrect ? (
          <>
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="font-bold text-emerald-300 text-lg">Corect! 🎉</div>
              <div className="text-emerald-400/70 text-sm">Răspuns excelent</div>
            </div>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <div className="font-bold text-red-300 text-lg">Incorect</div>
              <div className="text-red-400/70 text-sm">
                Răspunsul corect: <span className="font-semibold text-red-300">{correctAnswer}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Explicație AI */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className={`w-4 h-4 ${isCorrect ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className={`text-xs font-semibold uppercase tracking-wider ${
            isCorrect ? 'text-emerald-400/70' : 'text-amber-400/70'
          }`}>
            Explicație AI
          </span>
        </div>
        <p className="text-slate-300 text-sm md:text-base leading-relaxed">
          {explanation}
        </p>
      </div>
    </div>
  );
}
