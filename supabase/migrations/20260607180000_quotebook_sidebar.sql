-- Collaborator management for quotebook sidebar

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
      AND EXISTS (
          SELECT 1 FROM quotebooks q
          WHERE q.id = p_quotebook_id AND q.created_by = auth.uid()
      );
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
    IF NOT EXISTS (
        SELECT 1 FROM quotebooks
        WHERE id = p_quotebook_id AND created_by = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Only the owner can manage collaborators';
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
    IF NOT EXISTS (
        SELECT 1 FROM quotebooks
        WHERE id = p_quotebook_id AND created_by = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Only the owner can manage collaborators';
    END IF;

    DELETE FROM quotebook_permissions
    WHERE quotebook_id = p_quotebook_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Collaborator not found';
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_quotebook_collaborators(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_quotebook_collaborator_role(INTEGER, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_quotebook_collaborator(INTEGER, UUID) TO authenticated;
