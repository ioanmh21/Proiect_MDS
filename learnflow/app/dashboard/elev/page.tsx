'use client';

import React, { useEffect, useState } from 'react';
import { useElev } from '@/app/context/ElevContext';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import StudentProgressDashboard from '@/components/StudentProgressDashboard';
import AIRecommendationCard from '@/components/AIRecommendationCard';
import { 
  BookOpen, 
  Clock, 
  ChevronRight, 
  BrainCircuit, 
  MessageCircle, 
  PlayCircle,
  FileText,
  CheckCircle,
  Clock3,
  Plus,
  Loader2,
  Key,
  LogOut,
  PenTool,
  User
} from 'lucide-react';

interface Material {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
}

export default function StudentDashboard() {
  const { userName, classes, isLoading: isContextLoading, refreshProfile, handleSignOut } = useElev();
  
  const [progressData, setProgressData] = useState({
    averageScore: 0,
    studyTime: "0m",
    testsCompleted: 0,
    testsHistory: [],
    conceptLevels: [],
    weakConcepts: []
  });
  const [aiRecommendation, setAiRecommendation] = useState({
    title: "Se încarcă...",
    description: "Analizăm progresul tău pentru a genera recomandări personalizate...",
    estimatedTime: "-",
    difficulty: "-"
  });
  const [isProgressLoading, setIsProgressLoading] = useState(true);

  // Join Class State
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  
  const router = useRouter();

  useEffect(() => {
    async function fetchProgress() {
      try {
        const response = await fetch('/api/progress');
        if (response.ok) {
          const data = await response.json();
          if (data) {
            setProgressData({
              averageScore: data.averageScore || 0,
              studyTime: data.studyTime || "0m",
              testsCompleted: data.testsCompleted || 0,
              testsHistory: data.testsHistory || [],
              conceptLevels: data.conceptLevels || [],
              weakConcepts: data.weakConcepts || []
            });
            if (data.aiRecommendation) {
              setAiRecommendation(data.aiRecommendation);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching progress:', error);
      } finally {
        setIsProgressLoading(false);
      }
    }

    if (!isContextLoading) {
      fetchProgress();
    }
  }, [isContextLoading]);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode || joinCode.trim().length === 0) return;

    setIsJoining(true);
    setJoinError('');

    try {
      const res = await fetch('/api/classes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Eroare la înrolare');
      }

      setJoinCode('');
      await refreshProfile(); // Refresh context to get new classes
    } catch (err: any) {
      setJoinError(err.message);
    } finally {
      setIsJoining(false);
    }
  };

  const isLoading = isContextLoading;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-6 md:p-8 font-sans selection:bg-purple-500/30">
      
      {/* Background Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <header className="mb-10 flex flex-col md:flex-row md:justify-between md:items-end gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 mb-2">
              Salut, {userName}! 👋
            </h1>
            <p className="text-slate-400">Bine ai revenit. Iată progresul tău de săptămâna aceasta.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
            {/* Join Class Quick Action */}
            <form onSubmit={handleJoinClass} className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Cod Clasă (ex: A4F9KL)"
                    className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 w-48 transition-all"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isJoining || !joinCode}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {isJoining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span className="hidden sm:inline">Înrolare</span>
                </button>
              </div>
              {joinError && <p className="text-red-400 text-xs">{joinError}</p>}
            </form>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => router.push('/dashboard/elev/profil')}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 border border-blue-500/20 transition-colors shrink-0"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline font-medium text-sm">Profil și Statistici</span>
              </button>

              <button 
                onClick={handleSignOut}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 border border-red-500/20 transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline font-medium text-sm">Deconectare</span>
              </button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Progress & Materials */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Active Classes */}
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
                <BookOpen className="w-5 h-5 text-blue-400" />
                Clasele Mele
              </h2>
              
              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[1, 2].map(i => (
                    <div key={i} className="animate-pulse bg-white/5 h-32 rounded-2xl border border-white/10" />
                  ))}
                </div>
              ) : classes.length === 0 ? (
                <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-12 text-center text-slate-400">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50 text-slate-500" />
                  <p className="mb-2">Nu ești înscris în nicio clasă încă.</p>
                  <p className="text-sm">Folosește codul primit de la profesor pentru a te înrola.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {classes.map((cls) => (
                    <div 
                      key={cls.id} 
                      onClick={() => router.push(`/dashboard/elev/clasa/${cls.id}`)}
                      className="group cursor-pointer bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10 hover:border-purple-500/30 backdrop-blur-md rounded-2xl p-6 transition-all hover:bg-white/[0.08]"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(168,85,247,0.2)] group-hover:scale-110 transition-transform">
                          <BookOpen className="w-6 h-6" />
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-purple-400 transition-colors" />
                      </div>
                      
                      <h3 className="font-semibold text-lg text-slate-200 group-hover:text-white transition-colors truncate">
                        {cls.name}
                      </h3>
                      <p className="text-sm text-slate-400 mt-1">Apasă pentru a vedea materialele și colegii</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
            
          </div>

          {/* Right Column: AI & Tutor */}
          <div className="space-y-8">
            
            {/* AI Recommendation */}
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
                <BrainCircuit className="w-5 h-5 text-fuchsia-400" />
                Recomandat de AI
              </h2>
              
              {isProgressLoading ? (
                  <div className="animate-pulse space-y-4 bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-6">
                    <div className="h-6 w-1/4 bg-white/10 rounded-md mb-2" />
                    <div className="h-6 w-3/4 bg-white/10 rounded-md" />
                    <div className="h-20 w-full bg-white/10 rounded-md" />
                    <div className="flex gap-2">
                      <div className="h-16 flex-1 bg-white/10 rounded-xl" />
                      <div className="h-16 flex-1 bg-white/10 rounded-xl" />
                    </div>
                    <div className="h-12 w-full bg-white/10 rounded-xl mt-4" />
                  </div>
              ) : (
                <AIRecommendationCard 
                  recommendation={{
                    title: aiRecommendation.title,
                    type: 'video',
                    reason: aiRecommendation.description,
                    difficulty: (aiRecommendation.difficulty as any) || 'Mediu',
                    estimatedTime: aiRecommendation.estimatedTime || '15m'
                  }}
                  onStart={() => router.push('/dashboard/elev/chat')}
                />
              )}
            </section>

            {/* Tutor Chat Shortcut */}
            <section>
              <div 
                onClick={() => router.push('/dashboard/elev/chat')}
                className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-6 group cursor-pointer hover:bg-white/[0.05] transition-all"
              >
                {isLoading ? (
                   <div className="animate-pulse flex items-center gap-4">
                     <div className="h-12 w-12 bg-white/10 rounded-full shrink-0" />
                     <div className="space-y-2 flex-1">
                        <div className="h-5 w-2/3 bg-white/10 rounded-md" />
                        <div className="h-4 w-full bg-white/10 rounded-md" />
                     </div>
                   </div>
                ) : (
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(59,130,246,0.5)] group-hover:scale-110 transition-transform">
                      <MessageCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors">Tutor AI Live</h3>
                      <p className="text-sm text-slate-400 leading-relaxed mb-3">Ai o întrebare sau nu înțelegi un concept? Discută cu tutorul tău personal acum.</p>
                      <span className="text-blue-400 text-sm font-medium flex items-center gap-1 group-hover:text-blue-300">
                        Deschide chat-ul <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </section>
            
          </div>
        </div>
      </div>
    </div>
  );
}
