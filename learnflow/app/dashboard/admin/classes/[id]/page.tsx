import React from 'react';
import { Users, Key, Clock, ArrowLeft } from 'lucide-react';
import { createClient as createBaseClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { DeleteUserButton } from '../../DeleteUserButton';

export const dynamic = 'force-dynamic';

export default async function AdminClassDetailsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const classId = params.id;

  const adminSupabase = createBaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_KEY!
  );

  // Fetch class details
  const { data: classDetails } = await adminSupabase
    .from('classes')
    .select('*')
    .eq('id', classId)
    .single();

  if (!classDetails) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl text-red-400">Clasa nu a fost găsită.</h1>
        <Link href="/dashboard/admin/classes" className="text-blue-400 mt-4 block">Înapoi la clase</Link>
      </div>
    );
  }

  // Fetch teacher
  const { data: teacher } = await adminSupabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', classDetails.teacher_id)
    .single();

  // Fetch students
  const { data: studentLinks } = await adminSupabase
    .from('student_classes')
    .select('student_id, joined_at')
    .eq('class_id', classId);

  const studentIds = studentLinks?.map(s => s.student_id) || [];
  
  const { data: studentProfiles } = await adminSupabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', studentIds.length > 0 ? studentIds : ['empty']);

  const students = studentLinks?.map(link => {
    const profile = studentProfiles?.find(p => p.id === link.student_id);
    return {
      id: link.student_id,
      name: profile ? `${profile.first_name} ${profile.last_name}` : 'Necunoscut',
      joined_at: link.joined_at
    };
  }) || [];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex items-center gap-4">
        <Link 
          href="/dashboard/admin/classes"
          className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">{classDetails.name}</h1>
          <p className="text-slate-400">Profesor: {teacher ? `${teacher.first_name} ${teacher.last_name}` : 'Necunoscut'}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400 mb-1">Cod de acces clasă</p>
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-emerald-400" />
              <span className="text-2xl font-mono font-bold tracking-wider text-emerald-400">
                {classDetails.code}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
            <Users className="w-7 h-7 text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-slate-400 mb-1">Total Elevi Înscriși</p>
            <p className="text-3xl font-bold text-white">{students.length}</p>
          </div>
        </div>
      </div>

      <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          Lista Elevilor
        </h2>
        
        {students.length === 0 ? (
          <div className="text-center py-12 text-slate-400 border border-dashed border-white/10 rounded-xl">
            <p>Niciun elev nu s-a înscris în această clasă.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {students.map(student => (
              <div key={student.id} className="flex items-center justify-between p-4 bg-black/20 border border-white/5 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center font-medium text-slate-300">
                    {student.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-200">{student.name}</h3>
                    <p className="text-xs text-slate-500">S-a alăturat la: {new Date(student.joined_at).toLocaleDateString()}</p>
                  </div>
                </div>
                
                {/* Putem folosi același DeleteUserButton pentru a șterge complet user-ul, sau am putea face un buton dedicat pentru unenroll. Cerința era ca admin-ul să poată șterge conturi. */}
                <DeleteUserButton userId={student.id} userName={student.name} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
