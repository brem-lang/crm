-- Add allow_resend_same_advertiser flag to injections
-- When enabled, the 5-day same-advertiser cooldown and cross-system duplicate
-- protection are bypassed, allowing the same lead to be resent to the same
-- advertiser (useful when the advertiser internally re-distributes to their own sub-advertisers)
ALTER TABLE injections
  ADD COLUMN IF NOT EXISTS allow_resend_same_advertiser boolean NOT NULL DEFAULT false;
