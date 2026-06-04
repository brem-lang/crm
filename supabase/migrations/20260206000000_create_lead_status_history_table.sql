-- Create lead_status_history table (referenced by trigger in migration 20260207130111)
CREATE TABLE IF NOT EXISTS public.lead_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  injection_lead_id uuid NULL REFERENCES public.injection_leads(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value text NULL,
  new_value text NULL,
  change_source text NOT NULL DEFAULT 'manual',
  changed_by text NULL,
  change_reason text NULL,
  ip_address text NULL,
  user_agent text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lead_status_history_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS lead_status_history_lead_id_idx ON public.lead_status_history(lead_id);
CREATE INDEX IF NOT EXISTS lead_status_history_injection_lead_id_idx ON public.lead_status_history(injection_lead_id);
