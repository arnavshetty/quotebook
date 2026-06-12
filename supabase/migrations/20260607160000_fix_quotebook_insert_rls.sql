-- Fix quotebook creation: SELECT policy blocked INSERT ... RETURNING,
-- and ensure authenticated role has table grants.

GRANT SELECT, INSERT, UPDATE, DELETE ON quotebooks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON quote_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON utterances TO authenticated;
GRANT SELECT ON quotebook_permissions TO authenticated;
GRANT SELECT, UPDATE ON profiles TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

DROP POLICY IF EXISTS "Users can view accessible quotebooks" ON quotebooks;
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

GRANT EXECUTE ON FUNCTION public.create_quotebook(TEXT, TEXT) TO authenticated;
