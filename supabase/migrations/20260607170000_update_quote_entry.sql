-- Allow quote creators to update their blocks and replace utterances

CREATE POLICY "Creators can update their quote blocks"
ON quote_blocks FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Creators can delete utterances on their blocks"
ON utterances FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM quote_blocks b
        WHERE b.id = utterances.quote_block_id
          AND b.user_id = auth.uid()
    )
);

CREATE OR REPLACE FUNCTION public.update_quote_entry(
    p_block_id INTEGER,
    p_month TEXT,
    p_day_range TEXT,
    p_year INTEGER,
    p_lines JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    line JSONB;
    idx INTEGER := 0;
    quote_text TEXT;
    author_text TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM quote_blocks
        WHERE id = p_block_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'You do not have permission to edit this quote';
    END IF;

    IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'At least one quote line is required';
    END IF;

    UPDATE quote_blocks
    SET
        month = NULLIF(p_month, ''),
        day_range = NULLIF(p_day_range, ''),
        year = p_year
    WHERE id = p_block_id;

    DELETE FROM utterances WHERE quote_block_id = p_block_id;

    FOR line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        quote_text := NULLIF(TRIM(line->>'quote'), '');
        IF quote_text IS NULL THEN
            CONTINUE;
        END IF;

        author_text := NULLIF(TRIM(line->>'author'), '');
        IF author_text IS NULL THEN
            author_text := 'Anonymous';
        END IF;

        INSERT INTO utterances (
            quote_block_id,
            quote,
            author,
            context,
            context_position,
            line_order
        )
        VALUES (
            p_block_id,
            quote_text,
            author_text,
            NULLIF(TRIM(line->>'context'), ''),
            NULLIF(line->>'context_position', ''),
            idx
        );

        idx := idx + 1;
    END LOOP;

    IF idx = 0 THEN
        RAISE EXCEPTION 'At least one quote line is required';
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_quote_entry(INTEGER, TEXT, TEXT, INTEGER, JSONB) TO authenticated;
