'use client';

import React, { useState, useEffect } from 'react';
import { Users, Plus, Key, Copy, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface ClassItem {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export default function GestioneazaClase() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchClasses();
  }, []);

  async function fetchClasses() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/classes');
      if (res.ok) {
        const data = await res.json();
        setClasses(data.classes || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    if (newClassName.length < 3) {
      setError('Numele trebuie să aibă minim 3 caractere.');
      return;
    }
    
    setIsCreating(true);
    setError('');

    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClassName })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Eroare la creare');
      }

      const data = await res.json();
      setClasses([data.class, ...classes]);
      setNewClassName('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto p-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Clasele mele</h1>
        <p className="text-slate-400">Gestionează clasele și generează coduri de acces pentru elevi.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Create Class Form */}
        <div className="lg:col-span-1">
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-md">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-400" />
              Creează Clasă
            </h2>
            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Nume Clasă</label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Ex: Matematică Avansată - 11A"
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm transition-all focus:outline-none focus:border-purple-500/50 text-white placeholder-slate-500"
                />
              </div>
              
              {error && (
                <div className="text-red-400 text-sm flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isCreating || newClassName.length < 3}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Generează Clasă'}
              </button>
            </form>
          </div>
        </div>

        {/* Classes List */}
        <div className="lg:col-span-2">
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-md min-h-[400px]">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Clase Active
            </h2>

            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
              </div>
            ) : classes.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Users className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-50" />
                <p>Nu ai creat nicio clasă încă.</p>
                <p className="text-sm">Folosește formularul pentru a crea prima ta clasă!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classes.map((cls) => (
                  <div key={cls.id} className="bg-black/20 border border-white/5 rounded-xl p-5 hover:bg-white/[0.02] transition-colors group">
                    <h3 className="font-semibold text-lg text-white mb-1 truncate" title={cls.name}>
                      {cls.name}
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Creată pe: {new Date(cls.created_at).toLocaleDateString()}
                    </p>

                    <div className="bg-white/[0.05] rounded-lg p-3 border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-emerald-400" />
                        <span className="text-lg font-mono font-bold tracking-wider text-emerald-400">
                          {cls.code}
                        </span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(cls.code)}
                        className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-slate-400 hover:text-white"
                        title="Copiază codul"
                      >
                        {copiedCode === cls.code ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="mt-4">
                      <a 
                        href={`/dashboard/profesor/clase/${cls.id}`} 
                        className="text-sm font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                      >
                        Vezi elevii și detaliile <Users className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
