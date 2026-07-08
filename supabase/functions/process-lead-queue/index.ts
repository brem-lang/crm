import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Delegates to distribute-lead — the single source of truth for advertiser
// eligibility, priority ordering, and adapters — instead of reimplementing
// selection here. distribute-lead does not set leads.status='rejected' on
// failure itself (that's the caller's responsibility, same as submit-lead).
// deno-lint-ignore no-explicit-any
async function processLead(supabase: any, supabaseUrl: string, supabaseServiceKey: string, leadId: string): Promise<{ success: boolean; error?: string }> {
  let result: { success?: boolean; message?: string } | null = null;
  let success = false;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/distribute-lead`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ lead_id: leadId }),
    });
    result = await response.json();
    success = result?.success === true;
  } catch (err) {
    console.error(`Error calling distribute-lead for lead ${leadId}:`, err);
    success = false;
  }

  if (!success) {
    await supabase.from('leads').update({ status: 'rejected' }).eq('id', leadId);
    return { success: false, error: result?.message || 'Distribution failed' };
  }

  return { success: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get batch size from request or default
    let batchSize = 50;
    let body: { batch_size?: number; health_check?: boolean } = {};
    try {
      body = await req.json();
      if (body.batch_size && typeof body.batch_size === 'number') {
        batchSize = Math.min(body.batch_size, 100); // Max 100 per batch
      }
    } catch {
      // No body or invalid JSON, use default
    }

    // Health check support
    if (body?.health_check === true) {
      return new Response(JSON.stringify({ status: "ok", function: "process-lead-queue" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Processing lead queue (batch size: ${batchSize})...`);

    // Atomically claim pending items via FOR UPDATE SKIP LOCKED.
    // Prevents two concurrent invocations from processing the same lead twice.
    const { data: queueItems, error: fetchError } = await supabase
      .rpc('claim_queue_items', { p_batch_size: batchSize });

    if (fetchError) {
      console.error('Error claiming queue items:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to claim queue items' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('No pending items in queue');
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Claimed ${queueItems.length} items to process`);

    // Process each lead
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const queueItem of queueItems) {
      const result = await processLead(supabase, supabaseUrl, supabaseServiceKey, queueItem.lead_id);
      processed++;

      if (result.success) {
        await supabase.from('lead_queue').update({
          status: 'completed',
          processed_at: new Date().toISOString(),
        }).eq('id', queueItem.id);
        succeeded++;
      } else {
        const newAttempts = queueItem.attempts + 1;
        if (newAttempts >= 3) {
          await supabase.from('lead_queue').update({
            status: 'failed',
            attempts: newAttempts,
            error_message: result.error,
            processed_at: new Date().toISOString(),
          }).eq('id', queueItem.id);
          failed++;
        } else {
          // Retry later
          await supabase.from('lead_queue').update({
            status: 'pending',
            attempts: newAttempts,
            error_message: result.error,
          }).eq('id', queueItem.id);
        }
      }
    }

    console.log(`Processed ${processed} leads: ${succeeded} succeeded, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        succeeded,
        failed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Queue processor error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
