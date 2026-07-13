import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ResendableLead {
  id: string;
  affiliate_id: string | null;
  firstname: string;
  lastname: string;
  email: string;
  mobile: string;
  country_code: string;
  country?: string | null;
  ip_address?: string | null;
  custom1?: string | null;
  custom2?: string | null;
  custom3?: string | null;
  custom4?: string | null;
  custom5?: string | null;
  offer_name?: string | null;
  comment?: string | null;
  city?: string | null;
  user_agent?: string | null;
  platform?: string | null;
  browser?: string | null;
  click_ip?: string | null;
  click_country?: string | null;
  click_asn?: string | null;
  submission_country?: string | null;
  submission_asn?: string | null;
  click_ua?: string | null;
  time_to_click?: number | null;
  is_proxy?: boolean | null;
  locale?: string | null;
  click_id?: string | null;
  submission_ua?: string | null;
  lead_distributions?: Array<{ advertiser_id: string; status?: string; advertisers?: { name: string } }>;
}

interface ResendLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLeads: ResendableLead[];
  advertisers: Array<{ id: string; name: string }>;
  affiliates: Array<{ id: string; name: string }>;
  onSuccess: () => void;
}

// Fields copied onto the cloned lead — everything describing the person/
// submission, but not lifecycle/tracking state (id, status, distributed_at,
// timestamps, is_ftd, etc.), which all reset via DB defaults just like an
// organic submission.
function buildCloneInsert(lead: ResendableLead, affiliateId: string) {
  return {
    firstname: lead.firstname,
    lastname: lead.lastname,
    email: lead.email,
    mobile: lead.mobile,
    country_code: lead.country_code,
    country: lead.country ?? null,
    ip_address: lead.ip_address ?? null,
    affiliate_id: affiliateId,
    custom1: lead.custom1 ?? null,
    custom2: lead.custom2 ?? null,
    custom3: lead.custom3 ?? null,
    custom4: lead.custom4 ?? null,
    custom5: lead.custom5 ?? null,
    offer_name: lead.offer_name ?? null,
    comment: lead.comment ?? null,
    city: lead.city ?? null,
    user_agent: lead.user_agent ?? null,
    platform: lead.platform ?? null,
    browser: lead.browser ?? null,
    click_ip: lead.click_ip ?? null,
    click_country: lead.click_country ?? null,
    click_asn: lead.click_asn ?? null,
    submission_country: lead.submission_country ?? null,
    submission_asn: lead.submission_asn ?? null,
    click_ua: lead.click_ua ?? null,
    time_to_click: lead.time_to_click ?? null,
    is_proxy: lead.is_proxy ?? null,
    locale: lead.locale ?? null,
    click_id: lead.click_id ?? null,
    submission_ua: lead.submission_ua ?? null,
  };
}

export function ResendLeadsDialog({
  open,
  onOpenChange,
  selectedLeads,
  advertisers,
  affiliates,
  onSuccess,
}: ResendLeadsDialogProps) {
  const [selectedAdvertiserId, setSelectedAdvertiserId] = useState<string>("");
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Every selected lead's own affiliate/advertiser history — the resend
  // target must differ from both, for every selected lead.
  const excludedAffiliateIds = useMemo(
    () => new Set(selectedLeads.map(l => l.affiliate_id).filter(Boolean) as string[]),
    [selectedLeads]
  );
  const excludedAdvertiserIds = useMemo(
    () => new Set(selectedLeads.flatMap(l => (l.lead_distributions ?? []).map(d => d.advertiser_id).filter(Boolean))),
    [selectedLeads]
  );
  const availableAffiliates = useMemo(
    () => affiliates.filter(a => !excludedAffiliateIds.has(a.id)),
    [affiliates, excludedAffiliateIds]
  );
  const availableAdvertisers = useMemo(
    () => advertisers.filter(a => !excludedAdvertiserIds.has(a.id)),
    [advertisers, excludedAdvertiserIds]
  );

  const canResend = selectedLeads.length > 0 && availableAffiliates.length > 0 && availableAdvertisers.length > 0;

  const handleResend = async () => {
    if (!selectedAdvertiserId || !selectedAffiliateId) {
      toast.error("Please select both an affiliate and an advertiser");
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const lead of selectedLeads) {
        // Defensive: never resend to the same affiliate/advertiser this lead already had.
        if (
          lead.affiliate_id === selectedAffiliateId ||
          lead.lead_distributions?.some(d => d.advertiser_id === selectedAdvertiserId)
        ) {
          errorCount++;
          continue;
        }

        const { data: newLead, error: insertError } = await supabase
          .from('leads')
          .insert(buildCloneInsert(lead, selectedAffiliateId))
          .select('id')
          .single();

        if (insertError || !newLead) {
          console.error(`Failed to clone lead ${lead.id}:`, insertError);
          errorCount++;
          continue;
        }

        const { error: distError } = await supabase.functions.invoke('distribute-lead', {
          body: {
            lead_id: newLead.id,
            advertiser_id: selectedAdvertiserId,
          },
        });

        if (distError) {
          console.error(`Failed to distribute cloned lead ${newLead.id}:`, distError);
          errorCount++;
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Resent ${successCount} lead${successCount > 1 ? 's' : ''} as new lead${successCount > 1 ? 's' : ''}`);
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
          <DialogTitle>Resend as New Lead</DialogTitle>
          <DialogDescription>
            Resend {selectedLeads.length} lead{selectedLeads.length !== 1 ? 's' : ''} as new lead{selectedLeads.length !== 1 ? 's' : ''} under a different affiliate and advertiser. The original lead{selectedLeads.length !== 1 ? 's are' : ' is'} left unchanged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Affiliate</Label>
            <Select value={selectedAffiliateId} onValueChange={setSelectedAffiliateId} disabled={availableAffiliates.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder="Choose affiliate..." />
              </SelectTrigger>
              <SelectContent>
                {availableAffiliates.map((aff) => (
                  <SelectItem key={aff.id} value={aff.id}>
                    {aff.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableAffiliates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Every affiliate is already attributed to the selected lead(s).
              </p>
            )}
          </div>

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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleResend} disabled={isSubmitting || !canResend || !selectedAdvertiserId || !selectedAffiliateId}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Resend {selectedLeads.length} Lead{selectedLeads.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
