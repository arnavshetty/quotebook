-- Add quote counts to dashboard quotebook list

DROP FUNCTION IF EXISTS public.get_accessible_quotebooks();

CREATE FUNCTION public.get_accessible_quotebooks()
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

GRANT EXECUTE ON FUNCTION public.get_accessible_quotebooks() TO authenticated;
