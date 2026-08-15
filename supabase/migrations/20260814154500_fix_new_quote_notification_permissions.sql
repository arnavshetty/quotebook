-- add_quote_entry (SECURITY INVOKER) cannot call create_new_quote_notifications
-- after EXECUTE was revoked from authenticated. Fire notifications from a trigger.

CREATE OR REPLACE FUNCTION public.trigger_create_new_quote_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.user_notifications n
        WHERE n.quote_block_id = NEW.quote_block_id
    ) THEN
        PERFORM public.create_new_quote_notifications(NEW.quote_block_id);
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trigger_create_new_quote_notifications()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS create_new_quote_notifications_on_utterance ON public.utterances;

CREATE TRIGGER create_new_quote_notifications_on_utterance
    AFTER INSERT ON public.utterances
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_create_new_quote_notifications();

CREATE OR REPLACE FUNCTION public.add_quote_entry(
    p_quotebook_id INTEGER,
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
    block_id INTEGER;
    line JSONB;
    idx INTEGER := 0;
    quote_text TEXT;
    author_text TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM quotebooks q
        LEFT JOIN quotebook_permissions p
            ON q.id = p.quotebook_id AND p.user_id = auth.uid()
        WHERE q.id = p_quotebook_id
          AND (
              q.created_by = auth.uid()
              OR (p.user_id = auth.uid() AND p.role IN ('contributor', 'admin'))
          )
    ) THEN
        RAISE EXCEPTION 'You do not have permission to add quotes here';
    END IF;

    IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'At least one quote line is required';
    END IF;

    INSERT INTO quote_blocks (user_id, quotebook_id, month, day_range, year)
    VALUES (auth.uid(), p_quotebook_id, NULLIF(p_month, ''), NULLIF(p_day_range, ''), p_year)
    RETURNING id INTO block_id;

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
            block_id,
            quote_text,
            author_text,
            NULLIF(TRIM(line->>'context'), ''),
            NULLIF(line->>'context_position', ''),
            idx
        );

        idx := idx + 1;
    END LOOP;

    IF idx = 0 THEN
        DELETE FROM quote_blocks WHERE id = block_id;
        RAISE EXCEPTION 'At least one quote line is required';
    END IF;
END;
$$;
