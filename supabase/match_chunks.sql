-- =============================================
-- LearnFlow RAG - Funcție similarity search
-- Rulează în Supabase SQL Editor
-- NOTĂ: tabelul `chunks` există deja cu coloana `embedding` (vector)
-- =============================================

-- Funcție RPC pentru căutare semantică în chunks existente
create or replace function match_chunks(
  query_embedding  vector(768),
  match_count      int     default 5,
  filter_material_id uuid  default null,
  similarity_threshold float default 0.5
)
returns table (
  id           uuid,
  content      text,
  page_number  integer,
  similarity   float
)
language plpgsql
as $$
begin
  return query
  select
    c.id,
    c.content,
    c.page_number,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where
    (filter_material_id is null or c.material_id = filter_material_id)
    and c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) > similarity_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Index pentru performanță (dacă nu există deja)
create index if not exists chunks_embedding_idx
  on chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
