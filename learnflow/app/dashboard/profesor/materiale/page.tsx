'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FileUp, FileText, Video, Search, Filter, X, Loader2, BookX, Pencil, Trash2, Settings } from 'lucide-react';
import FileUploader from '@/components/FileUploader';
import MaterialMetadataForm from '@/components/MaterialMetadataForm';
import TestConfigModal from '@/components/TestConfigModal';
import type { MaterialInitialData } from '@/components/MaterialMetadataForm';

interface MaterialFromDB {
  id: string;
  title: string;
  description: string | null;
  type: 'pdf' | 'video' | 'text';
  file_url: string;
  status: string;
  class_name: string | null;
  subject: string | null;
  grade: number | null;
  chapter: string | null;
  created_at: string;
  test_config: { easy: number; medium: number; hard: number };
}

export default function MaterialePage() {
  const [showUploader, setShowUploader] = useState(false);
  const [showMetadataForm, setShowMetadataForm] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const [editingMaterial, setEditingMaterial] = useState<MaterialInitialData | null>(null);
  const [materials, setMaterials] = useState<MaterialFromDB[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [configuringMaterial, setConfiguringMaterial] = useState<MaterialFromDB | null>(null);

  // ── Fetch materials din DB ───────────────────────────────────────
  const fetchMaterials = useCallback(async () => {
    try {
      const response = await fetch('/api/materials');
      if (!response.ok) throw new Error('Eroare la încărcarea materialelor');
      const data = await response.json();
      setMaterials(data.materials || []);
    } catch (error) {
      console.error('Eroare fetch materials:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  // ── Handler „Editează" ───────────────────────────────────────────
  const handleEdit = (mat: MaterialFromDB) => {
    setEditingMaterial({
      id: mat.id,
      title: mat.title,
      class_id: null,
      description: mat.description,
    });
    setShowMetadataForm(true);
  };

  // ── Handler succes (creare sau editare) ──────────────────────────
  const handleFormSuccess = () => {
    setTimeout(() => {
      setShowMetadataForm(false);
      setEditingMaterial(null);
      setUploadedFileUrl('');
      fetchMaterials(); // Refresh lista
    }, 1500);
  };

  // ── Handler „Șterge" (Soft Delete) ───────────────────────────────
  const handleDelete = async (matId: string) => {
    const confirm = window.confirm(
      "Ești sigur că vrei să ștergi acest material? Fișierul și indexările vor fi șterse, dar istoricul testelor se va păstra."
    );
    if (!confirm) return;

    setIsDeleting(matId);
    try {
      const res = await fetch(`/api/materials?id=${matId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Scoate materialul din listă instantaneu pentru utilizator
        setMaterials((prev) => prev.filter((m) => m.id !== matId));
      } else {
        let errorMessage = 'Eroare necunoscută';
        try {
          const data = await res.json();
          errorMessage = data.error || errorMessage;
        } catch (e) {
          errorMessage = `Eroare server (${res.status}): API-ul nu a returnat JSON valid.`;
        }
        alert(`Eroare la ștergere: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Eroare request ștergere:', error);
      alert('A apărut o eroare neașteptată.');
    } finally {
      setIsDeleting(null);
    }
  };

  // ── Formatare dată ───────────────────────────────────────────────
  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // ── Determinare tip afișat ───────────────────────────────────────
  const getDisplayType = (mat: MaterialFromDB) => {
    if (mat.type === 'video') return 'Video';
    if (mat.type === 'pdf') return 'PDF';
    return 'Document';
  };

  // ── Filtrare materiale după căutare ──────────────────────────────
  const filteredMaterials = materials.filter((mat) =>
    mat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (mat.subject && mat.subject.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (mat.chapter && mat.chapter.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-end">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Materiale Didactice</h1>
          <p className="text-slate-400">Gestionează cursurile, testele și materialele video.</p>
        </div>
        <button
          onClick={() => {
            setEditingMaterial(null);
            setShowUploader(true);
          }}
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
                onClick={() => {
                  setShowMetadataForm(false);
                  setEditingMaterial(null);
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <MaterialMetadataForm
                fileUrl={uploadedFileUrl}
                initialData={editingMaterial || undefined}
                onSuccess={handleFormSuccess}
              />
            </div>
          </div>
        </div>
      )}

      {configuringMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <TestConfigModal
            materialId={configuringMaterial.id}
            materialTitle={configuringMaterial.title}
            initialConfig={configuringMaterial.test_config}
            onClose={() => setConfiguringMaterial(null)}
            onSuccess={(newConfig) => {
              // Update local state without full reload
              setMaterials(prev => prev.map(m => m.id === configuringMaterial.id ? { ...m, test_config: newConfig } : m));
              setConfiguringMaterial(null);
            }}
          />
        </div>
      )}

      <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/[0.02]">
          <div className="relative w-full sm:w-96">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Caută materiale..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50 focus:bg-black/40 transition-all text-white placeholder-slate-500"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors w-full sm:w-auto justify-center">
            <Filter className="w-4 h-4" />
            <span>Filtrează</span>
          </button>
        </div>

        {/* ── Loading State ──────────────────────────────────────── */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-slate-400 text-sm">Se încarcă materialele...</p>
          </div>
        )}

        {/* ── Empty State ────────────────────────────────────────── */}
        {!isLoading && filteredMaterials.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="p-4 bg-white/5 rounded-full">
              <BookX className="w-10 h-10 text-slate-500" />
            </div>
            <div className="text-center">
              <p className="text-slate-300 font-medium mb-1">
                {searchQuery ? 'Niciun rezultat găsit' : 'Niciun material încărcat'}
              </p>
              <p className="text-slate-500 text-sm">
                {searchQuery
                  ? 'Încearcă un alt termen de căutare.'
                  : 'Încarcă primul tău material didactic apăsând butonul de mai sus.'}
              </p>
            </div>
          </div>
        )}

        {/* ── Table ──────────────────────────────────────────────── */}
        {!isLoading && filteredMaterials.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-sm">
                  <th className="p-4 font-medium">Nume Material</th>
                  <th className="p-4 font-medium hidden sm:table-cell">Tip</th>
                  <th className="p-4 font-medium hidden md:table-cell">Materie</th>
                  <th className="p-4 font-medium">Data Încărcării</th>
                  <th className="p-4 font-medium text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredMaterials.map((mat) => (
                  <tr key={mat.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                          {mat.type === 'video' ? <Video className="w-5 h-5 text-fuchsia-400" /> : <FileText className="w-5 h-5 text-blue-400" />}
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-slate-200 group-hover:text-emerald-300 transition-colors block truncate">{mat.title}</span>
                          {mat.chapter && (
                            <span className="text-xs text-slate-500 block truncate">{mat.chapter}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 hidden sm:table-cell text-slate-400 text-sm">{getDisplayType(mat)}</td>
                    <td className="p-4 hidden md:table-cell text-slate-400 text-sm">
                      {mat.subject || '—'}
                      {mat.grade && <span className="text-slate-500 ml-1">· Clasa {mat.grade}</span>}
                    </td>
                    <td className="p-4 text-slate-400 text-sm">{formatDate(mat.created_at)}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-4">
                        <button
                          onClick={() => setConfiguringMaterial(mat)}
                          className="text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors inline-flex items-center gap-1.5"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          Setări Test
                        </button>
                        <button
                          onClick={() => handleEdit(mat)}
                          className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors inline-flex items-center gap-1.5"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Editează
                        </button>
                        <button
                          onClick={() => handleDelete(mat.id)}
                          disabled={isDeleting === mat.id}
                          className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDeleting === mat.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          {isDeleting === mat.id ? "Se șterge..." : "Șterge"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
