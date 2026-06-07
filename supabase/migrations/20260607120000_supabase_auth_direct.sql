-- Migrate from custom users table to Supabase Auth + profiles

-- Drop old policies
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can view quotebooks they own or are shared with them" ON quotebooks;
DROP POLICY IF EXISTS "Users can create their own quotebooks" ON quotebooks;
DROP POLICY IF EXISTS "Owners can update their own quotebooks" ON quotebooks;
DROP POLICY IF EXISTS "Owners can delete their own quotebooks" ON quotebooks;
DROP POLICY IF EXISTS "Users can view permissions for quotebooks they have access to" ON quotebook_permissions;
DROP POLICY IF EXISTS "Only quotebook owners can manage permissions" ON quotebook_permissions;
DROP POLICY IF EXISTS "Users can view quote blocks in accessible quotebooks" ON quote_blocks;
DROP POLICY IF EXISTS "Users can add quote blocks if they are owners or contributors" ON quote_blocks;
DROP POLICY IF EXISTS "Users can view utterances if they can view the quote block" ON utterances;
DROP POLICY IF EXISTS "Users can insert utterances if they can write to the quote block" ON utterances;

DROP TABLE IF EXISTS utterances CASCADE;
DROP TABLE IF EXISTS quote_blocks CASCADE;
DROP TABLE IF EXISTS quotebook_permissions CASCADE;
DROP TABLE IF EXISTS quotebooks CASCADE;
DROP TABLE IF EXISTS users CASCADE;

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

CREATE POLICY "Users can view accessible quotebooks"
ON quotebooks FOR SELECT
TO authenticated
USING (
    created_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM quotebook_permissions
        WHERE quotebook_permissions.quotebook_id = quotebooks.id
        AND quotebook_permissions.user_id = auth.uid()
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
    EXISTS (
        SELECT 1 FROM quotebooks
        WHERE quotebooks.id = quotebook_permissions.quotebook_id
        AND (
            quotebooks.created_by = auth.uid()
            OR quotebook_permissions.user_id = auth.uid()
        )
    )
);

CREATE POLICY "Users can view quote blocks in accessible quotebooks"
ON quote_blocks FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM quotebooks q
        LEFT JOIN quotebook_permissions p
            ON q.id = p.quotebook_id AND p.user_id = auth.uid()
        WHERE q.id = quote_blocks.quotebook_id
        AND (q.created_by = auth.uid() OR p.user_id = auth.uid())
    )
);

CREATE POLICY "Contributors can add quote blocks"
ON quote_blocks FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM quotebooks q
        LEFT JOIN quotebook_permissions p
            ON q.id = p.quotebook_id AND p.user_id = auth.uid()
        WHERE q.id = quote_blocks.quotebook_id
        AND (
            q.created_by = auth.uid()
            OR (p.user_id = auth.uid() AND p.role IN ('contributor', 'admin'))
        )
    )
);

CREATE POLICY "Creators can delete their quote blocks"
ON quote_blocks FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can view utterances in accessible quotebooks"
ON utterances FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM quote_blocks b
        JOIN quotebooks q ON q.id = b.quotebook_id
        LEFT JOIN quotebook_permissions p
            ON q.id = p.quotebook_id AND p.user_id = auth.uid()
        WHERE b.id = utterances.quote_block_id
        AND (q.created_by = auth.uid() OR p.user_id = auth.uid())
    )
);

-- ==========================================================
-- NEW USER: profile + default quotebook
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

    INSERT INTO public.quotebooks (title, description, created_by)
    VALUES (
        'My First Quotebook',
        'My personal collection of favorite quotes.',
        NEW.id
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ==========================================================
-- RPC: list quotebooks with role
-- ==========================================================

CREATE OR REPLACE FUNCTION public.get_accessible_quotebooks()
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
    WHERE q.created_by = auth.uid() OR p.user_id = auth.uid()
    ORDER BY q.created_at DESC;
$$;

-- ==========================================================
-- RPC: single quotebook with role
-- ==========================================================

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

-- ==========================================================
-- RPC: add quote block + utterances
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

-- ==========================================================
-- RPC: share quotebook by email
-- ==========================================================

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
    IF NOT EXISTS (
        SELECT 1 FROM quotebooks
        WHERE id = p_quotebook_id AND created_by = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Only the owner can share this quotebook';
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

GRANT EXECUTE ON FUNCTION public.get_accessible_quotebooks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quotebook_for_user(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_quote_entry(INTEGER, TEXT, TEXT, INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.share_quotebook_with_email(INTEGER, TEXT, TEXT) TO authenticated;
