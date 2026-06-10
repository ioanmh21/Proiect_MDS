'use client';

import React from 'react';
import { 
  BrainCircuit, 
  PlayCircle, 
  FileText, 
  HelpCircle, 
  Clock, 
  BarChart, 
  ChevronRight 
} from 'lucide-react';

export interface AIRecommendationData {
  title: string;
  type: 'video' | 'pdf' | 'quiz';
  reason: string;
  difficulty: 'Ușor' | 'Mediu' | 'Greu';
  estimatedTime: string;
}

interface AIRecommendationCardProps {
  recommendation?: AIRecommendationData;
  onStart?: () => void;
}

export default function AIRecommendationCard({
  recommendation = {
    title: "Sisteme de ecuații liniare",
    type: "video",
    reason: "Ai greșit frecvent la conceptul 'Metoda substituției' în ultimul test.",
    difficulty: "Mediu",
    estimatedTime: "15m"
  },
  onStart
}: AIRecommendationCardProps) {
  
  // Icon based on type
  const TypeIcon = recommendation.type === 'video' ? PlayCircle : 
                   recommendation.type === 'pdf' ? FileText : HelpCircle;

  // Difficulty color mapping
  const difficultyColors = {
    'Ușor': 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    'Mediu': 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    'Greu': 'text-red-400 bg-red-400/10 border-red-400/20'
  };
  const diffClass = difficultyColors[recommendation.difficulty] || difficultyColors['Mediu'];

  return (
    <div className="relative overflow-hidden rounded-2xl p-6 group transition-all duration-300">
      {/* Subtle Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-fuchsia-900/10 border border-purple-500/20 backdrop-blur-md rounded-2xl z-0" />
      
      {/* Decorative Glow Effects */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-[40px] z-0 group-hover:bg-fuchsia-500/20 transition-colors duration-500" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-[30px] z-0 group-hover:bg-indigo-500/20 transition-colors duration-500" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
              <BrainCircuit className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
              Recomandat de AI
            </span>
          </div>
          
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-slate-300 text-xs">
            <TypeIcon className="w-3.5 h-3.5" />
            <span className="capitalize">{recommendation.type}</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white mb-2 leading-tight">
          {recommendation.title}
        </h3>

        {/* Reason */}
        <div className="bg-black/20 rounded-xl p-3 mb-5 border border-white/5 flex-grow">
          <p className="text-sm text-slate-300 leading-relaxed italic">
            "{recommendation.reason}"
          </p>
        </div>

        {/* Meta Info */}
        <div className="flex gap-3 mb-6">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>{recommendation.estimatedTime}</span>
          </div>
          <div className="w-px h-4 bg-white/10 my-auto" />
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium ${diffClass}`}>
            <BarChart className="w-3.5 h-3.5" />
            <span>{recommendation.difficulty}</span>
          </div>
        </div>

        {/* Action Button */}
        <button 
          onClick={onStart}
          className="w-full mt-auto relative overflow-hidden group/btn bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium py-3 rounded-xl transition-all shadow-[0_4px_14px_0_rgba(168,85,247,0.39)] hover:shadow-[0_6px_20px_rgba(168,85,247,0.23)] flex items-center justify-center gap-2"
        >
          <span className="relative z-10">Începe acum</span>
          <ChevronRight className="w-4 h-4 relative z-10 group-hover/btn:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
