-- Quotebook initial schema (squashed baseline)

-- ==========================================================
-- PROFILES (extends auth.users)
-- ==========================================================

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================
-- QUOTEBOOKS
-- ==========================================================

CREATE TABLE quotebooks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quotebook_permissions (
    id SERIAL PRIMARY KEY,
    quotebook_id INTEGER NOT NULL REFERENCES quotebooks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(quotebook_id, user_id)
);

CREATE TABLE quote_blocks (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    quotebook_id INTEGER NOT NULL REFERENCES quotebooks(id) ON DELETE CASCADE,
    month TEXT,
    day_range TEXT,
    year INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE utterances (
    id SERIAL PRIMARY KEY,
    quote_block_id INTEGER NOT NULL REFERENCES quote_blocks(id) ON DELETE CASCADE,
    quote TEXT NOT NULL,
    author TEXT NOT NULL,
    context TEXT,
    context_position TEXT,
    line_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================
-- ROW LEVEL SECURITY
-- ==========================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotebook_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE utterances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.owned_quotebook_ids()
RETURNS SETOF INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM public.quotebooks WHERE created_by = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.accessible_quotebook_ids()
RETURNS SETOF INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM public.quotebooks WHERE created_by = auth.uid()
    UNION
    SELECT quotebook_id FROM public.quotebook_permissions WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.writable_quotebook_ids()
RETURNS SETOF INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM public.quotebooks WHERE created_by = auth.uid()
    UNION
    SELECT quotebook_id FROM public.quotebook_permissions
    WHERE user_id = auth.uid() AND role IN ('contributor', 'admin');
$$;

CREATE POLICY "Users can view accessible quotebooks"
ON quotebooks FOR SELECT
TO authenticated
USING (
    created_by = auth.uid()
    OR id IN (
        SELECT quotebook_id
        FROM quotebook_permissions
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can create their own quotebooks"
ON quotebooks FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners can update their quotebooks"
ON quotebooks FOR UPDATE
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Owners can delete their quotebooks"
ON quotebooks FOR DELETE
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Users can view permissions for accessible quotebooks"
ON quotebook_permissions FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR quotebook_id IN (SELECT public.owned_quotebook_ids())
);

CREATE POLICY "Users can view quote blocks in accessible quotebooks"
ON quote_blocks FOR SELECT
TO authenticated
USING (quotebook_id IN (SELECT public.accessible_quotebook_ids()));

CREATE POLICY "Contributors can add quote blocks"
ON quote_blocks FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND quotebook_id IN (SELECT public.writable_quotebook_ids())
);

CREATE POLICY "Creators can update their quote blocks"
ON quote_blocks FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Creators can delete their quote blocks"
ON quote_blocks FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Moderators can update quote blocks"
ON quote_blocks FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM quotebooks q
        LEFT JOIN quotebook_permissions p
            ON p.quotebook_id = q.id AND p.user_id = auth.uid()
        WHERE q.id = quote_blocks.quotebook_id
          AND (
              q.created_by = auth.uid()
              OR p.role IN ('contributor', 'admin')
          )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM quotebooks q
        LEFT JOIN quotebook_permissions p
            ON p.quotebook_id = q.id AND p.user_id = auth.uid()
        WHERE q.id = quote_blocks.quotebook_id
          AND (
              q.created_by = auth.uid()
              OR p.role IN ('contributor', 'admin')
          )
    )
);

CREATE POLICY "Moderators can delete quote blocks"
ON quote_blocks FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM quotebooks q
        LEFT JOIN quotebook_permissions p
            ON p.quotebook_id = q.id AND p.user_id = auth.uid()
        WHERE q.id = quote_blocks.quotebook_id
          AND (
              q.created_by = auth.uid()
              OR p.role IN ('contributor', 'admin')
          )
    )
);

CREATE POLICY "Users can view utterances in accessible quotebooks"
ON utterances FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM quote_blocks b
        WHERE b.id = utterances.quote_block_id
          AND b.quotebook_id IN (SELECT public.accessible_quotebook_ids())
    )
);

CREATE POLICY "Contributors can insert utterances"
ON utterances FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM quote_blocks b
        WHERE b.id = utterances.quote_block_id
          AND b.user_id = auth.uid()
          AND b.quotebook_id IN (SELECT public.writable_quotebook_ids())
    )
);

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

CREATE POLICY "Moderators can delete utterances on quote blocks"
ON utterances FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM quote_blocks b
        JOIN quotebooks q ON q.id = b.quotebook_id
        LEFT JOIN quotebook_permissions p
            ON p.quotebook_id = q.id AND p.user_id = auth.uid()
        WHERE b.id = utterances.quote_block_id
          AND (
              b.user_id = auth.uid()
              OR q.created_by = auth.uid()
              OR p.role IN ('contributor', 'admin')
          )
    )
);

CREATE POLICY "Moderators can insert utterances"
ON utterances FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM quote_blocks b
        JOIN quotebooks q ON q.id = b.quotebook_id
        LEFT JOIN quotebook_permissions p
            ON p.quotebook_id = q.id AND p.user_id = auth.uid()
        WHERE b.id = utterances.quote_block_id
          AND (
              b.user_id = auth.uid()
              OR q.created_by = auth.uid()
              OR p.role IN ('contributor', 'admin')
          )
    )
);

-- ==========================================================
-- NEW USER: profile only (quotebooks created from the app)
-- ==========================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    chosen_username TEXT;
BEGIN
    chosen_username := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
        split_part(NEW.email, '@', 1)
    );

    INSERT INTO public.profiles (id, username)
    VALUES (NEW.id, chosen_username);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ==========================================================
-- PERMISSION HELPERS
-- ==========================================================

CREATE OR REPLACE FUNCTION public.can_manage_quotebook_collaborators(p_quotebook_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM quotebooks q
        LEFT JOIN quotebook_permissions p
            ON p.quotebook_id = q.id AND p.user_id = auth.uid()
        WHERE q.id = p_quotebook_id
          AND (
              q.created_by = auth.uid()
              OR p.role = 'admin'
          )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_moderate_quote_block(p_block_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM quote_blocks b
        JOIN quotebooks q ON q.id = b.quotebook_id
        LEFT JOIN quotebook_permissions p
            ON p.quotebook_id = q.id AND p.user_id = auth.uid()
        WHERE b.id = p_block_id
          AND (
              b.user_id = auth.uid()
              OR q.created_by = auth.uid()
              OR p.role IN ('contributor', 'admin')
          )
    );
$$;

-- ==========================================================
-- RPC: quotebooks
-- ==========================================================

CREATE OR REPLACE FUNCTION public.get_accessible_quotebooks()
RETURNS TABLE (
    id INTEGER,
    title TEXT,
    description TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ,
    user_role TEXT,
    quote_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT
        q.id,
        q.title,
        q.description,
        q.created_by,
        q.created_at,
        CASE
            WHEN q.created_by = auth.uid() THEN 'owner'
            ELSE p.role
        END AS user_role,
        (
            SELECT COUNT(*)::BIGINT
            FROM quote_blocks b
            WHERE b.quotebook_id = q.id
        ) AS quote_count
    FROM quotebooks q
    LEFT JOIN quotebook_permissions p
        ON q.id = p.quotebook_id AND p.user_id = auth.uid()
    WHERE q.created_by = auth.uid() OR p.user_id = auth.uid()
    ORDER BY q.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_quotebook_for_user(p_quotebook_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    title TEXT,
    description TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ,
    user_role TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT
        q.id,
        q.title,
        q.description,
        q.created_by,
        q.created_at,
        CASE
            WHEN q.created_by = auth.uid() THEN 'owner'
            ELSE p.role
        END AS user_role
    FROM quotebooks q
    LEFT JOIN quotebook_permissions p
        ON q.id = p.quotebook_id AND p.user_id = auth.uid()
    WHERE q.id = p_quotebook_id
      AND (q.created_by = auth.uid() OR p.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.create_quotebook(
    p_title TEXT,
    p_description TEXT DEFAULT NULL
)
RETURNS TABLE (
    id INTEGER,
    title TEXT,
    description TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'You must be logged in to create a quotebook';
    END IF;

    IF trim(p_title) = '' THEN
        RAISE EXCEPTION 'Title is required';
    END IF;

    RETURN QUERY
    INSERT INTO quotebooks (title, description, created_by)
    VALUES (trim(p_title), NULLIF(trim(p_description), ''), auth.uid())
    RETURNING quotebooks.id, quotebooks.title, quotebooks.description,
              quotebooks.created_by, quotebooks.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_quotebook(p_quotebook_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM quotebooks
        WHERE id = p_quotebook_id AND created_by = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Owners cannot leave their own quotebook. Delete it instead.';
    END IF;

    DELETE FROM quotebook_permissions
    WHERE quotebook_id = p_quotebook_id AND user_id = auth.uid();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'You do not have access to this quotebook';
    END IF;
END;
$$;

-- ==========================================================
-- RPC: quotes
-- ==========================================================

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
    IF NOT public.can_moderate_quote_block(p_block_id) THEN
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

-- ==========================================================
-- RPC: collaborators
-- ==========================================================

CREATE OR REPLACE FUNCTION public.get_quotebook_collaborators(p_quotebook_id INTEGER)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    email TEXT,
    role TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p.user_id, pr.username, au.email::TEXT, p.role
    FROM quotebook_permissions p
    JOIN profiles pr ON pr.id = p.user_id
    JOIN auth.users au ON au.id = p.user_id
    WHERE p.quotebook_id = p_quotebook_id
      AND public.can_manage_quotebook_collaborators(p_quotebook_id);
$$;

CREATE OR REPLACE FUNCTION public.update_quotebook_collaborator_role(
    p_quotebook_id INTEGER,
    p_user_id UUID,
    p_role TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.can_manage_quotebook_collaborators(p_quotebook_id) THEN
        RAISE EXCEPTION 'Only the owner or an admin can manage collaborators';
    END IF;

    IF p_role NOT IN ('viewer', 'contributor', 'admin') THEN
        RAISE EXCEPTION 'Invalid role';
    END IF;

    UPDATE quotebook_permissions
    SET role = p_role
    WHERE quotebook_id = p_quotebook_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Collaborator not found';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_quotebook_collaborator(
    p_quotebook_id INTEGER,
    p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.can_manage_quotebook_collaborators(p_quotebook_id) THEN
        RAISE EXCEPTION 'Only the owner or an admin can manage collaborators';
    END IF;

    DELETE FROM quotebook_permissions
    WHERE quotebook_id = p_quotebook_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Collaborator not found';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.share_quotebook_with_email(
    p_quotebook_id INTEGER,
    p_friend_email TEXT,
    p_role TEXT DEFAULT 'viewer'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    friend_id UUID;
BEGIN
    IF NOT public.can_manage_quotebook_collaborators(p_quotebook_id) THEN
        RAISE EXCEPTION 'Only the owner or an admin can share this quotebook';
    END IF;

    IF p_role NOT IN ('viewer', 'contributor', 'admin') THEN
        RAISE EXCEPTION 'Invalid role';
    END IF;

    SELECT au.id INTO friend_id
    FROM auth.users au
    WHERE lower(au.email) = lower(trim(p_friend_email));

    IF friend_id IS NULL THEN
        RAISE EXCEPTION 'Could not share. Make sure the email is registered.';
    END IF;

    INSERT INTO quotebook_permissions (quotebook_id, user_id, role)
    VALUES (p_quotebook_id, friend_id, p_role)
    ON CONFLICT (quotebook_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;

-- ==========================================================
-- GRANTS
-- ==========================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON quotebooks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON quote_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON utterances TO authenticated;
GRANT SELECT ON quotebook_permissions TO authenticated;
GRANT SELECT, UPDATE ON profiles TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_quotebook(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_accessible_quotebooks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quotebook_for_user(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_quote_entry(INTEGER, TEXT, TEXT, INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_quote_entry(INTEGER, TEXT, TEXT, INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.share_quotebook_with_email(INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quotebook_collaborators(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_quotebook_collaborator_role(INTEGER, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_quotebook_collaborator(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_moderate_quote_block(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_quotebook_collaborators(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_quotebook(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_speaker_in_quotebook(INTEGER, TEXT, TEXT) TO authenticated;
