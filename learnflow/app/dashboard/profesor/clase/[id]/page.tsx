'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { 
  Users,
  UserMinus,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Key,
  Copy,
  CheckCircle2
} from 'lucide-react';

interface Student {
  id: string;
  name: string;
  joined_at: string;
}

interface ClassDetails {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export default function TeacherClassView() {
  const router = useRouter();
  const params = useParams();
  const classId = params.id as string;
  
  const supabase = createClient();
  
  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!classId) return;

    async function fetchData() {
      setIsLoading(true);
      try {
        // Fetch class details
        const { data: classData, error: classError } = await supabase
          .from('classes')
          .select('*')
          .eq('id', classId)
          .single();

        if (classError) throw new Error('Nu am putut încărca detaliile clasei.');
        setClassDetails(classData);

        // Fetch students
        const res = await fetch(`/api/classes/${classId}/students`);
        if (res.ok) {
          const data = await res.json();
          setStudents(data.students || []);
        }
      } catch (err: any) {
        console.error('Error fetching class data:', err);
        setError(err.message || 'Eroare la încărcarea datelor.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [classId, supabase]);

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleKickStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Ești sigur că vrei să elimini elevul ${studentName} din această clasă?`)) return;

    try {
      const res = await fetch(`/api/classes/${classId}/students?studentId=${studentId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Eroare la eliminarea elevului');
      }

      setStudents(prev => prev.filter(s => s.id !== studentId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!classDetails && !isLoading && error) {
    return (
      <div className="min-h-screen p-8 flex flex-col items-center justify-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Eroare</h2>
        <p className="text-slate-400 mb-4">{error}</p>
        <button 
          onClick={() => router.push('/dashboard/profesor/clase')}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
        >
          Înapoi la Clase
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto p-4 md:p-8">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/dashboard/profesor/clase')}
            className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </button>
          <div>
            {isLoading && !classDetails ? (
              <div className="h-8 w-48 bg-white/10 animate-pulse rounded-lg mb-2" />
            ) : (
              <h1 className="text-3xl font-bold text-white mb-1">{classDetails?.name}</h1>
            )}
            <p className="text-slate-400">Vizualizează detaliile și gestionează elevii înscriși.</p>
          </div>
        </div>
      </header>

      {/* Class Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-md flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400 mb-1">Cod de acces clasă</p>
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-emerald-400" />
              {isLoading && !classDetails ? (
                <div className="h-8 w-24 bg-white/10 animate-pulse rounded-lg" />
              ) : (
                <span className="text-2xl font-mono font-bold tracking-wider text-emerald-400">
                  {classDetails?.code}
                </span>
              )}
            </div>
          </div>
          {classDetails && (
            <button
              onClick={() => copyToClipboard(classDetails.code)}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-slate-300 hover:text-white flex items-center gap-2"
            >
              {copiedCode === classDetails.code ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              <span className="hidden sm:inline">Copiază</span>
            </button>
          )}
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-md flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
            <Users className="w-7 h-7 text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-slate-400 mb-1">Total Elevi Înscriși</p>
            {isLoading ? (
              <div className="h-8 w-12 bg-white/10 animate-pulse rounded-lg" />
            ) : (
              <p className="text-3xl font-bold text-white">{students.length}</p>
            )}
          </div>
        </div>
      </div>

      {/* Students List */}
      <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-md">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          Lista Elevilor
        </h2>
        
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse flex items-center justify-between p-4 bg-white/5 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/10" />
                  <div className="h-5 w-32 bg-white/10 rounded" />
                </div>
                <div className="h-8 w-24 bg-white/10 rounded-lg" />
              </div>
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-12 text-slate-400 border border-dashed border-white/10 rounded-xl">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-50" />
            <p>Niciun elev nu s-a înscris în această clasă.</p>
            <p className="text-sm mt-1">Oferă-le codul <span className="font-mono text-emerald-400">{classDetails?.code}</span> pentru a se înrola.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {students.map(student => (
              <div key={student.id} className="flex items-center justify-between p-4 bg-black/20 hover:bg-white/[0.02] border border-white/5 rounded-xl transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-lg font-medium text-slate-300 border border-white/10 shadow-inner">
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-200">{student.name}</h3>
                    <p className="text-xs text-slate-500">S-a alăturat: {new Date(student.joined_at).toLocaleDateString()}</p>
                  </div>
                </div>
                
                <button
                  onClick={() => handleKickStudent(student.id, student.name)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-red-400 hover:text-white bg-red-500/5 hover:bg-red-500/80 border border-red-500/10 hover:border-red-500 transition-all opacity-100 sm:opacity-50 sm:group-hover:opacity-100"
                  title="Elimină elevul din clasă"
                >
                  <UserMinus className="w-4 h-4" />
                  <span className="hidden sm:inline">Elimină</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
