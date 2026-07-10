import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ResendLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLeads: Array<{
    id: string;
    email: string;
    firstname: string;
    lastname: string;
    mobile: string;
    country_code: string;
    lead_distributions?: Array<{ advertiser_id: string; status?: string; advertisers?: { name: string } }>;
  }>;
  advertisers: Array<{ id: string; name: string }>;
  onSuccess: () => void;
}

export function ResendLeadsDialog({
  open,
  onOpenChange,
  selectedLeads,
  advertisers,
  onSuccess,
}: ResendLeadsDialogProps) {
  const [selectedAdvertiserId, setSelectedAdvertiserId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Leads that already have a successful delivery don't need (and can't) be
  // resent — resend only makes sense for leads whose attempts so far failed.
  const eligibleLeads = useMemo(
    () => selectedLeads.filter(lead => !lead.lead_distributions?.some(d => d.status === "sent")),
    [selectedLeads]
  );
  const alreadyDeliveredCount = selectedLeads.length - eligibleLeads.length;

  // Advertisers already tried (any status) by any eligible lead can't be
  // picked again — resend must always go to a different advertiser.
  const triedAdvertiserIds = useMemo(
    () => new Set(eligibleLeads.flatMap(l => (l.lead_distributions ?? []).map(d => d.advertiser_id).filter(Boolean))),
    [eligibleLeads]
  );
  const availableAdvertisers = useMemo(
    () => advertisers.filter(a => !triedAdvertiserIds.has(a.id)),
    [advertisers, triedAdvertiserIds]
  );

  const canResend = eligibleLeads.length > 0 && availableAdvertisers.length > 0;

  const handleResend = async () => {
    if (!selectedAdvertiserId) {
      toast.error("Please select an advertiser");
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const lead of eligibleLeads) {
        // Defensive: never resend to an advertiser this lead already went to.
        if (lead.lead_distributions?.some(d => d.advertiser_id === selectedAdvertiserId)) {
          errorCount++;
          continue;
        }

        // Call distribute-lead edge function to resend
        const { error } = await supabase.functions.invoke('distribute-lead', {
          body: {
            lead_id: lead.id,
            force_advertiser_id: selectedAdvertiserId,
            is_resend: true,
          },
        });

        if (error) {
          console.error(`Failed to resend lead ${lead.id}:`, error);
          errorCount++;
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully resent ${successCount} lead${successCount > 1 ? 's' : ''}`);
        onSuccess();
        onOpenChange(false);
      }

      if (errorCount > 0) {
        toast.error(`Failed to resend ${errorCount} lead${errorCount > 1 ? 's' : ''}`);
      }
    } catch (error) {
      console.error("Resend error:", error);
      toast.error("Failed to resend leads");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resend to a Different Advertiser</DialogTitle>
          <DialogDescription>
            Resend {eligibleLeads.length} lead{eligibleLeads.length !== 1 ? 's' : ''} to an advertiser they haven't been sent to yet.
            {alreadyDeliveredCount > 0 && (
              <span className="block mt-1 text-xs">
                {alreadyDeliveredCount} selected lead{alreadyDeliveredCount > 1 ? 's were' : ' was'} already delivered successfully and will be skipped.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {eligibleLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              All selected leads have already been delivered successfully — there's nothing to resend.
            </p>
          ) : (
            <div className="space-y-2">
              <Label>Select Advertiser</Label>
              <Select value={selectedAdvertiserId} onValueChange={setSelectedAdvertiserId} disabled={availableAdvertisers.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose advertiser..." />
                </SelectTrigger>
                <SelectContent>
                  {availableAdvertisers.map((adv) => (
                    <SelectItem key={adv.id} value={adv.id}>
                      {adv.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableAdvertisers.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Every advertiser has already been tried for the selected lead(s).
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleResend} disabled={isSubmitting || !canResend || !selectedAdvertiserId}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Resend {eligibleLeads.length} Lead{eligibleLeads.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
