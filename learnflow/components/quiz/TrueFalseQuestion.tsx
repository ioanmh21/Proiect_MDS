'use client';

import React from 'react';
import { Check, X } from 'lucide-react';

interface TrueFalseQuestionProps {
  questionId: string;
  text: string;
  selectedAnswer: string | undefined;
  isSubmitted: boolean;
  isCorrect?: boolean;
  correctAnswer?: string;
  onSelect: (answer: string) => void;
}

export default function TrueFalseQuestion({
  questionId,
  text,
  selectedAnswer,
  isSubmitted,
  isCorrect,
  correctAnswer,
  onSelect,
}: TrueFalseQuestionProps) {
  const options = [
    { value: 'Adevărat', icon: Check, label: 'Adevărat' },
    { value: 'Fals', icon: X, label: 'Fals' },
  ];

  return (
    <div className="space-y-6">
      {/* Textul întrebării */}
      <h3 className="text-xl md:text-2xl font-semibold text-white leading-relaxed">
        {text}
      </h3>

      {/* 2 Butoane mari */}
      <div className="grid grid-cols-2 gap-4 md:gap-6">
        {options.map((opt) => {
          const isSelected = selectedAnswer === opt.value;
          const isThisCorrect = isSubmitted && opt.value === correctAnswer;
          const isThisWrong = isSubmitted && isSelected && !isCorrect;
          const Icon = opt.icon;

          let borderColor = 'border-white/10';
          let bgColor = 'bg-white/[0.02]';
          let textColor = 'text-slate-300';
          let iconColor = 'text-slate-500';
          let shadow = '';

          if (isSubmitted) {
            if (isThisCorrect) {
              borderColor = 'border-emerald-500/50';
              bgColor = 'bg-emerald-500/10';
              textColor = 'text-emerald-300';
              iconColor = 'text-emerald-400';
              shadow = 'shadow-[0_0_30px_rgba(16,185,129,0.15)]';
            } else if (isThisWrong) {
              borderColor = 'border-red-500/50';
              bgColor = 'bg-red-500/10';
              textColor = 'text-red-300';
              iconColor = 'text-red-400';
              shadow = 'shadow-[0_0_30px_rgba(239,68,68,0.15)]';
            }
          } else if (isSelected) {
            borderColor = 'border-purple-500/50';
            bgColor = 'bg-purple-500/10';
            textColor = 'text-purple-200';
            iconColor = 'text-purple-400';
            shadow = 'shadow-[0_0_30px_rgba(168,85,247,0.2)]';
          }

          return (
            <button
              key={`${questionId}-${opt.value}`}
              onClick={() => !isSubmitted && onSelect(opt.value)}
              disabled={isSubmitted}
              className={`
                flex flex-col items-center justify-center gap-3 p-8 md:p-10 rounded-2xl border-2 transition-all duration-300
                ${borderColor} ${bgColor} ${textColor} ${shadow}
                ${!isSubmitted ? 'hover:scale-[1.03] hover:border-purple-500/40 cursor-pointer active:scale-[0.98]' : 'cursor-default'}
                group
              `}
            >
              {/* Icon container */}
              <div className={`
                w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center transition-all duration-300
                ${isSubmitted && isThisCorrect
                  ? 'bg-emerald-500/20 ring-2 ring-emerald-500/30'
                  : isSubmitted && isThisWrong
                    ? 'bg-red-500/20 ring-2 ring-red-500/30'
                    : isSelected
                      ? 'bg-purple-500/20 ring-2 ring-purple-500/30 scale-110'
                      : 'bg-white/[0.03] group-hover:bg-purple-500/10'
                }
              `}>
                <Icon className={`w-8 h-8 md:w-10 md:h-10 ${iconColor} transition-all duration-300 ${isSelected && !isSubmitted ? 'scale-110' : ''}`} />
              </div>

              {/* Label */}
              <span className={`text-lg md:text-xl font-bold ${textColor} transition-colors duration-200`}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
