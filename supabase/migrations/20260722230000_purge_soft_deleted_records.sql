-- Daily job to permanently remove soft-deleted leads/affiliates/advertisers
-- once they've been soft-deleted for more than 24 hours — long enough for
-- the parent CRM's since-based incremental sync to have observed the
-- deletion via get-all-leads/affiliates/advertisers. Only rows with
-- deleted_at set and older than the grace period are ever touched; active
-- rows are never affected.

CREATE OR REPLACE FUNCTION public.purge_soft_deleted_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_leads_count integer;
  v_affiliates_count integer;
  v_advertisers_count integer;
BEGIN
  -- leads first: FK cascades clear lead_distributions/lead_status_history/etc.
  DELETE FROM public.leads
    WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '24 hours';
  GET DIAGNOSTICS v_leads_count = ROW_COUNT;

  DELETE FROM public.affiliates
    WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '24 hours';
  GET DIAGNOSTICS v_affiliates_count = ROW_COUNT;

  DELETE FROM public.advertisers
    WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '24 hours';
  GET DIAGNOSTICS v_advertisers_count = ROW_COUNT;

  IF v_leads_count > 0 OR v_affiliates_count > 0 OR v_advertisers_count > 0 THEN
    INSERT INTO public.audit_logs (action, table_name, changes_summary)
    VALUES (
      'purge',
      'leads,affiliates,advertisers',
      format(
        'Purged soft-deleted records older than 24h: %s leads, %s affiliates, %s advertisers',
        v_leads_count, v_affiliates_count, v_advertisers_count
      )
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_soft_deleted_records() FROM public;

SELECT cron.schedule(
  'purge-soft-deleted-records',
  '0 3 * * *',
  'SELECT public.purge_soft_deleted_records();'
);
