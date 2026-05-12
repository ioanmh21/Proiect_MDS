--missing code
--puneti restul de cod de la creearea bazei de date aici





--am adaugat un camp nou
ALTER TABLE materials ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;




CREATE OR REPLACE FUNCTION hybrid_search_chunks(
    query_text text,
    query_embedding vector(768),
    match_count int DEFAULT 10,
    filter_material_id uuid DEFAULT NULL,
    rrf_k int DEFAULT 60
) RETURNS TABLE (
    id uuid,
    content text,
    page_number int,
    similarity float
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH vector_search AS (
        SELECT
            c.id, c.content, c.page_number,
            ROW_NUMBER() OVER (ORDER BY c.embedding <=> query_embedding) AS rank
        FROM chunks c
        WHERE (filter_material_id IS NULL OR c.material_id = filter_material_id)
        ORDER BY c.embedding <=> query_embedding
        LIMIT match_count * 2
    ),
    text_search AS (
        SELECT
            c.id, c.content, c.page_number,
            ROW_NUMBER() OVER (ORDER BY ts_rank_cd(to_tsvector('simple', c.content), websearch_to_tsquery('simple', query_text)) DESC) AS rank
        FROM chunks c
        WHERE (filter_material_id IS NULL OR c.material_id = filter_material_id)
          AND to_tsvector('simple', c.content) @@ websearch_to_tsquery('simple', query_text)
        ORDER BY ts_rank_cd(to_tsvector('simple', c.content), websearch_to_tsquery('simple', query_text)) DESC
        LIMIT match_count * 2
    ),
    combined AS (
        SELECT
            COALESCE(v.id, t.id) AS id,
            COALESCE(v.content, t.content) AS content,
            COALESCE(v.page_number, t.page_number) AS page_number,
            COALESCE(1.0 / (v.rank + rrf_k), 0.0) + COALESCE(1.0 / (t.rank + rrf_k), 0.0) AS rrf_score
        FROM vector_search v
        FULL OUTER JOIN text_search t ON v.id = t.id
    )
    SELECT
        c.id, c.content, c.page_number, c.rrf_score::float AS similarity
    FROM combined c
    ORDER BY c.rrf_score DESC
    LIMIT match_count;
END;
$$;
