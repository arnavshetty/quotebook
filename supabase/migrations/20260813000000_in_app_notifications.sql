-- In-app notifications when a new quote is added to a shared quotebook.

CREATE TABLE IF NOT EXISTS public.user_notifications (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    quotebook_id INTEGER NOT NULL REFERENCES public.quotebooks(id) ON DELETE CASCADE,
    quote_block_id INTEGER NOT NULL REFERENCES public.quote_blocks(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'new_quote' CHECK (kind = 'new_quote'),
    actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL,
    quotebook_title TEXT NOT NULL,
    preview_text TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_notifications_user_created_idx
    ON public.user_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_notifications_user_unread_idx
    ON public.user_notifications (user_id)
    WHERE read_at IS NULL;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
ON public.user_notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
ON public.user_notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

GRANT SELECT, UPDATE ON public.user_notifications TO authenticated;

CREATE TABLE IF NOT EXISTS public.quotebook_notification_settings (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    quotebook_id INTEGER NOT NULL REFERENCES public.quotebooks(id) ON DELETE CASCADE,
    notify_on_new_quote BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, quotebook_id)
);

ALTER TABLE public.quotebook_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own quote notification settings"
ON public.quotebook_notification_settings
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotebook_notification_settings TO authenticated;

-- ---------------------------------------------------------------------------
-- Create notifications for quotebook members (except the author)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_new_quote_notifications(p_block_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_quotebook_id INTEGER;
    v_added_by UUID;
    v_quotebook_title TEXT;
    v_actor_name TEXT;
    v_preview TEXT;
    v_member UUID;
BEGIN
    SELECT
        b.quotebook_id,
        b.user_id,
        q.title,
        COALESCE(pr.username, split_part(au.email, '@', 1)),
        LEFT(
            COALESCE(
                (
                    SELECT u.quote
                    FROM public.utterances u
                    WHERE u.quote_block_id = b.id
                    ORDER BY u.line_order ASC
                    LIMIT 1
                ),
                'New quote'
            ),
            240
        )
    INTO v_quotebook_id, v_added_by, v_quotebook_title, v_actor_name, v_preview
    FROM public.quote_blocks b
    JOIN public.quotebooks q ON q.id = b.quotebook_id
    JOIN auth.users au ON au.id = b.user_id
    LEFT JOIN public.profiles pr ON pr.id = b.user_id
    WHERE b.id = p_block_id;

    IF v_quotebook_id IS NULL THEN
        RETURN;
    END IF;

    FOR v_member IN
        SELECT members.user_id
        FROM (
            SELECT q.created_by AS user_id
            FROM public.quotebooks q
            WHERE q.id = v_quotebook_id

            UNION

            SELECT p.user_id
            FROM public.quotebook_permissions p
            WHERE p.quotebook_id = v_quotebook_id
        ) members
        WHERE members.user_id <> v_added_by
          AND COALESCE(
              (
                  SELECT s.notify_on_new_quote
                  FROM public.quotebook_notification_settings s
                  WHERE s.user_id = members.user_id
                    AND s.quotebook_id = v_quotebook_id
              ),
              true
          ) = true
    LOOP
        INSERT INTO public.user_notifications (
            user_id,
            quotebook_id,
            quote_block_id,
            kind,
            actor_user_id,
            actor_name,
            quotebook_title,
            preview_text
        )
        VALUES (
            v_member,
            v_quotebook_id,
            p_block_id,
            'new_quote',
            v_added_by,
            v_actor_name,
            v_quotebook_title,
            v_preview
        );
    END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_new_quote_notifications(INTEGER)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Hook quote creation
-- ---------------------------------------------------------------------------
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

    PERFORM public.create_new_quote_notifications(block_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- User-facing RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_notifications(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
    id BIGINT,
    quotebook_id INTEGER,
    quote_block_id INTEGER,
    kind TEXT,
    actor_name TEXT,
    quotebook_title TEXT,
    preview_text TEXT,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT
        n.id,
        n.quotebook_id,
        n.quote_block_id,
        n.kind,
        n.actor_name,
        n.quotebook_title,
        n.preview_text,
        n.read_at,
        n.created_at
    FROM public.user_notifications n
    WHERE n.user_id = auth.uid()
    ORDER BY n.created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 50));
$$;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT COUNT(*)::BIGINT
    FROM public.user_notifications n
    WHERE n.user_id = auth.uid()
      AND n.read_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    UPDATE public.user_notifications
    SET read_at = now()
    WHERE id = p_notification_id
      AND user_id = auth.uid()
      AND read_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Notification not found';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    updated_count BIGINT;
BEGIN
    UPDATE public.user_notifications
    SET read_at = now()
    WHERE user_id = auth.uid()
      AND read_at IS NULL;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_quotebook_notification_setting(p_quotebook_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT COALESCE(
        (
            SELECT s.notify_on_new_quote
            FROM public.quotebook_notification_settings s
            WHERE s.user_id = auth.uid()
              AND s.quotebook_id = p_quotebook_id
        ),
        true
    );
$$;

CREATE OR REPLACE FUNCTION public.set_quotebook_notification_setting(
    p_quotebook_id INTEGER,
    p_enabled BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.quotebooks q
        LEFT JOIN public.quotebook_permissions p
            ON p.quotebook_id = q.id AND p.user_id = auth.uid()
        WHERE q.id = p_quotebook_id
          AND (q.created_by = auth.uid() OR p.user_id = auth.uid())
    ) THEN
        RAISE EXCEPTION 'Quotebook not found or access denied';
    END IF;

    INSERT INTO public.quotebook_notification_settings (user_id, quotebook_id, notify_on_new_quote)
    VALUES (auth.uid(), p_quotebook_id, p_enabled)
    ON CONFLICT (user_id, quotebook_id) DO UPDATE
        SET notify_on_new_quote = EXCLUDED.notify_on_new_quote,
            updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_notifications(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quotebook_notification_setting(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_quotebook_notification_setting(INTEGER, BOOLEAN) TO authenticated;

ALTER TABLE public.user_notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
