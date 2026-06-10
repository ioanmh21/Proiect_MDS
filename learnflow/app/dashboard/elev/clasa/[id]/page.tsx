'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useElev } from '@/app/context/ElevContext';
import { 
  BookOpen, 
  Clock, 
  ChevronRight, 
  PlayCircle,
  FileText,
  CheckCircle,
  Clock3,
  LogOut,
  Users,
  PenTool,
  MessageCircle,
  ArrowLeft,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface Material {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
}

interface Student {
  id: string;
  name: string;
  joined_at: string;
}

export default function StudentClassView() {
  const router = useRouter();
  const params = useParams();
  const classId = params.id as string;
  
  const { classes, refreshProfile } = useElev();
  const supabase = createClient();
  
  const [materials, setMaterials] = useState<Material[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const [error, setError] = useState('');

  const currentClass = classes.find(c => c.id === classId);

  useEffect(() => {
    if (!classId) return;

    async function fetchData() {
      setIsLoading(true);
      try {
        // Fetch materials
        const { data: materialsData, error: materialsError } = await supabase
          .from('materials')
          .select('id, title, type, status, created_at')
          .eq('class_id', classId)
          .eq('is_archived', false)
          .order('created_at', { ascending: false });

        if (materialsData) setMaterials(materialsData);

        // Fetch students
        const res = await fetch(`/api/classes/${classId}/students`);
        if (res.ok) {
          const data = await res.json();
          setStudents(data.students || []);
        }
      } catch (err) {
        console.error('Error fetching class data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [classId, supabase]);

  const handleLeaveClass = async () => {
    if (!confirm('Ești sigur că vrei să ieși din această clasă? Nu vei mai avea acces la materialele ei.')) return;

    setIsLeaving(true);
    setError('');

    try {
      const res = await fetch(`/api/classes/join?classId=${classId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Eroare la părăsirea clasei');
      }

      await refreshProfile();
      router.push('/dashboard/elev');
    } catch (err: any) {
      setError(err.message);
      setIsLeaving(false);
    }
  };

  if (!currentClass) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-200 p-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-500" />
          <p>Se încarcă clasa sau nu ai acces...</p>
          <button 
            onClick={() => router.push('/dashboard/elev')}
            className="mt-4 text-purple-400 hover:text-purple-300"
          >
            Înapoi la Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-6 md:p-8 font-sans selection:bg-purple-500/30">
      <div className="max-w-6xl mx-auto relative z-10 space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/dashboard/elev')}
              className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-300" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">{currentClass.name}</h1>
              <p className="text-slate-400">Vizualizează materialele și colegii tăi din această clasă.</p>
            </div>
          </div>

          <button 
            onClick={handleLeaveClass}
            disabled={isLeaving}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-colors font-medium text-sm disabled:opacity-50"
          >
            {isLeaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Ieși din clasă
          </button>
        </header>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Materials */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
              <BookOpen className="w-5 h-5 text-blue-400" />
              Materiale Educaționale
            </h2>
            
            <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl overflow-hidden">
              {isLoading ? (
                <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-500" /></div>
              ) : materials.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50 text-slate-500" />
                  <p>Profesorul nu a adăugat niciun material în această clasă.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {materials.map((material) => (
                    <div 
                      key={material.id} 
                      onClick={() => material.status === 'completed' ? router.push(`/dashboard/elev/chat?materialId=${material.id}`) : null}
                      className={`p-4 md:p-5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors group ${material.status === 'completed' ? 'cursor-pointer' : 'cursor-default opacity-80'}`}
                    >
                      <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20 group-hover:scale-105 transition-transform">
                        {material.type === 'video' ? <PlayCircle className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-200 truncate group-hover:text-purple-300 transition-colors">{material.title}</h3>
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
                          <div className="opacity-0 group-hover:opacity-100 hidden sm:flex items-center gap-2 ml-3 transition-opacity duration-300">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/elev/test/${material.id}`);
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                            >
                              <PenTool className="w-3.5 h-3.5" /> Dă un Test
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/elev/chat?materialId=${material.id}`);
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5" /> Discută
                            </button>
                          </div>
                        )}
                        <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-purple-400 transition-colors ml-2 md:ml-4 shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Classmates */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
              <Users className="w-5 h-5 text-emerald-400" />
              Colegi de Clasă
            </h2>
            
            <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-6">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/10" />
                      <div className="flex-1 h-4 bg-white/10 rounded" />
                    </div>
                  ))}
                </div>
              ) : students.length <= 1 ? (
                <p className="text-slate-400 text-sm text-center py-4">Ești singurul elev din această clasă momentan.</p>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {students.map(student => (
                    <div key={student.id} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-sm font-medium text-slate-300 border border-white/5">
                        {student.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{student.name}</p>
                        <p className="text-xs text-slate-500">S-a alăturat: {new Date(student.joined_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
