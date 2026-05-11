'use client';

import React from 'react';
import { useElev } from '@/app/context/ElevContext';
import { 
  BookOpen, 
  Clock, 
  Award, 
  ChevronRight, 
  BrainCircuit, 
  MessageCircle, 
  PlayCircle,
  FileText,
  CheckCircle,
  Clock3
} from 'lucide-react';

// Hardcoded Data
const progressData = {
  averageScore: 8.5,
  studyTime: "12h 30m",
  testsCompleted: 4
};

const recentMaterials = [
  { id: 1, title: "Introducere în React", type: "Video", status: "completed", time: "1h 20m" },
  { id: 2, title: "Algebră - Funcții de gradul 2", type: "Document", status: "in-progress", time: "45m left" },
  { id: 3, title: "Fizică - Termodinamică", type: "Quiz", status: "pending", time: "30m" },
];

const aiRecommendation = {
  title: "Test de Recapitulare: Matematică",
  description: "Pe baza activității tale recente, am pregătit un test personalizat care să te ajute să consolidezi cunoștințele la Algebră.",
  estimatedTime: "20m",
  difficulty: "Mediu"
};

export default function StudentDashboard() {
  const { userName, isLoading } = useElev();

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-6 md:p-8 font-sans selection:bg-purple-500/30">
      
      {/* Background Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <header className="mb-10 flex justify-between items-end">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 mb-2">
              Salut, {userName}! 👋
            </h1>
            <p className="text-slate-400">Bine ai revenit. Iată progresul tău de săptămâna aceasta.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Progress & Materials */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Weekly Progress */}
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
                <Award className="w-5 h-5 text-purple-400" />
                Progres Săptămânal
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Scor Mediu", value: progressData.averageScore, icon: Award, color: "text-amber-400" },
                  { label: "Timp Studiu", value: progressData.studyTime, icon: Clock, color: "text-blue-400" },
                  { label: "Teste Completate", value: progressData.testsCompleted, icon: BookOpen, color: "text-emerald-400" }
                ].map((stat, i) => (
                  <div key={i} className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-6 relative overflow-hidden group hover:bg-white/[0.05] transition-all duration-300">
                    {isLoading ? (
                      <div className="animate-pulse space-y-3">
                        <div className="h-10 w-10 bg-white/10 rounded-full" />
                        <div className="h-8 w-20 bg-white/10 rounded-md" />
                        <div className="h-4 w-24 bg-white/10 rounded-md" />
                      </div>
                    ) : (
                      <>
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                          <stat.icon className={`w-12 h-12 ${stat.color}`} />
                        </div>
                        <div className={`w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/5`}>
                          <stat.icon className={`w-5 h-5 ${stat.color}`} />
                        </div>
                        <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                        <div className="text-sm text-slate-400">{stat.label}</div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Recent Materials */}
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
                <BookOpen className="w-5 h-5 text-blue-400" />
                Materiale Recente
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
                ) : (
                  <div className="divide-y divide-white/10">
                    {recentMaterials.map((material) => (
                      <div key={material.id} className="p-4 md:p-5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors cursor-pointer group">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20 group-hover:scale-105 transition-transform">
                          {material.type === 'Video' ? <PlayCircle className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-slate-200 truncate">{material.title}</h3>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {material.time}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                            <span>{material.type}</span>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center">
                          {material.status === 'completed' && (
                            <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle className="w-3 h-3" /> Finalizat
                            </span>
                          )}
                          {material.status === 'in-progress' && (
                            <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Clock3 className="w-3 h-3" /> În curs
                            </span>
                          )}
                          {material.status === 'pending' && (
                            <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                              Nefinalizat
                            </span>
                          )}
                          <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-purple-400 transition-colors ml-2 md:ml-4 shrink-0" />
                        </div>
                      </div>
                    ))}
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
              
              <div className="bg-gradient-to-br from-purple-900/40 to-fuchsia-900/20 border border-purple-500/30 backdrop-blur-md rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/20 rounded-full blur-[50px]" />
                
                {isLoading ? (
                  <div className="animate-pulse space-y-4">
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
                  <div className="relative z-10">
                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-fuchsia-500/20 text-fuchsia-300 text-xs font-medium mb-4 border border-fuchsia-500/20">
                      Potrivire 98%
                    </div>
                    
                    <h3 className="text-lg font-bold text-white mb-2 leading-tight">
                      {aiRecommendation.title}
                    </h3>
                    
                    <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                      {aiRecommendation.description}
                    </p>
                    
                    <div className="flex gap-3 mb-6">
                      <div className="bg-black/20 rounded-lg px-3 py-2 border border-white/5 flex-1 text-center">
                        <div className="text-xs text-slate-400 mb-1">Timp Estimat</div>
                        <div className="text-sm font-medium text-white">{aiRecommendation.estimatedTime}</div>
                      </div>
                      <div className="bg-black/20 rounded-lg px-3 py-2 border border-white/5 flex-1 text-center">
                        <div className="text-xs text-slate-400 mb-1">Dificultate</div>
                        <div className="text-sm font-medium text-white">{aiRecommendation.difficulty}</div>
                      </div>
                    </div>
                    
                    <button className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-medium py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] flex items-center justify-center gap-2 group">
                      Începe Testul <PlayCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Tutor Chat Shortcut */}
            <section>
              <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-6 group cursor-pointer hover:bg-white/[0.05] transition-all">
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
