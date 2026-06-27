-- Performance indexes: composite indexes for high-frequency query patterns.
-- Single-column indexes already exist; these composites let Postgres satisfy
-- multi-column WHERE/ORDER BY clauses with a single index scan.

-- ─── lead_distributions ──────────────────────────────────────────────────────

-- Dashboard + reporting: filter by status AND date range AND advertiser
CREATE INDEX IF NOT EXISTS idx_lead_distributions_status_created_advertiser
  ON public.lead_distributions(status, created_at DESC, advertiser_id);

-- Partial index for the most common case (sent leads reporting) — smaller, faster
CREATE INDEX IF NOT EXISTS idx_lead_distributions_sent_created_advertiser
  ON public.lead_distributions(created_at DESC, advertiser_id)
  WHERE status = 'sent';

-- Date-range queries without a status filter (e.g. "all distributions today")
CREATE INDEX IF NOT EXISTS idx_lead_distributions_created_at
  ON public.lead_distributions(created_at DESC);

-- ─── leads ───────────────────────────────────────────────────────────────────

-- distribute-lead filters by country_code for geo-routing rules
CREATE INDEX IF NOT EXISTS idx_leads_country_code
  ON public.leads(country_code);

-- Dashboard / affiliate reporting: date range scoped to one affiliate
CREATE INDEX IF NOT EXISTS idx_leads_created_at_affiliate
  ON public.leads(created_at DESC, affiliate_id);

-- ─── affiliate_api_logs ──────────────────────────────────────────────────────

-- Rate limiter (submit-lead/v2) counts rows by affiliate_id + created_at window.
-- Two separate single-column indexes force a bitmap AND scan; this composite
-- makes it a single index-only scan — critical since it runs on every API call.
CREATE INDEX IF NOT EXISTS idx_affiliate_api_logs_affiliate_created
  ON public.affiliate_api_logs(affiliate_id, created_at DESC);

-- ─── injection_leads ─────────────────────────────────────────────────────────

-- Injection dashboard date-range queries scoped to an advertiser
CREATE INDEX IF NOT EXISTS idx_injection_leads_advertiser_created
  ON public.injection_leads(advertiser_id, created_at DESC);

-- Injection detail page: list leads for one injection filtered by status
CREATE INDEX IF NOT EXISTS idx_injection_leads_injection_status_created
  ON public.injection_leads(injection_id, status, created_at DESC);

-- ─── callback_logs ───────────────────────────────────────────────────────────

-- Advertiser callback history: filter by advertiser + date range
CREATE INDEX IF NOT EXISTS idx_callback_logs_advertiser_created
  ON public.callback_logs(advertiser_id, created_at DESC);
