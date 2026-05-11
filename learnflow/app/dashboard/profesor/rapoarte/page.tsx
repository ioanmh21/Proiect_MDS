'use client';

import React from 'react';
import { BarChart3, TrendingUp, Award, Download } from 'lucide-react';

export default function RapoartePage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-end">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Rapoarte și Analize</h1>
          <p className="text-slate-400">Analizează performanța elevilor și statisticile generale.</p>
        </div>
        <button 
          onClick={() => alert("Se descarcă raportul...")}
          className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold transition-all flex items-center gap-2"
        >
          <Download className="w-5 h-5" />
          <span>Descarcă PDF</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <BarChart3 className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <p className="text-sm text-slate-400 font-medium mb-1">Media Generală</p>
            <h2 className="text-4xl font-bold text-white">8.45</h2>
            <p className="text-sm text-emerald-400 mt-2 flex items-center gap-1 font-medium">
              <TrendingUp className="w-4 h-4" /> +0.2 față de luna trecută
            </p>
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Award className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <p className="text-sm text-slate-400 font-medium mb-1">Teste Finalizate</p>
            <h2 className="text-4xl font-bold text-white">452</h2>
            <p className="text-sm text-emerald-400 mt-2 flex items-center gap-1 font-medium">
              <TrendingUp className="w-4 h-4" /> +12% participare
            </p>
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <p className="text-sm text-slate-400 font-medium mb-1">Ore Studiu (Cumulat)</p>
            <h2 className="text-4xl font-bold text-white">1,240h</h2>
            <p className="text-sm text-emerald-400 mt-2 flex items-center gap-1 font-medium">
              <TrendingUp className="w-4 h-4" /> Elevii sunt mai activi
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-8 flex items-center justify-center min-h-[300px]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4 border border-purple-500/20">
            <BarChart3 className="w-8 h-8 text-purple-400" />
          </div>
          <h3 className="text-xl font-medium text-white">Grafice Avansate</h3>
          <p className="text-slate-400 max-w-sm mx-auto">
            Integrarea graficelor detaliate pentru prezență și performanță este în curs de dezvoltare.
          </p>
        </div>
      </div>
    </div>
  );
}
