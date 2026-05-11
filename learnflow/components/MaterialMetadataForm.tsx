'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CheckCircle2, Loader2, AlertCircle, BookOpen } from 'lucide-react';

const formSchema = z.object({
  title: z.string().min(3, { message: 'Titlul trebuie să aibă cel puțin 3 caractere.' }),
  subject: z.enum([
    'Matematică', 'Fizică', 'Chimie', 'Biologie', 'Informatică',
    'Istorie', 'Geografie', 'Română', 'Engleză'
  ], { error: 'Te rugăm să selectezi o materie.' }),
  grade: z.string().refine((val) => {
    const num = parseInt(val, 10);
    return num >= 1 && num <= 12;
  }, { message: 'Clasa trebuie să fie între 1 și 12.' }),
  chapter: z.string().min(2, { message: 'Capitolul trebuie să aibă cel puțin 2 caractere.' }),
  description: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

/** Datele unui material existent, folosite pentru pre-popularea formularului în edit mode */
export interface MaterialInitialData {
  id: string;
  title: string;
  subject: string | null;
  grade: number | null;
  chapter: string | null;
  description: string | null;
}

export default function MaterialMetadataForm({ 
  fileUrl, 
  onSuccess,
  initialData,
}: { 
  fileUrl?: string;
  onSuccess?: () => void;
  /** Dacă este furnizat, formularul intră în edit mode și pre-populează câmpurile */
  initialData?: MaterialInitialData;
}) {
  const isEditMode = !!initialData;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData
      ? {
          title: initialData.title,
          subject: (initialData.subject as FormData['subject']) || undefined,
          grade: initialData.grade?.toString() || '',
          chapter: initialData.chapter || '',
          description: initialData.description || '',
        }
      : undefined,
  });

  // Resetăm formularul când initialData se schimbă (ex: click pe alt material)
  useEffect(() => {
    if (initialData) {
      reset({
        title: initialData.title,
        subject: (initialData.subject as FormData['subject']) || undefined,
        grade: initialData.grade?.toString() || '',
        chapter: initialData.chapter || '',
        description: initialData.description || '',
      });
    }
  }, [initialData, reset]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      if (isEditMode) {
        // ── EDIT MODE: PATCH /api/materials ──
        const response = await fetch('/api/materials', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: initialData.id,
            title: data.title,
            subject: data.subject,
            grade: parseInt(data.grade, 10),
            chapter: data.chapter,
            description: data.description || null,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Eroare la actualizarea materialului.');
        }
      } else {
        // ── CREATE MODE: POST /api/materials ──
        const response = await fetch('/api/materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: data.title,
            subject: data.subject,
            grade: parseInt(data.grade, 10),
            chapter: data.chapter,
            description: data.description || null,
            fileUrl: fileUrl || '',
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Eroare la procesarea materialului.');
        }

        const { materialId } = await response.json();

        // Trigger the ingestion background job
        const ingestResponse = await fetch('/api/materials/ingest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ materialId }),
        });

        if (!ingestResponse.ok) {
          const errorData = await ingestResponse.json();
          throw new Error(errorData.error || 'Eroare la pornirea procesării materialului.');
        }
      }

      setSubmitStatus('success');
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 1500);
      
    } catch (error: unknown) {
      setSubmitStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'A apărut o eroare necunoscută.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitStatus === 'success') {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl animate-in zoom-in-95 duration-300">
        <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">
          {isEditMode ? 'Material Actualizat cu Succes!' : 'Material Procesat cu Succes!'}
        </h3>
        <p className="text-emerald-200/80 text-center text-sm">
          {isEditMode
            ? 'Modificările au fost salvate.'
            : 'Detaliile au fost salvate și materialul a fost adăugat în sistem.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-purple-500/10 rounded-xl">
          <BookOpen className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">
            {isEditMode ? 'Editează Material Educațional' : 'Detalii Material Educațional'}
          </h2>
          <p className="text-sm text-slate-400">
            {isEditMode
              ? 'Modifică informațiile materialului.'
              : 'Completează informațiile pentru a salva materialul.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Titlu Material
          </label>
          <input
            {...register('title')}
            className={`w-full bg-black/20 border rounded-xl px-4 py-2.5 text-sm transition-all focus:outline-none text-white placeholder-slate-500 ${
              errors.title ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-purple-500/50 focus:bg-black/40'
            }`}
            placeholder="Ex: Rezolvare ecuații de gradul 2"
          />
          {errors.title && (
            <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" /> {errors.title.message}
            </p>
          )}
        </div>

        {/* Subject & Grade */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Materie
            </label>
            <select
              {...register('subject')}
              defaultValue=""
              className={`w-full bg-black/20 border rounded-xl px-4 py-2.5 text-sm transition-all focus:outline-none text-white ${
                errors.subject ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-purple-500/50 focus:bg-black/40'
              }`}
            >
              <option value="" disabled>Selectează materia...</option>
              <option value="Matematică">Matematică</option>
              <option value="Fizică">Fizică</option>
              <option value="Chimie">Chimie</option>
              <option value="Biologie">Biologie</option>
              <option value="Informatică">Informatică</option>
              <option value="Istorie">Istorie</option>
              <option value="Geografie">Geografie</option>
              <option value="Română">Română</option>
              <option value="Engleză">Engleză</option>
            </select>
            {errors.subject && (
              <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> {errors.subject.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Clasa
            </label>
            <select
              {...register('grade')}
              defaultValue=""
              className={`w-full bg-black/20 border rounded-xl px-4 py-2.5 text-sm transition-all focus:outline-none text-white ${
                errors.grade ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-purple-500/50 focus:bg-black/40'
              }`}
            >
              <option value="" disabled>Selectează clasa...</option>
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>Clasa a {i + 1}-a</option>
              ))}
            </select>
            {errors.grade && (
              <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> {errors.grade.message}
              </p>
            )}
          </div>
        </div>

        {/* Chapter */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Capitol / Unitate de învățare
          </label>
          <input
            {...register('chapter')}
            className={`w-full bg-black/20 border rounded-xl px-4 py-2.5 text-sm transition-all focus:outline-none text-white placeholder-slate-500 ${
              errors.chapter ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-purple-500/50 focus:bg-black/40'
            }`}
            placeholder="Ex: Algebră - Polinoame"
          />
          {errors.chapter && (
            <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" /> {errors.chapter.message}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Descriere (Opțional)
          </label>
          <textarea
            {...register('description')}
            rows={3}
            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm transition-all focus:outline-none focus:border-purple-500/50 focus:bg-black/40 text-white placeholder-slate-500 resize-none"
            placeholder="Adaugă detalii suplimentare despre acest material..."
          />
        </div>

        {/* Error Alert */}
        {submitStatus === 'error' && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{errorMessage}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-semibold transition-all shadow-lg flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {isEditMode ? 'Se actualizează...' : 'Se procesează...'}
            </>
          ) : (
            isEditMode ? 'Actualizează Materialul' : 'Salvează Materialul'
          )}
        </button>
      </form>
    </div>
  );
}
