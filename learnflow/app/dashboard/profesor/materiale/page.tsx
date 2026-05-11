'use client';

import React, { useState } from 'react';
import { FileUp, FileText, Video, Search, Filter, X } from 'lucide-react';
import FileUploader from '@/components/FileUploader';
import MaterialMetadataForm from '@/components/MaterialMetadataForm';

export default function MaterialePage() {
  const [showUploader, setShowUploader] = useState(false);
  const [showMetadataForm, setShowMetadataForm] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const materials = [
    { id: 1, title: 'Curs 4: Funcții Exponențiale', type: 'PDF', date: '10 Oct 2026', size: '2.4 MB' },
    { id: 2, title: 'Rezolvare Exerciții Seminar 3', type: 'Video', date: '08 Oct 2026', size: '145 MB' },
    { id: 3, title: 'Material Suport - Geometrie', type: 'PDF', date: '05 Oct 2026', size: '1.8 MB' },
    { id: 4, title: 'Introducere în Algebră', type: 'Prezentare', date: '01 Oct 2026', size: '5.2 MB' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-end">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Materiale Didactice</h1>
          <p className="text-slate-400">Gestionează cursurile, testele și materialele video.</p>
        </div>
        <button 
          onClick={() => setShowUploader(true)}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold transition-all shadow-lg flex items-center gap-2"
        >
          <FileUp className="w-5 h-5" />
          <span>Încarcă Fișier</span>
        </button>
      </div>

      {showUploader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <FileUploader 
            onClose={() => setShowUploader(false)} 
            onUploadSuccess={(url, type, name) => {
              console.log('Upload success:', url, type, name);
              setUploadedFileUrl(url);
              setShowUploader(false);
              setShowMetadataForm(true);
            }} 
          />
        </div>
      )}

      {showMetadataForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="w-full max-w-2xl my-auto">
            <div className="relative">
              <button 
                onClick={() => setShowMetadataForm(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <MaterialMetadataForm 
                fileUrl={uploadedFileUrl} 
                onSuccess={() => {
                  setTimeout(() => {
                    setShowMetadataForm(false);
                  }, 2000);
                }} 
              />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/[0.02]">
          <div className="relative w-full sm:w-96">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Caută materiale..." 
              className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50 focus:bg-black/40 transition-all text-white placeholder-slate-500"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors w-full sm:w-auto justify-center">
            <Filter className="w-4 h-4" />
            <span>Filtrează</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 text-sm">
                <th className="p-4 font-medium">Nume Material</th>
                <th className="p-4 font-medium hidden sm:table-cell">Tip</th>
                <th className="p-4 font-medium hidden md:table-cell">Mărime</th>
                <th className="p-4 font-medium">Data Încărcării</th>
                <th className="p-4 font-medium text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {materials.map((mat) => (
                <tr key={mat.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                        {mat.type === 'Video' ? <Video className="w-5 h-5 text-fuchsia-400" /> : <FileText className="w-5 h-5 text-blue-400" />}
                      </div>
                      <span className="font-medium text-slate-200 group-hover:text-emerald-300 transition-colors">{mat.title}</span>
                    </div>
                  </td>
                  <td className="p-4 hidden sm:table-cell text-slate-400 text-sm">{mat.type}</td>
                  <td className="p-4 hidden md:table-cell text-slate-400 text-sm">{mat.size}</td>
                  <td className="p-4 text-slate-400 text-sm">{mat.date}</td>
                  <td className="p-4 text-right">
                    <button className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors">Editează</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
