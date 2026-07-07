-- Track which API endpoint each affiliate_api_logs row belongs to so rate limiting
-- can be scoped per endpoint instead of one shared bucket across submit-lead and get-leads.
ALTER TABLE affiliate_api_logs
  ADD COLUMN endpoint text NOT NULL DEFAULT 'submit-lead';

CREATE INDEX IF NOT EXISTS idx_affiliate_api_logs_endpoint_affiliate_created
  ON affiliate_api_logs (endpoint, affiliate_id, created_at);

CREATE INDEX IF NOT EXISTS idx_affiliate_api_logs_endpoint_ip_created
  ON affiliate_api_logs (endpoint, request_ip, created_at)
  WHERE affiliate_id IS NULL;
