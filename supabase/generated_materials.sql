-- =============================================
-- LearnFlow — Tabele pentru materialele generate de AI
-- Rulează în Supabase SQL Editor (în ordine)
-- =============================================

-- ─────────────────────────────────────────────
-- 1. Coloane noi pe tabela `materials`
--    rezumatul + notițele sunt proprietăți ale materialului
-- ─────────────────────────────────────────────

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS subject  text,
  ADD COLUMN IF NOT EXISTS grade    integer,
  ADD COLUMN IF NOT EXISTS chapter  text,
  ADD COLUMN IF NOT EXISTS summary  jsonb,
  ADD COLUMN IF NOT EXISTS notes    jsonb;

COMMENT ON COLUMN materials.summary IS 'Rezumat generat AI: { introducere, capitole[] }';
COMMENT ON COLUMN materials.notes   IS 'Notițe generate AI: array de bullet-point strings';

-- ─────────────────────────────────────────────
-- 2. Tabela `flashcards`
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS flashcards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id   uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  termen        text NOT NULL,
  definitie     text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flashcards_material ON flashcards(material_id);

ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers see own flashcards"
  ON flashcards FOR SELECT
  USING (
    material_id IN (SELECT id FROM materials WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Students see class flashcards"
  ON flashcards FOR SELECT
  USING (
    material_id IN (
      SELECT m.id FROM materials m
      JOIN profiles p ON p.id = auth.uid()
      WHERE m.class_name = p.class_name
    )
  );

-- ─────────────────────────────────────────────
-- 3. Tabela `quiz_questions`
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quiz_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id   uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  text          text NOT NULL,
  raspuns       text NOT NULL,
  dificultate   text NOT NULL CHECK (dificultate IN ('usor','mediu','greu')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_material ON quiz_questions(material_id);

ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers see own quiz_questions"
  ON quiz_questions FOR SELECT
  USING (
    material_id IN (SELECT id FROM materials WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Students see class quiz_questions"
  ON quiz_questions FOR SELECT
  USING (
    material_id IN (
      SELECT m.id FROM materials m
      JOIN profiles p ON p.id = auth.uid()
      WHERE m.class_name = p.class_name
    )
  );

-- ─────────────────────────────────────────────
-- 4. Tabela `lesson_plans`
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lesson_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id   uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  durata_min    integer NOT NULL CHECK (durata_min > 0),
  etape         jsonb NOT NULL,    -- array de { titlu, descriere, durata_min }
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Un singur plan per material
  UNIQUE (material_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_plans_material ON lesson_plans(material_id);

ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers see own lesson_plans"
  ON lesson_plans FOR SELECT
  USING (
    material_id IN (SELECT id FROM materials WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Students see class lesson_plans"
  ON lesson_plans FOR SELECT
  USING (
    material_id IN (
      SELECT m.id FROM materials m
      JOIN profiles p ON p.id = auth.uid()
      WHERE m.class_name = p.class_name
    )
  );

-- ─────────────────────────────────────────────
-- 5. Funcția RPC tranzacțională
--    Salvează TOATE materialele generate atomic.
--    Dacă orice pas eșuează, totul face rollback.
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION save_generated_materials(
  p_material_id   uuid,
  p_summary       jsonb,
  p_notes         jsonb,
  p_flashcards    jsonb,    -- array de { termen, definitie }
  p_quiz          jsonb,    -- array de { text, raspuns, dificultate }
  p_lesson_plan   jsonb     -- { durata_min, etape[] }
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_fc_count    integer;
  v_qq_count    integer;
  v_lp_id       uuid;
BEGIN
  -- ── 1. Actualizează rezumat + notițe pe materials ──────────────
  UPDATE materials
  SET summary = p_summary,
      notes   = p_notes
  WHERE id = p_material_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material % nu există', p_material_id;
  END IF;

  -- ── 2. Șterge date vechi (permite regenerare) ─────────────────
  DELETE FROM flashcards    WHERE material_id = p_material_id;
  DELETE FROM quiz_questions WHERE material_id = p_material_id;
  DELETE FROM lesson_plans  WHERE material_id = p_material_id;

  -- ── 3. Inserează flashcards ───────────────────────────────────
  INSERT INTO flashcards (material_id, termen, definitie)
  SELECT p_material_id,
         fc->>'termen',
         fc->>'definitie'
  FROM jsonb_array_elements(p_flashcards) AS fc;

  GET DIAGNOSTICS v_fc_count = ROW_COUNT;

  -- ── 4. Inserează quiz_questions ───────────────────────────────
  INSERT INTO quiz_questions (material_id, text, raspuns, dificultate)
  SELECT p_material_id,
         qq->>'text',
         qq->>'raspuns',
         qq->>'dificultate'
  FROM jsonb_array_elements(p_quiz) AS qq;

  GET DIAGNOSTICS v_qq_count = ROW_COUNT;

  -- ── 5. Inserează lesson_plan ──────────────────────────────────
  INSERT INTO lesson_plans (material_id, durata_min, etape)
  VALUES (
    p_material_id,
    (p_lesson_plan->>'durata_min')::integer,
    p_lesson_plan->'etape'
  )
  RETURNING id INTO v_lp_id;

  -- ── 6. Returnează raport ──────────────────────────────────────
  RETURN jsonb_build_object(
    'success',         true,
    'flashcards_count', v_fc_count,
    'quiz_count',       v_qq_count,
    'lesson_plan_id',   v_lp_id
  );
END;
$$;
