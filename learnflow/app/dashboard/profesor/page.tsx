'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { 
  FileUp, 
  FileText, 
  Video, 
  AlertTriangle, 
  BarChart3, 
  CheckCircle, 
  Clock3, 
  AlertCircle,
  LayoutDashboard,
  Users,
  Plus
} from 'lucide-react';

// Datele mock au fost eliminate. Toate datele vin acum din API per clasă.

export default function TeacherDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [materials, setMaterials] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [reportData, setReportData] = useState<{ students: any[], alerts: any[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingReports, setIsLoadingReports] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // Fetch materials
        const { data: mats } = await supabase
          .from('materials')
          .select('id, title, type, status, created_at')
          .eq('teacher_id', user.id)
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
          .limit(5);

        if (mats) setMaterials(mats);

        // Fetch classes
        const { data: cls } = await supabase
          .from('classes')
          .select('id, name')
          .eq('teacher_id', user.id)
          .order('created_at', { ascending: false });

        if (cls && cls.length > 0) {
          setClasses(cls);
          setSelectedClassId(cls[0].id);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [supabase]);

  useEffect(() => {
    if (!selectedClassId) return;
    async function fetchReports() {
      setIsLoadingReports(true);
      try {
        const res = await fetch(`/api/classes/${selectedClassId}/reports`);
        if (res.ok) {
          const data = await res.json();
          setReportData(data);
        }
      } catch (error) {
        console.error("Error fetching reports", error);
      } finally {
        setIsLoadingReports(false);
      }
    }
    fetchReports();
  }, [selectedClassId]);

  const handleAction = (message: string) => {
    alert(message);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-end">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Bun venit înapoi!</h1>
          <p className="text-slate-400">Iată un rezumat al activității claselor tale de azi.</p>
        </div>
        
        {/* Big Upload Button */}
        <button 
          onClick={() => router.push('/dashboard/profesor/materiale')}
          className="group relative px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold transition-all shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] flex items-center gap-2 overflow-hidden"
        >
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
              <button 
                onClick={() => handleAction("Navigare spre toate materialele...")}
                className="text-sm text-purple-400 hover:text-purple-300 font-medium"
              >
                Vezi toate
              </button>
            </div>
            
            <div className="divide-y divide-white/5">
              {isLoading ? (
                <div className="p-8 text-center text-slate-400">Se încarcă materialele...</div>
              ) : materials.length === 0 ? (
                <div className="p-8 text-center text-slate-400">Nu ai încărcat niciun material încă.</div>
              ) : (
                materials.map((material) => (
                  <div key={material.id} className="p-5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors group">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10 group-hover:scale-105 transition-transform">
                      {material.type === 'video' ? (
                        <Video className="w-6 h-6 text-fuchsia-400" />
                      ) : (
                        <FileText className="w-6 h-6 text-blue-400" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-200 truncate group-hover:text-purple-300 transition-colors">{material.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="font-medium px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300 uppercase">{material.type}</span>
                        <span>•</span>
                        <span>{new Date(material.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center">
                      {material.status === 'completed' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle className="w-4 h-4" /> Finalizat
                        </span>
                      )}
                      {material.status === 'processing' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock3 className="w-4 h-4 animate-spin-slow" /> Se procesează
                        </span>
                      )}
                      {material.status === 'pending' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                          <Clock3 className="w-4 h-4" /> În așteptare
                        </span>
                      )}
                      {material.status === 'error' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                          <AlertCircle className="w-4 h-4" /> Eroare
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Class Progress Chart */}
          <section className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                Progres Claselor (Scoruri Medii / Elev)
              </h2>
              <select 
                className="bg-white/5 border border-white/10 text-sm text-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500 max-w-[200px]"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
              >
                {classes.length === 0 && <option value="">Fără clase</option>}
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            
            <div className="h-64 flex items-end justify-between gap-2 pt-4 relative">
              {isLoadingReports ? (
                 <div className="absolute inset-0 flex items-center justify-center text-slate-400">Se calculează datele clasei...</div>
              ) : !reportData || reportData.students.length === 0 ? (
                 <div className="absolute inset-0 flex items-center justify-center text-slate-400">Nu există date suficiente pentru această clasă.</div>
              ) : (
                <>
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                    <div className="border-b border-slate-500 w-full h-0"></div>
                    <div className="border-b border-slate-500 w-full h-0"></div>
                    <div className="border-b border-slate-500 w-full h-0"></div>
                    <div className="border-b border-slate-500 w-full h-0"></div>
                  </div>
                  
                  {reportData.students.slice(0, 15).map((student: any, i: number) => (
                    <div key={student.id} className="relative group w-full flex justify-center h-full items-end">
                      <div 
                        className="w-full max-w-[40px] bg-gradient-to-t from-purple-600/80 to-blue-500/80 rounded-t-sm hover:from-purple-500 hover:to-blue-400 transition-all duration-300 cursor-pointer border-t border-x border-white/20"
                        style={{ height: `${student.averageScore || 5}%` }}
                      >
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-800 border border-white/10 text-white text-xs px-2 py-1 rounded shadow-xl transition-opacity pointer-events-none whitespace-nowrap z-20 flex flex-col items-center">
                          <span className="font-semibold">{student.name}</span>
                          <span className="text-blue-300">{student.averageScore}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
            {!isLoadingReports && reportData && reportData.students.length > 0 && (
              <div className="flex justify-between mt-4 text-xs text-slate-400 font-medium px-2">
                <span>Elevi ({Math.min(reportData.students.length, 15)})</span>
              </div>
            )}
          </section>
        </div>

        {/* Right Column (Narrower) */}
        <div className="space-y-8">
          {/* Students at Risk Alert Card */}
          <section className="bg-gradient-to-br from-slate-900/80 to-red-950/30 border border-red-500/20 backdrop-blur-md rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-[40px]" />
            
            <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2 relative z-10">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Elevi cu risc
            </h2>

            <div className="space-y-4 relative z-10 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {isLoadingReports ? (
                <div className="text-center py-8 text-slate-400">Se încarcă alertele...</div>
              ) : !reportData || reportData.alerts.length === 0 ? (
                <div className="bg-black/20 border border-emerald-500/20 rounded-xl p-4 text-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <div className="font-medium text-emerald-100">Clasă în regulă!</div>
                  <p className="text-sm text-emerald-400/70">Niciun elev nu are alerte critice momentan.</p>
                </div>
              ) : (
                reportData.alerts.slice(0, 5).map((alert: any) => (
                  <div key={alert.id} className={`bg-black/20 border rounded-xl p-4 transition-colors ${
                    alert.severity === 'high' ? 'border-red-500/30 hover:border-red-500/50' :
                    alert.severity === 'medium' ? 'border-orange-500/30 hover:border-orange-500/50' :
                    'border-amber-500/30 hover:border-amber-500/50'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-slate-200">{alert.studentName}</div>
                      <span className={`w-2 h-2 rounded-full mt-1.5 ${
                        alert.severity === 'high' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 
                        alert.severity === 'medium' ? 'bg-orange-500' : 'bg-amber-500'
                      }`} />
                    </div>
                    <p className="text-sm text-slate-400 leading-snug">{alert.reason}</p>
                    <button 
                      onClick={() => handleAction(`Deschide profilul pentru ${alert.studentName}...`)}
                      className="mt-3 text-xs font-semibold text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                    >
                      Detalii elev <LayoutDashboard className="w-3 h-3 rotate-180" />
                    </button>
                  </div>
                ))
              )}
            </div>
            
            {classes.length > 0 && selectedClassId && (
              <button 
                onClick={() => router.push(`/dashboard/profesor/clase/${selectedClassId}`)}
                className="w-full mt-5 py-2.5 rounded-lg border border-red-500/30 text-red-400 font-medium text-sm hover:bg-red-500/10 transition-colors"
              >
                Vezi raportul complet al clasei
              </button>
            )}
          </section>

          {/* Quick Actions */}
          <section className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Acțiuni Rapide</h2>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => handleAction("Creare clasă nouă...")}
                className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-purple-500/30 transition-all flex flex-col items-center justify-center gap-2 text-slate-300 hover:text-white group"
              >
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-sm font-medium">Clasă nouă</span>
              </button>
              <button 
                onClick={() => handleAction("Creare test nou...")}
                className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-blue-500/30 transition-all flex flex-col items-center justify-center gap-2 text-slate-300 hover:text-white group"
              >
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
  );
}
