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
  Key
} from 'lucide-react';

interface Material {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
}

export default function StudentDashboard() {
  const { userName, classes, isLoading: isContextLoading, refreshProfile } = useElev();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isMaterialsLoading, setIsMaterialsLoading] = useState(true);
  
  const [progressData, setProgressData] = useState({
    averageScore: 0,
    studyTime: "0m",
    testsCompleted: 0
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
  
  const supabase = createClient();
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
              testsCompleted: data.testsCompleted || 0
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

    async function fetchMaterials() {
      if (classes.length === 0) {
        setMaterials([]);
        setIsMaterialsLoading(false);
        return;
      }

      try {
        const classIds = classes.map(c => c.id);
        const { data, error } = await supabase
          .from('materials')
          .select('id, title, type, status, created_at')
          .in('class_id', classIds)
          .order('created_at', { ascending: false })
          .limit(10);

        if (data) {
          setMaterials(data as Material[]);
        }
      } catch (error) {
        console.error('Error fetching materials:', error);
      } finally {
        setIsMaterialsLoading(false);
      }
    }

    if (!isContextLoading) {
      fetchProgress();
      fetchMaterials();
    }
  }, [classes, isContextLoading, supabase]);

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

  const isLoading = isContextLoading || isMaterialsLoading;

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
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Progress & Materials */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Active Classes Badges */}
            {classes.length > 0 && (
               <div className="flex flex-wrap gap-2 mb-2">
                 {classes.map(cls => (
                   <span key={cls.id} className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs font-medium text-slate-300">
                     {cls.name}
                   </span>
                 ))}
               </div>
            )}

            {/* Weekly Progress Dashboard */}
            <section>
              <StudentProgressDashboard 
                progressSummary={{
                  averageScore: progressData.averageScore,
                  totalStudyTime: progressData.studyTime,
                  materialsCount: progressData.testsCompleted
                }}
              />
            </section>

            {/* Recent Materials */}
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
                <BookOpen className="w-5 h-5 text-blue-400" />
                Materiale Recente din Clasele Tale
              </h2>
              
              <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl overflow-hidden">
                {isLoading ? (
                  <div className="p-4 space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse flex items-center gap-4 p-4">
                        <div className="h-12 w-12 bg-white/10 rounded-xl shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-5 w-1/3 bg-white/10 rounded-md" />
                          <div className="h-4 w-1/4 bg-white/10 rounded-md" />
                        </div>
                        <div className="h-8 w-20 bg-white/10 rounded-full shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : classes.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50 text-slate-500" />
                    <p className="mb-2">Nu ești înscris în nicio clasă încă.</p>
                    <p className="text-sm">Folosește codul primit de la profesor pentru a te înrola și a vedea materialele.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/10">
                    {materials.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        Niciun material adăugat recent în clasele tale.
                      </div>
                    ) : (
                      materials.map((material) => (
                        <div 
                          key={material.id} 
                          onClick={() => material.status === 'completed' ? router.push(`/dashboard/elev/chat?materialId=${material.id}`) : null}
                          className={`p-4 md:p-5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors group ${material.status === 'completed' ? 'cursor-pointer' : 'cursor-default opacity-80'}`}
                        >
                          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20 group-hover:scale-105 transition-transform">
                            {material.type === 'video' ? <PlayCircle className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-slate-200 truncate">{material.title}</h3>
                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {new Date(material.created_at).toLocaleDateString()}
                              </span>
                              <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                              <span className="capitalize">{material.type}</span>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center">
                            {material.status === 'completed' && (
                              <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle className="w-3 h-3" /> Finalizat
                              </span>
                            )}
                            {material.status === 'processing' && (
                              <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Clock3 className="w-3 h-3" /> Se procesează
                              </span>
                            )}
                            {material.status === 'pending' && (
                              <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                În așteptare
                              </span>
                            )}
                            {material.status === 'error' && (
                              <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                                Eroare
                              </span>
                            )}
                            {material.status === 'completed' && (
                              <span className="opacity-0 group-hover:opacity-100 hidden sm:inline-flex items-center gap-1 ml-3 text-xs font-medium text-purple-400 transition-opacity duration-300">
                                <MessageCircle className="w-4 h-4" /> Discută
                              </span>
                            )}
                            <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-purple-400 transition-colors ml-2 md:ml-4 shrink-0" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
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
                  onStart={() => console.log('Starting recommendation...')}
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
