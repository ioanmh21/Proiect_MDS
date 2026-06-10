'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { Clock, Award, BookOpen, BrainCircuit, ChevronRight } from 'lucide-react';

// Interfaces for props
export interface ProgressData {
  averageScore: number;
  totalStudyTime: string;
  materialsCount: number;
}

export interface TestScore {
  name: string;
  score: number;
}

export interface ConceptLevel {
  concept: string;
  level: number; // 0 to 100
}

export interface WeakConcept {
  id: string;
  name: string;
  errorRate: number;
}

interface StudentProgressDashboardProps {
  progressSummary?: ProgressData;
  testScores?: TestScore[];
  conceptLevels?: ConceptLevel[];
  weakConcepts?: WeakConcept[];
}

export default function StudentProgressDashboard({
  progressSummary = { averageScore: 85, totalStudyTime: "12h 30m", materialsCount: 24 },
  testScores = [
    { name: 'Test 1', score: 65 },
    { name: 'Test 2', score: 72 },
    { name: 'Test 3', score: 85 },
    { name: 'Test 4', score: 90 },
  ],
  conceptLevels = [
    { concept: 'Algebră', level: 80 },
    { concept: 'Geometrie', level: 60 },
    { concept: 'Analiză', level: 90 },
    { concept: 'Trigonometrie', level: 40 },
    { concept: 'Logică', level: 75 },
  ],
  weakConcepts = [
    { id: 'c1', name: 'Trigonometrie', errorRate: 60 },
    { id: 'c2', name: 'Geometrie plană', errorRate: 40 },
  ]
}: StudentProgressDashboardProps) {
  const router = useRouter();

  const handleTutorChat = (conceptName: string) => {
    // Pre-populează chat-ul cu un mesaj despre acest concept
    const message = encodeURIComponent(`Vreau să exersez și să îmi explici mai bine la: ${conceptName}`);
    router.push(`/dashboard/elev/chat?initialMessage=${message}`);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Award className="w-12 h-12 text-amber-400" />
          </div>
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/5">
            <Award className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-white mb-1">{progressSummary.averageScore}%</div>
          <div className="text-sm text-slate-400">Scor Mediu</div>
        </div>

        <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Clock className="w-12 h-12 text-blue-400" />
          </div>
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/5">
            <Clock className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-white mb-1">{progressSummary.totalStudyTime}</div>
          <div className="text-sm text-slate-400">Timp Total de Studiu</div>
        </div>

        <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <BookOpen className="w-12 h-12 text-emerald-400" />
          </div>
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/5">
            <BookOpen className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-white mb-1">{progressSummary.materialsCount}</div>
          <div className="text-sm text-slate-400">Materiale Parcurse</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart: Evoluția Scorurilor */}
        <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Evoluție Scoruri (Ultimele 4 Săptămâni)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={testScores} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff1a" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#fff' }}
                  itemStyle={{ color: '#a855f7' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#a855f7" 
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#a855f7', strokeWidth: 2, stroke: '#1e293b' }}
                  activeDot={{ r: 6, fill: '#c084fc', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar Chart: Nivel pe Concepte */}
        <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Nivel de Stăpânire per Concept</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={conceptLevels}>
                <PolarGrid stroke="#ffffff20" />
                <PolarAngleAxis dataKey="concept" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="Nivel"
                  dataKey="level"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="#3b82f6"
                  fillOpacity={0.3}
                />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#fff' }}
                  itemStyle={{ color: '#3b82f6' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Weak Concepts / Actionable Pills */}
      <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <BrainCircuit className="w-5 h-5 text-red-400" />
          <h3 className="text-lg font-semibold text-white">Concepte ce necesită atenție</h3>
        </div>
        <p className="text-slate-400 text-sm mb-4">
          Sistemul a detectat o rată mai mare de eroare la aceste subiecte. Apasă pe un concept pentru a discuta cu Tutorul AI.
        </p>
        
        <div className="flex flex-wrap gap-3">
          {weakConcepts.length > 0 ? (
            weakConcepts.map((wc) => (
              <button
                key={wc.id}
                onClick={() => handleTutorChat(wc.name)}
                className="group flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 rounded-full transition-all text-red-300 hover:text-red-200"
              >
                <span className="font-medium">{wc.name}</span>
                <span className="text-xs bg-red-500/20 px-2 py-0.5 rounded-full text-red-200">
                  {wc.errorRate}% eroare
                </span>
                <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>
            ))
          ) : (
            <div className="text-emerald-400 text-sm flex items-center gap-2 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
              Excelent! Nu ai lacune majore detectate recent.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
