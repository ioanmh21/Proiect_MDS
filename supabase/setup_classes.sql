-- Activăm extensia pentru UUID (în cazul în care nu e activată)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Creare tabel clase
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- RLS (Row Level Security) pentru clase
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Oricine poate vedea clasele" ON public.classes FOR SELECT USING (true);
CREATE POLICY "Profesorii pot crea clase" ON public.classes FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Profesorii își pot edita clasele" ON public.classes FOR UPDATE USING (auth.uid() = teacher_id);
CREATE POLICY "Profesorii își pot șterge clasele" ON public.classes FOR DELETE USING (auth.uid() = teacher_id);

-- 2. Creare tabel asociere (student_classes)
CREATE TABLE IF NOT EXISTS public.student_classes (
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    PRIMARY KEY (student_id, class_id)
);

-- RLS pentru student_classes
ALTER TABLE public.student_classes ENABLE ROW LEVEL SECURITY;
-- Elevul își poate vedea asocierile
CREATE POLICY "Elevul vede asocierile lui" ON public.student_classes FOR SELECT USING (auth.uid() = student_id);
-- Profesorul poate vedea asocierile pe clasele sale
CREATE POLICY "Profesorul vede elevii clasei" ON public.student_classes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.teacher_id = auth.uid()
  )
);
-- Elevul se poate înrola
CREATE POLICY "Elevul se poate inrola" ON public.student_classes FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Elevul se poate dezabona" ON public.student_classes FOR DELETE USING (auth.uid() = student_id);

-- 3. Actualizare tabel materials
-- Atenție: Dacă ai date importante în subject și grade, acestea se vor pierde. Dacă vrei să le păstrezi temporar, nu rula comenzile de DROP deocamdată.
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE;
ALTER TABLE public.materials DROP COLUMN IF EXISTS subject;
ALTER TABLE public.materials DROP COLUMN IF EXISTS grade;
ALTER TABLE public.materials DROP COLUMN IF EXISTS chapter;

-- NOTĂ: Pentru a rula asta, accesează Supabase Dashboard -> SQL Editor -> New Query, lipește tot acest cod și apasă "Run".
