-- Strict try-order within a tier (Primary/Fallback), separate from weight (which only
-- biases the random pick among same-priority rows). 0 = tried first, matching the
-- convention used by the old (retired) generic distribution_rules.priority field.
-- Default 100 for every row means untouched rules all tie and behavior is unchanged
-- from today's pure weighted-random selection.
ALTER TABLE affiliate_distribution_rules
  ADD COLUMN priority integer NOT NULL DEFAULT 100;
