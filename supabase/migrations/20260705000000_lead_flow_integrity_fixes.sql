-- Lead flow integrity fixes
--
-- Prevent duplicate leads for the same email at the database level.
-- The application already checks for an existing email before inserting,
-- but that check-then-insert is not atomic, so concurrent submissions of
-- the same email could both pass the check and both get inserted.
-- NOTE: if duplicate emails already exist in the `leads` table, this
-- statement will fail. Deduplicate existing rows before applying this
-- migration in that case.
--
-- (A unique index on lead_distributions(lead_id, advertiser_id) was
-- considered to close a similar race on distribution sends, but the
-- "Resend to same advertiser" feature (src/components/leads/ResendLeadsDialog.tsx
-- + distribute-lead's is_resend/force_advertiser_id handling) intentionally
-- inserts a second lead_distributions row for the same lead/advertiser pair,
-- so that constraint would have broken a real feature. Left out.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_email_unique
    ON public.leads (lower(email));
