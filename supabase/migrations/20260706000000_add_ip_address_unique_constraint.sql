-- Prevent duplicate leads from the same IP address at the database level,
-- mirroring the email uniqueness fix in 20260705000000_lead_flow_integrity_fixes.sql.
--
-- NOTE: if duplicate ip_address values already exist in the `leads` table,
-- this statement will fail. Deduplicate existing rows before applying this
-- migration in that case.
--
-- 'unknown' and NULL are excluded: 'unknown' is the fallback value written
-- when a submission endpoint cannot detect a client IP, and many legitimate
-- leads share that placeholder — a unique index across those would block
-- all but the first such lead.
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_ip_address_unique
    ON public.leads (ip_address)
    WHERE ip_address IS NOT NULL AND ip_address <> 'unknown';
