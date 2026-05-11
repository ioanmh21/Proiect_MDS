'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { 
  LayoutDashboard, 
  Users, 
  FileUp, 
  FileText, 
  Video, 
  AlertTriangle, 
  BarChart3, 
  CheckCircle, 
  Clock3, 
  AlertCircle,
  Settings,
  LogOut,
  Bell,
  Search,
  Plus
} from 'lucide-react';

// Mock Data
const recentMaterials = [
  { id: 1, title: 'Curs 4: Funcții Exponențiale', type: 'PDF', date: 'Azi, 10:30', status: 'processed', studentsViewed: 24 },
  { id: 2, title: 'Rezolvare Exerciții Seminar 3', type: 'Video', date: 'Azi, 09:15', status: 'processing', studentsViewed: 0 },
  { id: 3, title: 'Test Recapitulativ - Algebră', type: 'Quiz', date: 'Ieri, 14:00', status: 'processed', studentsViewed: 45 },
  { id: 4, title: 'Material Suport - Geometrie', type: 'PDF', date: 'Luni, 11:20', status: 'error', studentsViewed: 0 },
];

const studentsAtRisk = [
  { id: 1, name: 'Andrei Popescu', issue: 'Activitate scăzută (0 conectări în 5 zile)', severity: 'high' },
  { id: 2, name: 'Maria Ionescu', issue: 'Scor mediu sub 5 la ultimele 3 teste', severity: 'critical' },
  { id: 3, name: 'Cristian Vasile', issue: 'Teme nepredate (2 consecutive)', severity: 'medium' },
];

const chartData = [45, 52, 38, 65, 78, 62, 85, 90, 88, 95];

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userName, setUserName] = useState("Profesor");
  const [initial, setInitial] = useState("P");
  const supabase = createClient();

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", user.id)
          .single();
        
        if (profile) {
          const fullName = `Prof. ${profile.last_name || profile.first_name || ''}`;
          setUserName(fullName.trim());
          setInitial((profile.last_name?.[0] || profile.first_name?.[0] || "P").toUpperCase());
        }
      }
    }
    
    fetchProfile();
  }, [supabase]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans flex selection:bg-purple-500/30">
      
      {/* Background Effects */}
      <div className="fixed top-[-10%] left-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-white/10 bg-slate-950/50 backdrop-blur-xl hidden md:flex flex-col relative z-20">
        <div className="p-6">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
            LearnFlow
          </h2>
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1 block">
            Portal Profesor
          </span>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'students', label: 'Clase & Elevi', icon: Users },
            { id: 'materials', label: 'Materiale', icon: FileText },
            { id: 'reports', label: 'Rapoarte', icon: BarChart3 },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === item.id 
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all duration-200">
            <Settings className="w-5 h-5" />
            <span className="font-medium">Setări</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all duration-200">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Deconectare</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative z-10 overflow-y-auto">
        {/* Top Header */}
        <header className="h-20 border-b border-white/10 bg-slate-950/30 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-30">
          <div className="relative hidden sm:block">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Caută materiale, elevi..." 
              className="bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all w-64 text-white placeholder-slate-500"
            />
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <button className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-purple-500 rounded-full"></span>
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-white">{userName}</div>
                <div className="text-xs text-slate-400">Profesor</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-white shadow-lg border border-white/20">
                {initial}
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-8 max-w-7xl mx-auto space-y-8">
          
          <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-end">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Bun venit înapoi!</h1>
              <p className="text-slate-400">Iată un rezumat al activității claselor tale de azi.</p>
            </div>
            
            {/* Big Upload Button */}
            <button className="group relative px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold transition-all shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] flex items-center gap-2 overflow-hidden">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              <FileUp className="w-5 h-5 relative z-10 group-hover:-translate-y-1 transition-transform" />
              <span className="relative z-10">Încarcă material nou</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column (Wider) */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Materials List */}
              <section className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl overflow-hidden flex flex-col">
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    Ultimele Materiale
                  </h2>
                  <button className="text-sm text-purple-400 hover:text-purple-300 font-medium">Vezi toate</button>
                </div>
                
                <div className="divide-y divide-white/5">
                  {recentMaterials.map((material) => (
                    <div key={material.id} className="p-5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors group">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10 group-hover:scale-105 transition-transform">
                        {material.type === 'Video' ? (
                          <Video className="w-6 h-6 text-fuchsia-400" />
                        ) : (
                          <FileText className="w-6 h-6 text-blue-400" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-200 truncate group-hover:text-purple-300 transition-colors">{material.title}</h3>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                          <span className="font-medium px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300">{material.type}</span>
                          <span>•</span>
                          <span>{material.date}</span>
                          {material.status === 'processed' && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-slate-300"><Users className="w-3 h-3" /> {material.studentsViewed} vizualizări</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center">
                        {material.status === 'processed' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle className="w-4 h-4" /> Finalizat
                          </span>
                        )}
                        {material.status === 'processing' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock3 className="w-4 h-4 animate-spin-slow" /> Se procesează
                          </span>
                        )}
                        {material.status === 'error' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                            <AlertCircle className="w-4 h-4" /> Eroare
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Class Progress Chart (Placeholder) */}
              <section className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-400" />
                    Progres Clasa 10A (Ultimele 10 teste)
                  </h2>
                  <select className="bg-white/5 border border-white/10 text-sm text-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500">
                    <option>Matematică</option>
                    <option>Informatică</option>
                  </select>
                </div>
                
                <div className="h-64 flex items-end justify-between gap-2 pt-4 relative">
                  {/* Grid Lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                    <div className="border-b border-slate-500 w-full h-0"></div>
                    <div className="border-b border-slate-500 w-full h-0"></div>
                    <div className="border-b border-slate-500 w-full h-0"></div>
                    <div className="border-b border-slate-500 w-full h-0"></div>
                  </div>
                  
                  {/* Bars */}
                  {chartData.map((val, i) => (
                    <div key={i} className="relative group w-full flex justify-center h-full items-end">
                      <div 
                        className="w-full max-w-[40px] bg-gradient-to-t from-purple-600/80 to-blue-500/80 rounded-t-sm hover:from-purple-500 hover:to-blue-400 transition-all duration-300 cursor-pointer border-t border-x border-white/20"
                        style={{ height: `${val}%` }}
                      >
                        {/* Tooltip */}
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 border border-white/10 text-white text-xs px-2 py-1 rounded shadow-xl transition-opacity pointer-events-none whitespace-nowrap">
                          Scor: {val}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-4 text-xs text-slate-400 font-medium px-2">
                  <span>Test 1</span>
                  <span>Test 5</span>
                  <span>Test 10</span>
                </div>
              </section>

            </div>

            {/* Right Column (Narrower) */}
            <div className="space-y-8">
              
              {/* Students at Risk Alert Card */}
              <section className="bg-gradient-to-br from-slate-900/80 to-red-950/30 border border-red-500/20 backdrop-blur-md rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-[40px]" />
                
                <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2 relative z-10">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  Elevi cu risc de rămânere în urmă
                </h2>

                <div className="space-y-4 relative z-10">
                  {studentsAtRisk.map((student) => (
                    <div key={student.id} className="bg-black/20 border border-white/5 rounded-xl p-4 hover:border-red-500/30 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium text-slate-200">{student.name}</div>
                        <span className={`w-2 h-2 rounded-full mt-1.5 ${
                          student.severity === 'critical' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 
                          student.severity === 'high' ? 'bg-orange-500' : 'bg-amber-500'
                        }`} />
                      </div>
                      <p className="text-sm text-slate-400 leading-snug">{student.issue}</p>
                      <button className="mt-3 text-xs font-semibold text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
                        Contactează elevul <LayoutDashboard className="w-3 h-3 rotate-180" />
                      </button>
                    </div>
                  ))}
                </div>
                
                <button className="w-full mt-5 py-2.5 rounded-lg border border-red-500/30 text-red-400 font-medium text-sm hover:bg-red-500/10 transition-colors">
                  Vezi raport complet
                </button>
              </section>

              {/* Quick Actions */}
              <section className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Acțiuni Rapide</h2>
                <div className="grid grid-cols-2 gap-3">
                  <button className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-purple-500/30 transition-all flex flex-col items-center justify-center gap-2 text-slate-300 hover:text-white group">
                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Plus className="w-5 h-5 text-purple-400" />
                    </div>
                    <span className="text-sm font-medium">Clasă nouă</span>
                  </button>
                  <button className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-blue-500/30 transition-all flex flex-col items-center justify-center gap-2 text-slate-300 hover:text-white group">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FileText className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="text-sm font-medium">Creează test</span>
                  </button>
                </div>
              </section>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
