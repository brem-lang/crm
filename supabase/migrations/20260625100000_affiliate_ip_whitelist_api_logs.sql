-- Add IP whitelist fields to affiliates
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS ip_whitelist_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allowed_ips TEXT[] NOT NULL DEFAULT '{}';

-- New table: affiliate_api_logs
CREATE TABLE IF NOT EXISTS public.affiliate_api_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id  UUID REFERENCES public.affiliates(id) ON DELETE SET NULL,
  api_key_hint  TEXT,
  request_ip    TEXT,
  payload       JSONB,
  status        TEXT NOT NULL CHECK (status IN ('accepted', 'rejected')),
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can read affiliate api logs"
  ON public.affiliate_api_logs FOR SELECT
  USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS affiliate_api_logs_affiliate_id_idx ON public.affiliate_api_logs (affiliate_id);
CREATE INDEX IF NOT EXISTS affiliate_api_logs_created_at_idx ON public.affiliate_api_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS affiliate_api_logs_status_idx ON public.affiliate_api_logs (status);
