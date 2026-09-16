-- Address advisor lint 0029_authenticated_security_definer_function_executable.
--
-- Internal helpers stay SECURITY DEFINER (needed to avoid RLS recursion) but
-- move out of the PostgREST-exposed `public` schema so they are not callable
-- at /rest/v1/rpc. App RPCs that authenticated users must call either switch
-- to SECURITY INVOKER (when RLS can enforce the same rules) or stay DEFINER
-- by design (they read auth.users or write tables with no client grants).

-- ---------------------------------------------------------------------------
-- Private schema for RLS / permission helpers
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA private
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.owned_quotebook_ids()
RETURNS SETOF INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM public.quotebooks WHERE created_by = auth.uid();
$$;

CREATE OR REPLACE FUNCTION private.accessible_quotebook_ids()
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

CREATE OR REPLACE FUNCTION private.writable_quotebook_ids()
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

CREATE OR REPLACE FUNCTION private.can_moderate_quote_block(p_block_id INTEGER)
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

CREATE OR REPLACE FUNCTION private.can_manage_quotebook_collaborators(p_quotebook_id INTEGER)
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

REVOKE EXECUTE ON FUNCTION private.owned_quotebook_ids()
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.accessible_quotebook_ids()
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.writable_quotebook_ids()
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.can_moderate_quote_block(INTEGER)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.can_manage_quotebook_collaborators(INTEGER)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.owned_quotebook_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION private.accessible_quotebook_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION private.writable_quotebook_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_moderate_quote_block(INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- Point RLS policies at the private helpers
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view permissions for accessible quotebooks"
  ON public.quotebook_permissions;
CREATE POLICY "Users can view permissions for accessible quotebooks"
ON public.quotebook_permissions FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR quotebook_id IN (SELECT private.owned_quotebook_ids())
);

DROP POLICY IF EXISTS "Users can view quote blocks in accessible quotebooks"
  ON public.quote_blocks;
CREATE POLICY "Users can view quote blocks in accessible quotebooks"
ON public.quote_blocks FOR SELECT
TO authenticated
USING (quotebook_id IN (SELECT private.accessible_quotebook_ids()));

DROP POLICY IF EXISTS "Contributors can add quote blocks"
  ON public.quote_blocks;
CREATE POLICY "Contributors can add quote blocks"
ON public.quote_blocks FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND quotebook_id IN (SELECT private.writable_quotebook_ids())
);

DROP POLICY IF EXISTS "Users can view utterances in accessible quotebooks"
  ON public.utterances;
CREATE POLICY "Users can view utterances in accessible quotebooks"
ON public.utterances FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM quote_blocks b
        WHERE b.id = utterances.quote_block_id
          AND b.quotebook_id IN (SELECT private.accessible_quotebook_ids())
    )
);

DROP POLICY IF EXISTS "Contributors can insert utterances"
  ON public.utterances;
CREATE POLICY "Contributors can insert utterances"
ON public.utterances FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM quote_blocks b
        WHERE b.id = utterances.quote_block_id
          AND b.user_id = auth.uid()
          AND b.quotebook_id IN (SELECT private.writable_quotebook_ids())
    )
);

-- ---------------------------------------------------------------------------
-- Callers of the moved helpers
-- ---------------------------------------------------------------------------
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
    IF NOT private.can_moderate_quote_block(p_block_id) THEN
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

CREATE OR REPLACE FUNCTION public.share_quotebook_with_email(
    p_quotebook_id INTEGER,
    p_friend_email TEXT,
    p_role TEXT DEFAULT 'viewer'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    friend_id UUID;
    normalized_email TEXT;
BEGIN
    IF NOT private.can_manage_quotebook_collaborators(p_quotebook_id) THEN
        RAISE EXCEPTION 'Only the owner or an admin can share this quotebook';
    END IF;

    IF p_role NOT IN ('viewer', 'contributor', 'admin') THEN
        RAISE EXCEPTION 'Invalid role';
    END IF;

    normalized_email := lower(trim(p_friend_email));
    IF normalized_email = '' OR position('@' IN normalized_email) = 0 THEN
        RAISE EXCEPTION 'A valid email is required';
    END IF;

    IF EXISTS (
        SELECT 1 FROM auth.users WHERE id = auth.uid() AND lower(email) = normalized_email
    ) THEN
        RAISE EXCEPTION 'You cannot share a quotebook with yourself';
    END IF;

    SELECT au.id INTO friend_id
    FROM auth.users au
    WHERE lower(au.email) = normalized_email;

    IF friend_id IS NOT NULL THEN
        INSERT INTO quotebook_permissions (quotebook_id, user_id, role)
        VALUES (p_quotebook_id, friend_id, p_role)
        ON CONFLICT (quotebook_id, user_id) DO UPDATE SET role = EXCLUDED.role;

        DELETE FROM quotebook_invites
        WHERE quotebook_id = p_quotebook_id AND email = normalized_email;

        RETURN 'shared';
    END IF;

    INSERT INTO quotebook_invites (quotebook_id, email, role, invited_by)
    VALUES (p_quotebook_id, normalized_email, p_role, auth.uid())
    ON CONFLICT (quotebook_id, email) DO UPDATE
        SET role = EXCLUDED.role,
            invited_by = EXCLUDED.invited_by;

    RETURN 'invited';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_quotebook_collaborators(p_quotebook_id INTEGER)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    email TEXT,
    role TEXT,
    status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT c.user_id, c.username, c.email, c.role, c.status
    FROM (
        SELECT p.user_id, pr.username, au.email::TEXT AS email, p.role, 'active'::TEXT AS status
        FROM quotebook_permissions p
        JOIN profiles pr ON pr.id = p.user_id
        JOIN auth.users au ON au.id = p.user_id
        WHERE p.quotebook_id = p_quotebook_id
          AND private.can_manage_quotebook_collaborators(p_quotebook_id)

        UNION ALL

        SELECT NULL::UUID, NULL::TEXT, i.email, i.role, 'pending'::TEXT
        FROM quotebook_invites i
        WHERE i.quotebook_id = p_quotebook_id
          AND private.can_manage_quotebook_collaborators(p_quotebook_id)
    ) c
    ORDER BY c.status ASC, c.email ASC;
$$;

CREATE OR REPLACE FUNCTION public.update_quotebook_collaborator_role(
    p_quotebook_id INTEGER,
    p_user_id UUID,
    p_role TEXT,
    p_email TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    normalized_email TEXT;
BEGIN
    IF NOT private.can_manage_quotebook_collaborators(p_quotebook_id) THEN
        RAISE EXCEPTION 'Only the owner or an admin can manage collaborators';
    END IF;

    IF p_role NOT IN ('viewer', 'contributor', 'admin') THEN
        RAISE EXCEPTION 'Invalid role';
    END IF;

    IF p_user_id IS NOT NULL THEN
        UPDATE quotebook_permissions
        SET role = p_role
        WHERE quotebook_id = p_quotebook_id AND user_id = p_user_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Collaborator not found';
        END IF;
        RETURN;
    END IF;

    normalized_email := lower(trim(COALESCE(p_email, '')));
    IF normalized_email = '' THEN
        RAISE EXCEPTION 'Collaborator not found';
    END IF;

    UPDATE quotebook_invites
    SET role = p_role
    WHERE quotebook_id = p_quotebook_id AND email = normalized_email;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending invite not found';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_quotebook_collaborator(
    p_quotebook_id INTEGER,
    p_user_id UUID,
    p_email TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    normalized_email TEXT;
BEGIN
    IF NOT private.can_manage_quotebook_collaborators(p_quotebook_id) THEN
        RAISE EXCEPTION 'Only the owner or an admin can manage collaborators';
    END IF;

    IF p_user_id IS NOT NULL THEN
        DELETE FROM quotebook_permissions
        WHERE quotebook_id = p_quotebook_id AND user_id = p_user_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Collaborator not found';
        END IF;
        RETURN;
    END IF;

    normalized_email := lower(trim(COALESCE(p_email, '')));
    IF normalized_email = '' THEN
        RAISE EXCEPTION 'Collaborator not found';
    END IF;

    DELETE FROM quotebook_invites
    WHERE quotebook_id = p_quotebook_id AND email = normalized_email;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending invite not found';
    END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.owned_quotebook_ids();
DROP FUNCTION IF EXISTS public.accessible_quotebook_ids();
DROP FUNCTION IF EXISTS public.writable_quotebook_ids();
DROP FUNCTION IF EXISTS public.can_moderate_quote_block(INTEGER);
DROP FUNCTION IF EXISTS public.can_manage_quotebook_collaborators(INTEGER);

-- ---------------------------------------------------------------------------
-- leave_quotebook / rename_speaker: no longer need to bypass RLS
-- ---------------------------------------------------------------------------
GRANT DELETE ON public.quotebook_permissions TO authenticated;

DROP POLICY IF EXISTS "Users can delete their own permission row"
  ON public.quotebook_permissions;
CREATE POLICY "Users can delete their own permission row"
ON public.quotebook_permissions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.leave_quotebook(p_quotebook_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
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

DROP POLICY IF EXISTS "Owners and admins can update utterances"
  ON public.utterances;
CREATE POLICY "Owners and admins can update utterances"
ON public.utterances FOR UPDATE
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
              q.created_by = auth.uid()
              OR p.role = 'admin'
          )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM quote_blocks b
        JOIN quotebooks q ON q.id = b.quotebook_id
        LEFT JOIN quotebook_permissions p
            ON p.quotebook_id = q.id AND p.user_id = auth.uid()
        WHERE b.id = utterances.quote_block_id
          AND (
              q.created_by = auth.uid()
              OR p.role = 'admin'
          )
    )
);

CREATE OR REPLACE FUNCTION public.rename_speaker_in_quotebook(
    p_quotebook_id INTEGER,
    p_old_name TEXT,
    p_new_name TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
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

REVOKE EXECUTE ON FUNCTION public.leave_quotebook(INTEGER)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rename_speaker_in_quotebook(INTEGER, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_quotebook(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_speaker_in_quotebook(INTEGER, TEXT, TEXT)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_quotebook_collaborators(INTEGER)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.share_quotebook_with_email(INTEGER, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_quotebook_collaborator_role(INTEGER, UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_quotebook_collaborator(INTEGER, UUID, TEXT)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_quotebook_collaborators(INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.share_quotebook_with_email(INTEGER, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_quotebook_collaborator_role(INTEGER, UUID, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_quotebook_collaborator(INTEGER, UUID, TEXT)
  TO authenticated;
