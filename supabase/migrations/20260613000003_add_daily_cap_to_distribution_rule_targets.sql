ALTER TABLE public.distribution_rule_targets
  ADD COLUMN IF NOT EXISTS daily_cap INTEGER NULL;
