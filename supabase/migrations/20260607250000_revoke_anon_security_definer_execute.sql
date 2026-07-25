-- Lock down SECURITY DEFINER EXECUTE grants.
-- Postgres defaults EXECUTE to PUBLIC, which exposes these via /rest/v1/rpc.

-- ---------------------------------------------------------------------------
-- Trigger-only: never callable by API roles
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS helpers: keep authenticated (policies call them), hide from anon
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.owned_quotebook_ids() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accessible_quotebook_ids() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.writable_quotebook_ids() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.owned_quotebook_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accessible_quotebook_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.writable_quotebook_ids() TO authenticated;

-- ---------------------------------------------------------------------------
-- Internal helpers: not called from the client
-- can_moderate is used by update_quote_entry (SECURITY INVOKER) → keep auth
-- can_manage is only called from other SECURITY DEFINER RPCs → revoke auth
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.can_moderate_quote_block(INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_moderate_quote_block(INTEGER)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_manage_quotebook_collaborators(INTEGER)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Intentional app RPCs: signed-in only
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_quotebook_collaborators(INTEGER)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.leave_quotebook(INTEGER)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_quotebook_collaborator(INTEGER, UUID)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rename_speaker_in_quotebook(INTEGER, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.share_quotebook_with_email(INTEGER, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_quotebook_collaborator_role(INTEGER, UUID, TEXT)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_quotebook_collaborators(INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_quotebook(INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_quotebook_collaborator(INTEGER, UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_speaker_in_quotebook(INTEGER, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.share_quotebook_with_email(INTEGER, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_quotebook_collaborator_role(INTEGER, UUID, TEXT)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- Prevent new public functions from inheriting EXECUTE for anon/PUBLIC
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
