-- Lint 0008: RLS on quotebook_invites with no policies.
-- Access is intentionally RPC-only (SECURITY DEFINER). Grants are already
-- revoked from anon/authenticated; this policy makes that deny-by-default
-- explicit so the advisor stops treating it as a missing-policy mistake.

CREATE POLICY "No client access to quotebook invites"
ON public.quotebook_invites
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
