-- Live Lead Scoring: add click/submission intelligence + score columns to leads table

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS click_ip           TEXT,
  ADD COLUMN IF NOT EXISTS click_country      TEXT,
  ADD COLUMN IF NOT EXISTS click_asn          TEXT,
  ADD COLUMN IF NOT EXISTS submission_country TEXT,
  ADD COLUMN IF NOT EXISTS submission_asn     TEXT,
  ADD COLUMN IF NOT EXISTS click_ua           TEXT,
  ADD COLUMN IF NOT EXISTS time_to_click      INTEGER,
  ADD COLUMN IF NOT EXISTS is_proxy           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_lead_score    INTEGER,
  ADD COLUMN IF NOT EXISTS live_lead_status   TEXT;

-- Constrain live_lead_status to known values (wrap in DO block for idempotency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_live_lead_status_check'
      AND conrelid = 'public.leads'::regclass
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_live_lead_status_check
      CHECK (live_lead_status IS NULL OR live_lead_status IN ('green', 'orange', 'light-red', 'red'));
  END IF;
END;
$$;

-- Index for filtering by live_lead_status (common query)
CREATE INDEX IF NOT EXISTS idx_leads_live_lead_status ON public.leads (live_lead_status);
