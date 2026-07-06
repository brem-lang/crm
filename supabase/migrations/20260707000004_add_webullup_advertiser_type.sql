-- Add "We Bull Up" (trading.we-bull-up.com) as a new advertiser type.
-- Unrelated to the existing "saxo" (SAXO LTD) type despite the source doc's filename.
ALTER TYPE public.advertiser_type ADD VALUE IF NOT EXISTS 'webullup';
