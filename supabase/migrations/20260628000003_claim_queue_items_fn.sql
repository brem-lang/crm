-- Atomically claims pending queue items using FOR UPDATE SKIP LOCKED.
-- This prevents two concurrent process-lead-queue invocations from picking
-- up the same lead and distributing it twice.
CREATE OR REPLACE FUNCTION public.claim_queue_items(p_batch_size INT DEFAULT 50)
RETURNS TABLE(id UUID, lead_id UUID, attempts INT)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  UPDATE public.lead_queue
  SET status = 'processing'
  WHERE id IN (
    SELECT id
    FROM public.lead_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id, lead_id, attempts;
$$;
