-- Rename a speaker across all quotes in a quotebook

CREATE OR REPLACE FUNCTION public.rename_speaker_in_quotebook(
    p_quotebook_id INTEGER,
    p_old_name TEXT,
    p_new_name TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    p_old_name := TRIM(p_old_name);
    p_new_name := TRIM(p_new_name);

    IF p_old_name = '' OR p_new_name = '' THEN
        RAISE EXCEPTION 'Speaker names cannot be empty';
    END IF;

    IF p_old_name = p_new_name THEN
        RETURN 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM quotebooks q
        LEFT JOIN quotebook_permissions p
            ON p.quotebook_id = q.id AND p.user_id = auth.uid()
        WHERE q.id = p_quotebook_id
          AND (
              q.created_by = auth.uid()
              OR p.role = 'admin'
          )
    ) THEN
        RAISE EXCEPTION 'You do not have permission to rename speakers';
    END IF;

    UPDATE utterances u
    SET author = p_new_name
    FROM quote_blocks b
    WHERE u.quote_block_id = b.id
      AND b.quotebook_id = p_quotebook_id
      AND u.author = p_old_name;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rename_speaker_in_quotebook(INTEGER, TEXT, TEXT) TO authenticated;
