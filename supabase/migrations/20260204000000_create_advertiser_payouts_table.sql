-- Create advertiser_payouts table (base columns; deal_type and crg fields added by later migrations)
CREATE TABLE IF NOT EXISTS public.advertiser_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  advertiser_id uuid NOT NULL REFERENCES public.advertisers(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  payout numeric NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT advertiser_payouts_pkey PRIMARY KEY (id),
  CONSTRAINT advertiser_payouts_advertiser_id_country_code_key UNIQUE (advertiser_id, country_code)
);

ALTER TABLE public.advertiser_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins and managers can view advertiser payouts"
ON public.advertiser_payouts FOR SELECT
USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));

CREATE POLICY "Super admins can insert advertiser payouts"
ON public.advertiser_payouts FOR INSERT
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update advertiser payouts"
ON public.advertiser_payouts FOR UPDATE
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete advertiser payouts"
ON public.advertiser_payouts FOR DELETE
USING (is_super_admin(auth.uid()));
