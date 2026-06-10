-- Add overflow_option and timezone to advertiser_distribution_settings
ALTER TABLE public.advertiser_distribution_settings
  ADD COLUMN IF NOT EXISTS overflow_option TEXT NOT NULL DEFAULT 'next_advertiser'
    CHECK (overflow_option IN ('next_advertiser', 'reject')),
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

COMMENT ON COLUMN public.advertiser_distribution_settings.overflow_option IS 'What to do when all advertisers are unavailable: next_advertiser = try next, reject = reject lead';
COMMENT ON COLUMN public.advertiser_distribution_settings.timezone IS 'Timezone for working schedule evaluation (e.g. "Europe/London", "America/New_York")';

-- =====================================================
-- DISTRIBUTION RULES TABLE
-- =====================================================
CREATE TABLE public.distribution_rules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  rule_type    TEXT NOT NULL CHECK (rule_type IN ('priority', 'weighted', 'affiliate', 'geo')),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  priority     INTEGER NOT NULL DEFAULT 0,
  conditions   JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.distribution_rules.priority IS 'Lower = evaluated first';
COMMENT ON COLUMN public.distribution_rules.conditions IS 'IF block: {affiliate_ids: [], country_codes: [], language_codes: [], device_types: []}';

CREATE INDEX idx_distribution_rules_active_priority
  ON public.distribution_rules(is_active, priority);

ALTER TABLE public.distribution_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage distribution rules"
  ON public.distribution_rules FOR ALL
  USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

CREATE POLICY "Staff can view distribution rules"
  ON public.distribution_rules FOR SELECT
  USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()) OR is_agent(auth.uid()));

CREATE TRIGGER update_distribution_rules_updated_at
  BEFORE UPDATE ON public.distribution_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- DISTRIBUTION RULE TARGETS TABLE
-- =====================================================
CREATE TABLE public.distribution_rule_targets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id        UUID NOT NULL REFERENCES public.distribution_rules(id) ON DELETE CASCADE,
  advertiser_id  UUID NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  weight         INTEGER NOT NULL DEFAULT 100,
  priority_order INTEGER NOT NULL DEFAULT 1,
  is_fallback    BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (rule_id, advertiser_id)
);

CREATE INDEX idx_distribution_rule_targets_rule
  ON public.distribution_rule_targets(rule_id);

ALTER TABLE public.distribution_rule_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage distribution rule targets"
  ON public.distribution_rule_targets FOR ALL
  USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

CREATE POLICY "Staff can view distribution rule targets"
  ON public.distribution_rule_targets FOR SELECT
  USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()) OR is_agent(auth.uid()));
