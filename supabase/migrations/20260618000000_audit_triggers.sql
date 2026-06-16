-- Comprehensive audit logging: triggers, indexes, RLS
-- Covers all key tables so super admin sees every change in the system

-- Make user_id nullable to support system/edge-function events (no internal user)
ALTER TABLE public.audit_logs ALTER COLUMN user_id DROP NOT NULL;

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can read everything
CREATE POLICY "audit_logs_select_super_admin" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Authenticated users can insert their own logs (client-side hook)
CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Service role (edge functions) can insert with user_id = null
CREATE POLICY "audit_logs_insert_system" ON public.audit_logs
  FOR INSERT WITH CHECK (user_id IS NULL);

-- ── Generic trigger function ──────────────────────────────────────────────────
-- Uses row_to_json to safely extract 'id' even on tables without that column.
-- Strips sensitive keys from stored data.
CREATE OR REPLACE FUNCTION public.fn_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_data  jsonb;
  v_new_data  jsonb;
  v_record_id text;
  v_summary   text;
  v_row_json  jsonb;
BEGIN
  -- Determine record id dynamically (works even without an 'id' column)
  IF TG_OP = 'DELETE' THEN
    v_row_json  := to_jsonb(OLD);
    v_old_data  := v_row_json - 'password' - 'api_key' - 'service_key' - 'secret';
    v_new_data  := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_row_json  := to_jsonb(NEW);
    v_old_data  := NULL;
    v_new_data  := v_row_json - 'password' - 'api_key' - 'service_key' - 'secret';
  ELSE -- UPDATE
    v_old_data  := to_jsonb(OLD) - 'password' - 'api_key' - 'service_key' - 'secret';
    v_new_data  := to_jsonb(NEW) - 'password' - 'api_key' - 'service_key' - 'secret';
    v_row_json  := to_jsonb(NEW);
  END IF;

  v_record_id := v_row_json ->> 'id';

  v_summary := CASE TG_OP
    WHEN 'INSERT' THEN 'Created record in ' || TG_TABLE_NAME
    WHEN 'UPDATE' THEN 'Updated record in ' || TG_TABLE_NAME
    WHEN 'DELETE' THEN 'Deleted record from ' || TG_TABLE_NAME
  END;

  INSERT INTO public.audit_logs (
    user_id, action, table_name, record_id, old_data, new_data, changes_summary
  ) VALUES (
    auth.uid(),
    lower(TG_OP),
    TG_TABLE_NAME,
    v_record_id,
    v_old_data,
    v_new_data,
    v_summary
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── Specialised function for user_roles (no 'id' col, human-readable summary) ─
CREATE OR REPLACE FUNCTION public.fn_audit_log_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id, action, table_name, record_id, old_data, new_data, changes_summary
  ) VALUES (
    auth.uid(),
    lower(TG_OP),
    'user_roles',
    CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id::text ELSE NEW.user_id::text END,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
    CASE TG_OP
      WHEN 'INSERT' THEN 'Assigned role ' || NEW.role || ' to user ' || NEW.user_id::text
      WHEN 'DELETE' THEN 'Removed role ' || OLD.role || ' from user ' || OLD.user_id::text
    END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── Specialised function for user_custom_roles ────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_audit_log_user_custom_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id, action, table_name, record_id, old_data, new_data, changes_summary
  ) VALUES (
    auth.uid(),
    lower(TG_OP),
    'user_custom_roles',
    CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id::text ELSE NEW.user_id::text END,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
    CASE TG_OP
      WHEN 'INSERT' THEN 'Assigned custom role ' || NEW.role_id::text || ' to user ' || NEW.user_id::text
      WHEN 'DELETE' THEN 'Removed custom role ' || OLD.role_id::text || ' from user ' || OLD.user_id::text
    END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── Attach triggers ───────────────────────────────────────────────────────────

-- leads
DROP TRIGGER IF EXISTS trg_audit_leads ON public.leads;
CREATE TRIGGER trg_audit_leads
  AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- advertisers
DROP TRIGGER IF EXISTS trg_audit_advertisers ON public.advertisers;
CREATE TRIGGER trg_audit_advertisers
  AFTER INSERT OR UPDATE OR DELETE ON public.advertisers
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- affiliates
DROP TRIGGER IF EXISTS trg_audit_affiliates ON public.affiliates;
CREATE TRIGGER trg_audit_affiliates
  AFTER INSERT OR UPDATE OR DELETE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- profiles
DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- user_roles
DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_user_roles();

-- user_custom_roles
DROP TRIGGER IF EXISTS trg_audit_user_custom_roles ON public.user_custom_roles;
CREATE TRIGGER trg_audit_user_custom_roles
  AFTER INSERT OR DELETE ON public.user_custom_roles
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_user_custom_roles();

-- distribution_rules
DROP TRIGGER IF EXISTS trg_audit_distribution_rules ON public.distribution_rules;
CREATE TRIGGER trg_audit_distribution_rules
  AFTER INSERT OR UPDATE OR DELETE ON public.distribution_rules
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- advertiser_distribution_settings
DROP TRIGGER IF EXISTS trg_audit_adv_dist_settings ON public.advertiser_distribution_settings;
CREATE TRIGGER trg_audit_adv_dist_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.advertiser_distribution_settings
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- crm_settings (table may not exist in all deployments)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'crm_settings') THEN
    DROP TRIGGER IF EXISTS trg_audit_crm_settings ON public.crm_settings;
    CREATE TRIGGER trg_audit_crm_settings
      AFTER UPDATE ON public.crm_settings
      FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
  END IF;
END;
$$;

-- roles
DROP TRIGGER IF EXISTS trg_audit_roles ON public.roles;
CREATE TRIGGER trg_audit_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- role_permission_mappings
DROP TRIGGER IF EXISTS trg_audit_role_permission_mappings ON public.role_permission_mappings;
CREATE TRIGGER trg_audit_role_permission_mappings
  AFTER INSERT OR DELETE ON public.role_permission_mappings
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- user_permissions
DROP TRIGGER IF EXISTS trg_audit_user_permissions ON public.user_permissions;
CREATE TRIGGER trg_audit_user_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
