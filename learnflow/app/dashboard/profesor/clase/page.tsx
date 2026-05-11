'use client';

import React from 'react';
import { Users, UserPlus, BookOpen, ChevronRight } from 'lucide-react';

export default function ClasePage() {
  const classes = [
    { id: 1, name: 'Clasa 10A', students: 25, lastActive: 'Azi, 10:00', averageScore: 8.5 },
    { id: 2, name: 'Clasa 10B', students: 28, lastActive: 'Ieri, 14:30', averageScore: 7.2 },
    { id: 3, name: 'Clasa 11A', students: 22, lastActive: 'Luni, 09:15', averageScore: 9.1 },
    { id: 4, name: 'Clasa 12C', students: 30, lastActive: 'Marți, 11:45', averageScore: 8.8 },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-end">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Clase și Elevi</h1>
          <p className="text-slate-400">Gestionează elevii și urmărește progresul pe clase.</p>
        </div>
        <button 
          onClick={() => alert("Adăugare clasă în curând...")}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold transition-all shadow-lg flex items-center gap-2"
        >
          <UserPlus className="w-5 h-5" />
          <span>Adaugă o clasă</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {classes.map((cls) => (
          <div key={cls.id} className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-6 hover:bg-white/[0.05] hover:border-purple-500/30 transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-slate-300">
                Media: {cls.averageScore}
              </span>
            </div>
            <h3 className="text-xl font-semibold text-white mb-1 group-hover:text-purple-300 transition-colors">{cls.name}</h3>
            <p className="text-sm text-slate-400 flex items-center gap-1">
              <BookOpen className="w-4 h-4" /> {cls.students} elevi
            </p>
            <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
              <span className="text-xs text-slate-500">Activ: {cls.lastActive}</span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
