-- "Only super admins can manage affiliates" is a single ALL-command policy
-- with no deleted_at check at all, so it silently bypassed every SELECT
-- filter added for soft-delete: any super_admin (system role) could still
-- see soft-deleted affiliates, since this ALL policy has priority
-- independent of the deleted_at-filtered SELECT policies added alongside
-- it. Split it into per-command policies so only the SELECT one gets the
-- deleted_at IS NULL filter — INSERT/UPDATE/DELETE stay exactly as
-- permissive as before for super_admin.

DROP POLICY "Only super admins can manage affiliates" ON public.affiliates;

CREATE POLICY "affiliates_select_super_admin" ON public.affiliates
  FOR SELECT
  USING (is_super_admin(auth.uid()) AND deleted_at IS NULL);

CREATE POLICY "affiliates_insert_super_admin" ON public.affiliates
  FOR INSERT
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "affiliates_update_super_admin" ON public.affiliates
  FOR UPDATE
  USING (is_super_admin(auth.uid()));

CREATE POLICY "affiliates_delete_super_admin" ON public.affiliates
  FOR DELETE
  USING (is_super_admin(auth.uid()));
