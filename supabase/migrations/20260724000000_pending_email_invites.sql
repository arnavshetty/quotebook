-- Pending email invites for users who do not have an account yet.
-- When they sign up with a matching email, access is granted automatically.

CREATE TABLE IF NOT EXISTS public.quotebook_invites (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    quotebook_id INTEGER NOT NULL REFERENCES public.quotebooks(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('viewer', 'contributor', 'admin')),
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT quotebook_invites_email_lower CHECK (email = lower(email)),
    CONSTRAINT quotebook_invites_unique_email UNIQUE (quotebook_id, email)
);

CREATE INDEX IF NOT EXISTS quotebook_invites_email_idx
    ON public.quotebook_invites (email);

ALTER TABLE public.quotebook_invites ENABLE ROW LEVEL SECURITY;

-- Access only through SECURITY DEFINER RPCs
REVOKE ALL ON TABLE public.quotebook_invites FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Share: grant immediately if registered, otherwise create a pending invite
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.share_quotebook_with_email(INTEGER, TEXT, TEXT);

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
    IF NOT public.can_manage_quotebook_collaborators(p_quotebook_id) THEN
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

-- ---------------------------------------------------------------------------
-- List active collaborators and pending invites together
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_quotebook_collaborators(INTEGER);

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
          AND public.can_manage_quotebook_collaborators(p_quotebook_id)

        UNION ALL

        SELECT NULL::UUID, NULL::TEXT, i.email, i.role, 'pending'::TEXT
        FROM quotebook_invites i
        WHERE i.quotebook_id = p_quotebook_id
          AND public.can_manage_quotebook_collaborators(p_quotebook_id)
    ) c
    ORDER BY c.status ASC, c.email ASC;
$$;

-- ---------------------------------------------------------------------------
-- Update role for active collaborator or pending invite
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_quotebook_collaborator_role(INTEGER, UUID, TEXT);

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
    IF NOT public.can_manage_quotebook_collaborators(p_quotebook_id) THEN
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

-- ---------------------------------------------------------------------------
-- Remove active collaborator or pending invite
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.remove_quotebook_collaborator(INTEGER, UUID);

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
    IF NOT public.can_manage_quotebook_collaborators(p_quotebook_id) THEN
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

-- ---------------------------------------------------------------------------
-- On signup: apply any pending invites for the new user's email
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    chosen_username TEXT;
    normalized_email TEXT;
BEGIN
    chosen_username := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
        split_part(NEW.email, '@', 1)
    );

    INSERT INTO public.profiles (id, username)
    VALUES (NEW.id, chosen_username);

    normalized_email := lower(NEW.email);

    INSERT INTO public.quotebook_permissions (quotebook_id, user_id, role)
    SELECT i.quotebook_id, NEW.id, i.role
    FROM public.quotebook_invites i
    WHERE i.email = normalized_email
    ON CONFLICT (quotebook_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    DELETE FROM public.quotebook_invites
    WHERE email = normalized_email;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;

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
