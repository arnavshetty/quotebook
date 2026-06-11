-- 5. Contributors can moderate any quote in a quotebook they contribute to
-- 6. Admins can manage collaborators (list, share, change roles, remove)

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

DROP POLICY IF EXISTS "Owners and admins can update quote blocks" ON quote_blocks;
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

DROP POLICY IF EXISTS "Owners and admins can delete quote blocks" ON quote_blocks;
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

DROP POLICY IF EXISTS "Moderators can delete utterances on quote blocks" ON utterances;
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

DROP POLICY IF EXISTS "Moderators can insert utterances" ON utterances;
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

DROP FUNCTION IF EXISTS public.share_quotebook_with_email(INTEGER, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.share_quotebook_with_email(
    p_quotebook_id INTEGER,
    p_friend_email TEXT,
    p_role TEXT DEFAULT 'viewer'
)
RETURNS TABLE (
    friend_email TEXT,
    quotebook_title TEXT,
    shared_by TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    friend_id UUID;
    book_title TEXT;
    sharer_name TEXT;
BEGIN
    IF NOT public.can_manage_quotebook_collaborators(p_quotebook_id) THEN
        RAISE EXCEPTION 'Only the owner or an admin can share this quotebook';
    END IF;

    IF p_role NOT IN ('viewer', 'contributor', 'admin') THEN
        RAISE EXCEPTION 'Invalid role';
    END IF;

    SELECT q.title INTO book_title
    FROM quotebooks q
    WHERE q.id = p_quotebook_id;

    SELECT COALESCE(pr.username, au.email::TEXT) INTO sharer_name
    FROM auth.users au
    LEFT JOIN profiles pr ON pr.id = au.id
    WHERE au.id = auth.uid();

    SELECT au.id INTO friend_id
    FROM auth.users au
    WHERE lower(au.email) = lower(trim(p_friend_email));

    IF friend_id IS NULL THEN
        RAISE EXCEPTION 'Could not share. Make sure the email is registered.';
    END IF;

    INSERT INTO quotebook_permissions (quotebook_id, user_id, role)
    VALUES (p_quotebook_id, friend_id, p_role)
    ON CONFLICT (quotebook_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    RETURN QUERY
    SELECT lower(trim(p_friend_email)), book_title, sharer_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_quotebook_collaborators(INTEGER) TO authenticated;
