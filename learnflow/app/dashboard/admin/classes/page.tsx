import React from 'react';
import { School, Users, Key, Clock } from 'lucide-react';
import { createClient as createBaseClient } from '@supabase/supabase-js';
import { DeleteClassButton } from './DeleteClassButton';
import Link from 'next/link';

export default async function AdminClassesPage() {
  const adminSupabase = createBaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_KEY!
  );

  // Fetch classes
  const { data: classes } = await adminSupabase
    .from('classes')
    .select('*')
    .order('created_at', { ascending: false });

  // Fetch teachers
  const { data: teachers } = await adminSupabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('role', 'teacher');

  // Fetch student counts
  const { data: studentClasses } = await adminSupabase
    .from('student_classes')
    .select('class_id');

  const getTeacherName = (teacherId: string) => {
    const t = teachers?.find(t => t.id === teacherId);
    if (!t) return 'Profesor Necunoscut';
    return `${t.first_name} ${t.last_name}`;
  };

  const getStudentCount = (classId: string) => {
    return studentClasses?.filter(sc => sc.class_id === classId).length || 0;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-end">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Gestiune Clase</h1>
          <p className="text-slate-400">Vizualizare globală a tuturor claselor create de profesori.</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl flex items-center gap-3">
          <School className="w-5 h-5 text-emerald-400" />
          <span className="text-emerald-300 font-semibold">{classes?.length || 0} Total</span>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-black/20">
                <th className="p-4 text-sm font-semibold text-slate-300">Nume Clasă</th>
                <th className="p-4 text-sm font-semibold text-slate-300">Profesor</th>
                <th className="p-4 text-sm font-semibold text-slate-300">Cod Înscriere</th>
                <th className="p-4 text-sm font-semibold text-slate-300">Elevi</th>
                <th className="p-4 text-sm font-semibold text-slate-300">Creată la</th>
                <th className="p-4 text-sm font-semibold text-slate-300 text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {classes && classes.length > 0 ? (
                classes.map((cls) => (
                  <tr key={cls.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="font-medium text-slate-200">{cls.name}</div>
                    </td>
                    <td className="p-4 text-slate-300">
                      {getTeacherName(cls.teacher_id)}
                    </td>
                    <td className="p-4">
                      <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-emerald-400 font-mono text-sm inline-flex items-center gap-2">
                        <Key className="w-3 h-3" />
                        {cls.code}
                      </span>
                    </td>
                    <td className="p-4 text-slate-300">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-400" />
                        {getStudentCount(cls.id)}
                      </div>
                    </td>
                    <td className="p-4 text-slate-400 text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      {formatDate(cls.created_at)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link 
                          href={`/dashboard/admin/classes/${cls.id}`} 
                          className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold text-white hover:bg-white/10 transition-colors"
                        >
                          Vezi
                        </Link>
                        <DeleteClassButton classId={cls.id} classNameStr={cls.name} />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Nu s-a creat nicio clasă pe platformă.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
