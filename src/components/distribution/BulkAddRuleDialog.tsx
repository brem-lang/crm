import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { countryData } from "@/components/advertisers/countryData";
import { useRestrictedCountries } from "@/hooks/useRestrictedCountries";
import { useBulkCreateDistributionRules } from "@/hooks/useAffiliateDistributionRules";
import { Search, X } from "lucide-react";

interface Advertiser {
  id: string;
  name: string;
  is_active: boolean;
}

interface Affiliate {
  id: string;
  name: string;
  is_active?: boolean;
}

interface BulkAddRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  affiliates: Affiliate[];
  advertisers: Advertiser[];
  // Existing rules across ALL affiliates, used to skip duplicates for whichever
  // affiliates end up selected in this dialog.
  existingRules: Array<{ affiliate_id: string; country_code: string; advertiser_id: string }>;
  // Optional: pre-select a single affiliate when opened from an affiliate-scoped context.
  initialAffiliateId?: string;
}

export function BulkAddRuleDialog({
  open,
  onOpenChange,
  affiliates,
  advertisers,
  existingRules,
  initialAffiliateId,
}: BulkAddRuleDialogProps) {
  const [selectedAffiliates, setSelectedAffiliates] = useState<Set<string>>(
    () => new Set(initialAffiliateId ? [initialAffiliateId] : [])
  );
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [selectedAdvertisers, setSelectedAdvertisers] = useState<Set<string>>(new Set());
  const [affiliateSearch, setAffiliateSearch] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [advertiserSearch, setAdvertiserSearch] = useState("");

  const bulkCreate = useBulkCreateDistributionRules();
  const { isRestricted } = useRestrictedCountries();

  // Filter active advertisers
  const activeAdvertisers = useMemo(
    () => advertisers.filter((a) => a.is_active),
    [advertisers]
  );

  const activeAffiliates = useMemo(
    () => affiliates.filter((a) => a.is_active !== false),
    [affiliates]
  );

  // Filter affiliates by search
  const filteredAffiliates = useMemo(() => {
    const search = affiliateSearch.toLowerCase();
    return activeAffiliates.filter((a) => a.name.toLowerCase().includes(search));
  }, [affiliateSearch, activeAffiliates]);

  // Filter countries by search, excluding restricted countries entirely
  const filteredCountries = useMemo(() => {
    const search = countrySearch.toLowerCase();
    // Exactly 2 characters is unambiguously a country code (all codes are 2
    // letters) — match the code only, so "es" means Spain and not also
    // Eswatini/Estonia just because their names start with "Es". Anything
    // longer is a name search (no code is longer than 2 letters anyway).
    return Object.entries(countryData).filter(([code, country]) => {
      if (isRestricted(code)) return false;
      if (search.length === 2) return code.toLowerCase() === search;
      return code.toLowerCase().startsWith(search) || country.name.toLowerCase().startsWith(search);
    });
  }, [countrySearch, isRestricted]);

  // Filter advertisers by search
  const filteredAdvertisers = useMemo(() => {
    const search = advertiserSearch.toLowerCase();
    return activeAdvertisers.filter((a) =>
      a.name.toLowerCase().includes(search)
    );
  }, [advertiserSearch, activeAdvertisers]);

  // Calculate how many rules will be created (excluding duplicates)
  const { totalRules, newRules, duplicateCount } = useMemo(() => {
    const existingSet = new Set(
      existingRules.map((r) => `${r.affiliate_id}:${r.country_code}:${r.advertiser_id}`)
    );

    let newCount = 0;
    let dupCount = 0;

    selectedAffiliates.forEach((affiliate) => {
      selectedCountries.forEach((country) => {
        selectedAdvertisers.forEach((advertiser) => {
          const key = `${affiliate}:${country}:${advertiser}`;
          if (existingSet.has(key)) {
            dupCount++;
          } else {
            newCount++;
          }
        });
      });
    });

    return {
      totalRules: selectedAffiliates.size * selectedCountries.size * selectedAdvertisers.size,
      newRules: newCount,
      duplicateCount: dupCount,
    };
  }, [selectedAffiliates, selectedCountries, selectedAdvertisers, existingRules]);

  const handleAffiliateToggle = (id: string) => {
    setSelectedAffiliates((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllAffiliates = () => {
    setSelectedAffiliates(new Set(filteredAffiliates.map((a) => a.id)));
  };

  const handleClearAffiliates = () => {
    setSelectedAffiliates(new Set());
  };

  const handleCountryToggle = (code: string) => {
    setSelectedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const handleAdvertiserToggle = (id: string) => {
    setSelectedAdvertisers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllCountries = () => {
    setSelectedCountries(new Set(filteredCountries.map(([code]) => code)));
  };

  const handleClearCountries = () => {
    setSelectedCountries(new Set());
  };

  const handleSelectAllAdvertisers = () => {
    setSelectedAdvertisers(new Set(filteredAdvertisers.map((a) => a.id)));
  };

  const handleClearAdvertisers = () => {
    setSelectedAdvertisers(new Set());
  };

  const handleSubmit = () => {
    if (newRules === 0) return;

    const existingSet = new Set(
      existingRules.map((r) => `${r.affiliate_id}:${r.country_code}:${r.advertiser_id}`)
    );

    const rulesToCreate: Array<{
      affiliate_id: string;
      country_code: string;
      advertiser_id: string;
      is_active: boolean;
    }> = [];

    selectedAffiliates.forEach((affiliate) => {
      selectedCountries.forEach((country) => {
        selectedAdvertisers.forEach((advertiser) => {
          const key = `${affiliate}:${country}:${advertiser}`;
          if (!existingSet.has(key)) {
            rulesToCreate.push({
              affiliate_id: affiliate,
              country_code: country,
              advertiser_id: advertiser,
              is_active: true,
            });
          }
        });
      });
    });

    bulkCreate.mutate(rulesToCreate, {
      onSuccess: () => {
        onOpenChange(false);
        resetForm();
      },
    });
  };

  const resetForm = () => {
    setSelectedAffiliates(new Set(initialAffiliateId ? [initialAffiliateId] : []));
    setSelectedCountries(new Set());
    setSelectedAdvertisers(new Set());
    setAffiliateSearch("");
    setCountrySearch("");
    setAdvertiserSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Add Distribution Rules</DialogTitle>
          <DialogDescription>
            Select multiple affiliates, countries, and advertisers to create rules for all combinations.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-1 sm:grid-cols-3 gap-4 py-4">
          {/* Affiliates Selection */}
          <div className="flex flex-col space-y-2">
            <Label className="font-semibold">Affiliates</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search affiliates..."
                value={affiliateSearch}
                onChange={(e) => setAffiliateSearch(e.target.value)}
                className="pl-8"
              />
              {affiliateSearch && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-7 w-7"
                  onClick={() => setAffiliateSearch("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSelectAllAffiliates}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearAffiliates}>
                Clear
              </Button>
              <span className="ml-auto text-sm text-muted-foreground">
                {selectedAffiliates.size} selected
              </span>
            </div>
            <ScrollArea className="h-48 border rounded-md">
              <div className="p-2 space-y-1">
                {filteredAffiliates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No active affiliates found
                  </p>
                ) : (
                  filteredAffiliates.map((affiliate) => (
                    <label
                      key={affiliate.id}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedAffiliates.has(affiliate.id)}
                        onCheckedChange={() => handleAffiliateToggle(affiliate.id)}
                      />
                      <span className="text-sm truncate">{affiliate.name}</span>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Countries Selection */}
          <div className="flex flex-col space-y-2">
            <Label className="font-semibold">Countries</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search countries..."
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                className="pl-8"
              />
              {countrySearch && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-7 w-7"
                  onClick={() => setCountrySearch("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSelectAllCountries}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearCountries}>
                Clear
              </Button>
              <span className="ml-auto text-sm text-muted-foreground">
                {selectedCountries.size} selected
              </span>
            </div>
            <ScrollArea className="h-48 border rounded-md">
              <div className="p-2 space-y-1">
                {filteredCountries.map(([code, country]) => (
                  <label
                    key={code}
                    className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedCountries.has(code)}
                      onCheckedChange={() => handleCountryToggle(code)}
                    />
                    <span className="font-mono text-sm">{code}</span>
                    <span className="text-sm text-muted-foreground truncate">
                      {country.name}
                    </span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Advertisers Selection */}
          <div className="flex flex-col space-y-2">
            <Label className="font-semibold">Advertisers</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search advertisers..."
                value={advertiserSearch}
                onChange={(e) => setAdvertiserSearch(e.target.value)}
                className="pl-8"
              />
              {advertiserSearch && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-7 w-7"
                  onClick={() => setAdvertiserSearch("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSelectAllAdvertisers}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearAdvertisers}>
                Clear
              </Button>
              <span className="ml-auto text-sm text-muted-foreground">
                {selectedAdvertisers.size} selected
              </span>
            </div>
            <ScrollArea className="h-48 border rounded-md">
              <div className="p-2 space-y-1">
                {filteredAdvertisers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No active advertisers found
                  </p>
                ) : (
                  filteredAdvertisers.map((advertiser) => (
                    <label
                      key={advertiser.id}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedAdvertisers.has(advertiser.id)}
                        onCheckedChange={() => handleAdvertiserToggle(advertiser.id)}
                      />
                      <span className="text-sm">{advertiser.name}</span>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Preview */}
        {totalRules > 0 && (
          <div className="border-t pt-4">
            <p className="text-sm">
              Will create <strong>{newRules}</strong> rule{newRules !== 1 && "s"}
              {duplicateCount > 0 && (
                <span className="text-muted-foreground">
                  {" "}({duplicateCount} already exist and will be skipped)
                </span>
              )}
            </p>
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={newRules === 0 || bulkCreate.isPending}
          >
            {bulkCreate.isPending
              ? "Creating..."
              : `Add ${newRules} Rule${newRules !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
