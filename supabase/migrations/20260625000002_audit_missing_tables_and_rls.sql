-- 1. Add audit triggers for tables not previously covered
-- 2. Extend RLS SELECT policy to manager role + view_audit_logs permission holders

-- ── Missing table triggers ────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'distribution_rule_targets') THEN
    DROP TRIGGER IF EXISTS trg_audit_distribution_rule_targets ON public.distribution_rule_targets;
    CREATE TRIGGER trg_audit_distribution_rule_targets
      AFTER INSERT OR UPDATE OR DELETE ON public.distribution_rule_targets
      FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'injection_jobs') THEN
    DROP TRIGGER IF EXISTS trg_audit_injection_jobs ON public.injection_jobs;
    CREATE TRIGGER trg_audit_injection_jobs
      AFTER INSERT OR UPDATE OR DELETE ON public.injection_jobs
      FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'injection_leads') THEN
    DROP TRIGGER IF EXISTS trg_audit_injection_leads ON public.injection_leads;
    CREATE TRIGGER trg_audit_injection_leads
      AFTER INSERT OR UPDATE OR DELETE ON public.injection_leads
      FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lead_pools') THEN
    DROP TRIGGER IF EXISTS trg_audit_lead_pools ON public.lead_pools;
    CREATE TRIGGER trg_audit_lead_pools
      AFTER INSERT OR UPDATE OR DELETE ON public.lead_pools
      FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
  END IF;
END;
$$;

-- ── RLS: extend SELECT access ─────────────────────────────────────────────────

-- Drop the old super-admin-only policy and replace with a broader one
DROP POLICY IF EXISTS "audit_logs_select_super_admin" ON public.audit_logs;

-- Allow: super_admin OR manager OR any user whose role_permission_mappings include view_audit_logs
CREATE POLICY "audit_logs_select_authorized" ON public.audit_logs
  FOR SELECT USING (
    -- super_admin always allowed
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- manager role
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'manager'
    )
    OR
    -- any user whose assigned roles include view_audit_logs permission
    EXISTS (
      SELECT 1
      FROM public.user_custom_roles ucr
      JOIN public.role_permission_mappings rpm ON rpm.role_slug = (
        SELECT slug FROM public.roles WHERE id = ucr.role_id
      )
      WHERE ucr.user_id = auth.uid()
        AND rpm.permission_key = 'view_audit_logs'
    )
    OR
    -- direct per-user permission grant
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid() AND permission_key = 'view_audit_logs'
    )
  );
