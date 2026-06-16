-- System-wide CRM settings — single row pattern (id = 1 enforced)
CREATE TABLE IF NOT EXISTS public.crm_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- General
  crm_name              text        NOT NULL DEFAULT 'CRM',
  timezone              text        NOT NULL DEFAULT 'UTC',
  date_format           text        NOT NULL DEFAULT 'yyyy-MM-dd HH:mm:ss',
  default_page_size     integer     NOT NULL DEFAULT 25,
  show_lead_id          boolean     NOT NULL DEFAULT true,
  compact_mode          boolean     NOT NULL DEFAULT false,
  auto_refresh_interval integer     NOT NULL DEFAULT 0,

  -- Lead Management
  duplicate_detection_enabled boolean NOT NULL DEFAULT false,
  duplicate_window_days       integer NOT NULL DEFAULT 30,
  duplicate_match_field       text    NOT NULL DEFAULT 'email', -- 'email' | 'phone' | 'both'

  -- Distribution
  distribution_enabled  boolean NOT NULL DEFAULT true,
  default_daily_cap     integer NOT NULL DEFAULT 0, -- 0 = unlimited

  -- Affiliates
  affiliate_self_registration boolean NOT NULL DEFAULT false,
  affiliate_default_status    text    NOT NULL DEFAULT 'active',

  -- Users & Security
  user_self_registration  boolean NOT NULL DEFAULT false,
  max_login_attempts      integer NOT NULL DEFAULT 0, -- 0 = unlimited
  session_timeout_minutes integer NOT NULL DEFAULT 0, -- 0 = never

  -- System
  maintenance_mode    boolean NOT NULL DEFAULT false,
  maintenance_message text    NOT NULL DEFAULT 'System is under maintenance. Please check back later.',
  audit_log_retention_days integer NOT NULL DEFAULT 0, -- 0 = forever

  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Seed the single row
INSERT INTO public.crm_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_settings_select_authenticated" ON public.crm_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "crm_settings_update_super_admin" ON public.crm_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );
