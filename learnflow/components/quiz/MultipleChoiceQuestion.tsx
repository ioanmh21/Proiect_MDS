'use client';

import React from 'react';

interface MultipleChoiceQuestionProps {
  questionId: string;
  text: string;
  options: string[];
  selectedAnswer: string | undefined;
  isSubmitted: boolean;
  isCorrect?: boolean;
  correctAnswer?: string;
  onSelect: (answer: string) => void;
}

export default function MultipleChoiceQuestion({
  questionId,
  text,
  options,
  selectedAnswer,
  isSubmitted,
  isCorrect,
  correctAnswer,
  onSelect,
}: MultipleChoiceQuestionProps) {
  return (
    <div className="space-y-6">
      {/* Textul întrebării */}
      <h3 className="text-xl md:text-2xl font-semibold text-white leading-relaxed">
        {text}
      </h3>

      {/* Opțiuni */}
      <div className="space-y-3">
        {options.map((option, idx) => {
          const isSelected = selectedAnswer === option;
          const isThisCorrect = isSubmitted && option === correctAnswer;
          const isThisWrong = isSubmitted && isSelected && !isCorrect;
          const letter = String.fromCharCode(65 + idx); // A, B, C, D

          let borderColor = 'border-white/10';
          let bgColor = 'bg-white/[0.02]';
          let ringColor = '';

          if (isSubmitted) {
            if (isThisCorrect) {
              borderColor = 'border-emerald-500/50';
              bgColor = 'bg-emerald-500/10';
              ringColor = 'ring-2 ring-emerald-500/30';
            } else if (isThisWrong) {
              borderColor = 'border-red-500/50';
              bgColor = 'bg-red-500/10';
              ringColor = 'ring-2 ring-red-500/30';
            }
          } else if (isSelected) {
            borderColor = 'border-purple-500/50';
            bgColor = 'bg-purple-500/10';
            ringColor = 'ring-2 ring-purple-500/30';
          }

          return (
            <button
              key={`${questionId}-${idx}`}
              onClick={() => !isSubmitted && onSelect(option)}
              disabled={isSubmitted}
              className={`
                w-full flex items-center gap-4 p-4 md:p-5 rounded-2xl border transition-all duration-300
                ${borderColor} ${bgColor} ${ringColor}
                ${!isSubmitted ? 'hover:bg-white/[0.05] hover:border-purple-500/30 hover:scale-[1.01] cursor-pointer' : 'cursor-default'}
                group
              `}
            >
              {/* Radio indicator */}
              <div className={`
                w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300 font-bold text-sm
                ${isSubmitted && isThisCorrect
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-400'
                  : isSubmitted && isThisWrong
                    ? 'border-red-400 bg-red-500/20 text-red-400'
                    : isSelected
                      ? 'border-purple-400 bg-purple-500/20 text-purple-400 scale-110'
                      : 'border-white/20 text-slate-500 group-hover:border-purple-400/50 group-hover:text-purple-400'
                }
              `}>
                {isSubmitted && isThisCorrect ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : isSubmitted && isThisWrong ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  letter
                )}
              </div>

              {/* Text opțiune */}
              <span className={`
                text-left text-base md:text-lg font-medium transition-colors duration-200
                ${isSubmitted && isThisCorrect
                  ? 'text-emerald-300'
                  : isSubmitted && isThisWrong
                    ? 'text-red-300'
                    : isSelected
                      ? 'text-purple-200'
                      : 'text-slate-300 group-hover:text-white'
                }
              `}>
                {option}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
