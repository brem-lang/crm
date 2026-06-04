-- audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text NULL,
  action text NOT NULL,
  table_name text NULL,
  record_id text NULL,
  old_data jsonb NULL,
  new_data jsonb NULL,
  changes_summary text NULL,
  ip_address text NULL,
  user_agent text NULL,
  request_path text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);

-- callback_logs
CREATE TABLE IF NOT EXISTS public.callback_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid NULL,
  injection_lead_id uuid NULL,
  advertiser_id uuid NULL REFERENCES public.advertisers(id) ON DELETE SET NULL,
  advertiser_name text NULL,
  callback_type text NOT NULL DEFAULT 'status_update',
  request_method text NOT NULL DEFAULT 'POST',
  request_url text NULL,
  request_headers jsonb NULL,
  request_payload jsonb NULL,
  request_raw text NULL,
  processing_status text NOT NULL DEFAULT 'pending',
  processing_error text NULL,
  processed_at timestamp with time zone NULL,
  matched_by text NULL,
  changes_applied jsonb NULL,
  ip_address text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT callback_logs_pkey PRIMARY KEY (id)
);

-- country_phone_prefixes
CREATE TABLE IF NOT EXISTS public.country_phone_prefixes (
  country_code text NOT NULL,
  phone_prefix text NOT NULL,
  phone_length_min integer NULL,
  phone_length_max integer NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT country_phone_prefixes_pkey PRIMARY KEY (country_code)
);

-- login_attempts
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  failure_reason text NULL,
  user_agent text NULL,
  country_code text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT login_attempts_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS login_attempts_email_ip_idx ON public.login_attempts(email, ip_address);

-- role_permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role text NOT NULL,
  permission_key text NOT NULL,
  permission_type text NOT NULL,
  is_granted boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT role_permissions_pkey PRIMARY KEY (id)
);

-- affiliate_submission_failures
CREATE TABLE IF NOT EXISTS public.affiliate_submission_failures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  affiliate_id uuid NULL REFERENCES public.affiliates(id) ON DELETE SET NULL,
  target_advertiser_id uuid NULL REFERENCES public.advertisers(id) ON DELETE SET NULL,
  email text NOT NULL,
  firstname text NULL,
  lastname text NULL,
  mobile text NULL,
  country_code text NULL,
  rejection_code text NOT NULL,
  rejection_message text NULL,
  raw_payload jsonb NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_submission_failures_pkey PRIMARY KEY (id)
);

-- affiliate_submission_stats
CREATE TABLE IF NOT EXISTS public.affiliate_submission_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  hour integer NOT NULL DEFAULT 0,
  lead_count integer NOT NULL DEFAULT 0,
  avg_hourly_rate numeric NULL,
  spike_detected boolean NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_submission_stats_pkey PRIMARY KEY (id),
  CONSTRAINT affiliate_submission_stats_unique UNIQUE (affiliate_id, date, hour)
);
