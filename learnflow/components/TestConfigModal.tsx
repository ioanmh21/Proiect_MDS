import React, { useState } from 'react';
import { X, Settings, Loader2 } from 'lucide-react';

interface TestConfig {
  easy: number;
  medium: number;
  hard: number;
}

interface TestConfigModalProps {
  materialId: string;
  materialTitle: string;
  initialConfig?: TestConfig;
  onClose: () => void;
  onSuccess: (newConfig: TestConfig) => void;
}

export default function TestConfigModal({ materialId, materialTitle, initialConfig, onClose, onSuccess }: TestConfigModalProps) {
  const [easy, setEasy] = useState(initialConfig?.easy ?? 3);
  const [medium, setMedium] = useState(initialConfig?.medium ?? 2);
  const [hard, setHard] = useState(initialConfig?.hard ?? 1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    const newConfig = { easy, medium, hard };
    
    // Validare simplă
    if (easy + medium + hard === 0) {
      setError('Testul trebuie să aibă cel puțin o întrebare.');
      setIsSaving(false);
      return;
    }
    if (easy < 0 || medium < 0 || hard < 0) {
      setError('Nu poți seta un număr negativ de întrebări.');
      setIsSaving(false);
      return;
    }
    if (easy + medium + hard > 30) {
      setError('Pentru a nu supraîncărca asistentul AI, te rugăm să limitezi testul la maxim 30 de întrebări.');
      setIsSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/materials/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId, testConfig: newConfig })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Eroare la salvare');
      }

      onSuccess(newConfig);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-md relative overflow-hidden animate-in fade-in zoom-in-95">
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Setări Evaluare</h2>
          <p className="text-sm text-slate-400 truncate max-w-[250px]">{materialTitle}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4 bg-black/20 p-4 rounded-xl border border-white/5">
          <p className="text-sm text-slate-300 font-medium mb-2">Configurează numărul de întrebări generate de AI:</p>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-white font-medium block">Ușoare</label>
              <span className="text-xs text-slate-400">Tip: Grilă (4 opțiuni)</span>
            </div>
            <input 
              type="number" 
              min="0" max="20"
              value={easy}
              onChange={(e) => setEasy(parseInt(e.target.value) || 0)}
              className="w-20 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-center text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-white font-medium block">Medii</label>
              <span className="text-xs text-slate-400">Tip: Grilă (4 opțiuni)</span>
            </div>
            <input 
              type="number" 
              min="0" max="20"
              value={medium}
              onChange={(e) => setMedium(parseInt(e.target.value) || 0)}
              className="w-20 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-center text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-white font-medium block">Grele</label>
              <span className="text-xs text-slate-400">Tip: Răspuns Scris</span>
            </div>
            <input 
              type="number" 
              min="0" max="10"
              value={hard}
              onChange={(e) => setHard(parseInt(e.target.value) || 0)}
              className="w-20 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-center text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="pt-2">
          <p className="text-xs text-slate-500 text-center mb-4">
            Total: <strong className="text-emerald-400">{easy + medium + hard} întrebări</strong>
          </p>
          <button 
            type="submit" 
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvează Configurația'}
          </button>
        </div>
      </form>
    </div>
  );
}
