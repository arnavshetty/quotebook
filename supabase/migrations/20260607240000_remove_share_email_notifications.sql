-- Share notifications removed; RPC returns void again (dashboard-only sharing)

DROP FUNCTION IF EXISTS public.share_quotebook_with_email(INTEGER, TEXT, TEXT);

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
