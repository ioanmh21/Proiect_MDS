'use client';

import React from 'react';
import { PenLine } from 'lucide-react';

interface OpenEndedQuestionProps {
  questionId: string;
  text: string;
  currentAnswer: string | undefined;
  isSubmitted: boolean;
  isCorrect?: boolean;
  onChange: (answer: string) => void;
}

const MAX_CHARS = 2000;

export default function OpenEndedQuestion({
  questionId,
  text,
  currentAnswer,
  isSubmitted,
  isCorrect,
  onChange,
}: OpenEndedQuestionProps) {
  const value = currentAnswer || '';
  const charCount = value.length;
  const charPercentage = Math.min((charCount / MAX_CHARS) * 100, 100);

  return (
    <div className="space-y-6">
      {/* Textul întrebării */}
      <h3 className="text-xl md:text-2xl font-semibold text-white leading-relaxed">
        {text}
      </h3>

      {/* Tag tip */}
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-medium border border-amber-500/20">
          <PenLine className="w-3.5 h-3.5" />
          Răspuns deschis
        </div>
        {charCount >= 20 && !isSubmitted && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Lungime minimă atinsă
          </div>
        )}
      </div>

      {/* Textarea */}
      <div className={`
        relative rounded-2xl border-2 transition-all duration-300 overflow-hidden
        ${isSubmitted
          ? isCorrect
            ? 'border-emerald-500/40 bg-emerald-500/5'
            : 'border-red-500/40 bg-red-500/5'
          : 'border-white/10 bg-white/[0.02] focus-within:border-purple-500/40 focus-within:bg-purple-500/5'
        }
      `}>
        <textarea
          id={`answer-${questionId}`}
          value={value}
          onChange={(e) => !isSubmitted && onChange(e.target.value)}
          disabled={isSubmitted}
          placeholder="Scrie răspunsul tău aici... Fii cât mai detaliat pentru punctaj maxim."
          rows={6}
          maxLength={MAX_CHARS}
          className={`
            w-full bg-transparent px-5 py-4 text-base text-slate-200 placeholder-slate-600
            focus:outline-none resize-none leading-relaxed
            ${isSubmitted ? 'cursor-default opacity-80' : ''}
          `}
        />

        {/* Character counter bar */}
        <div className="px-5 pb-3 flex items-center justify-between gap-4">
          {/* Progress bar mini */}
          <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                charPercentage >= 90
                  ? 'bg-red-500'
                  : charPercentage >= 60
                    ? 'bg-amber-500'
                    : 'bg-purple-500'
              }`}
              style={{ width: `${charPercentage}%` }}
            />
          </div>
          <span className={`text-xs font-mono shrink-0 ${
            charPercentage >= 90 ? 'text-red-400' : 'text-slate-500'
          }`}>
            {charCount}/{MAX_CHARS}
          </span>
        </div>
      </div>
    </div>
  );
}
