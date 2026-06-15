import React from 'react';
import { Users, Shield, GraduationCap, Clock, BookOpen, Trash2 } from 'lucide-react';
import { cookies } from 'next/headers';
import { createClient as createBaseClient } from '@supabase/supabase-js';
import { DeleteUserButton } from './DeleteUserButton';

export default async function AdminDashboardPage() {
  const adminSupabase = createBaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  // Fetch all users (bypassing RLS)
  const { data: users } = await adminSupabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  // Fetch classes logic
  const { data: teacherClasses } = await adminSupabase
    .from('classes')
    .select('id, name, teacher_id');

  const { data: studentClasses } = await adminSupabase
    .from('student_classes')
    .select('student_id, class_id');

  const getUserClasses = (user: any) => {
    if (user.role === 'teacher') {
      const myClasses = teacherClasses?.filter(c => c.teacher_id === user.id) || [];
      return myClasses.map(c => c.name).join(', ') || 'Nicio clasă';
    }
    if (user.role === 'student') {
      const myLinks = studentClasses?.filter(link => link.student_id === user.id) || [];
      const myClassIds = myLinks.map(link => link.class_id);
      const myClasses = teacherClasses?.filter(c => myClassIds.includes(c.id)) || [];
      return myClasses.map(c => c.name).join(', ') || 'Neînrolat';
    }
    return '-';
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-semibold flex items-center gap-1 w-fit"><Shield className="w-3 h-3" /> Admin</span>;
      case 'teacher':
        return <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-semibold flex items-center gap-1 w-fit"><BookOpen className="w-3 h-3" /> Profesor</span>;
      case 'student':
        return <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-semibold flex items-center gap-1 w-fit"><GraduationCap className="w-3 h-3" /> Elev</span>;
      default:
        return <span className="px-3 py-1 bg-slate-500/20 text-slate-400 rounded-full text-xs font-semibold w-fit">{role}</span>;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-end">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Gestiune Utilizatori</h1>
          <p className="text-slate-400">Vizualizare de ansamblu a tuturor conturilor înregistrate pe platformă.</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl flex items-center gap-3">
          <Users className="w-5 h-5 text-emerald-400" />
          <span className="text-emerald-300 font-semibold">{users?.length || 0} Total</span>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-black/20">
                <th className="p-4 text-sm font-semibold text-slate-300">Nume Complet</th>
                <th className="p-4 text-sm font-semibold text-slate-300">Rol</th>
                <th className="p-4 text-sm font-semibold text-slate-300">Clasă (opțional)</th>
                <th className="p-4 text-sm font-semibold text-slate-300">Data Înregistrării</th>
                <th className="p-4 text-sm font-semibold text-slate-300 text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users && users.length > 0 ? (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center font-bold text-xs text-white shadow-sm border border-white/10">
                          {(user.first_name?.[0] || '')}{(user.last_name?.[0] || '')}
                        </div>
                        <div className="font-medium text-slate-200">
                          {user.first_name} {user.last_name}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">{getRoleBadge(user.role)}</td>
                    <td className="p-4 text-slate-400 text-sm">{getUserClasses(user)}</td>
                    <td className="p-4 text-slate-400 text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      {formatDate(user.created_at)}
                    </td>
                    <td className="p-4 text-right">
                      <DeleteUserButton userId={user.id} userName={`${user.first_name} ${user.last_name}`} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    Nu s-au găsit utilizatori.
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
