import { getCountryList } from "@/components/advertisers/countryData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  DistributionRule,
  RuleConditions,
  RuleTarget,
  RuleType,
} from "@/hooks/useDistributionRules";
import { ArrowDown, Check, ChevronsUpDown, GripVertical, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

interface Advertiser {
  id: string;
  name: string;
  is_active: boolean;
}

interface Affiliate {
  id: string;
  name: string;
  is_active: boolean;
}

interface RuleBuilderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  advertisers: Advertiser[];
  affiliates: Affiliate[];
  initialRule?: DistributionRule | null;
  onSave: (rule: {
    name: string;
    rule_type: RuleType;
    priority: number;
    conditions: RuleConditions;
    targets: RuleTarget[];
  }) => void;
  isSaving: boolean;
}

const RULE_TYPE_LABELS: Record<RuleType, string> = {
  priority: "Priority Routing",
  weighted: "Weighted Routing",
  affiliate: "Affiliate-Based Routing",
  geo: "GEO-Based Routing",
};

interface TargetRow extends RuleTarget {
  _key: string;
}

function newTargetKey() {
  return Math.random().toString(36).slice(2);
}

export function RuleBuilderSheet({
  open,
  onOpenChange,
  advertisers,
  affiliates,
  initialRule,
  onSave,
  isSaving,
}: RuleBuilderSheetProps) {
  const [name, setName] = useState("");
  const [ruleType, setRuleType] = useState<RuleType>("priority");
  const [priority, setPriority] = useState(0);
  const [conditions, setConditions] = useState<RuleConditions>({});
  const [targets, setTargets] = useState<TargetRow[]>([]);

  useEffect(() => {
    if (!open) return;
    if (initialRule) {
      setName(initialRule.name);
      setRuleType(initialRule.rule_type);
      setPriority(initialRule.priority);
      setConditions(initialRule.conditions ?? {});
      setTargets(
        (initialRule.targets || []).map((t) => ({
          ...t,
          _key: newTargetKey(),
        })),
      );
    } else {
      setName("");
      setRuleType("priority");
      setPriority(0);
      setConditions({});
      setTargets([]);
    }
  }, [open, initialRule]);

  const updateCondition = <K extends keyof RuleConditions>(
    key: K,
    value: RuleConditions[K],
  ) => setConditions((prev) => ({ ...prev, [key]: value }));

  const addTarget = () => {
    const nextOrder = targets.filter((t) => !t.is_fallback).length + 1;
    setTargets((prev) => [
      ...prev,
      {
        _key: newTargetKey(),
        advertiser_id: "",
        weight: 100,
        priority_order: nextOrder,
        is_fallback: false,
      },
    ]);
  };

  const addFallback = () => {
    const nextOrder = targets.filter((t) => t.is_fallback).length + 1;
    setTargets((prev) => [
      ...prev,
      {
        _key: newTargetKey(),
        advertiser_id: "",
        weight: 100,
        priority_order: nextOrder,
        is_fallback: true,
      },
    ]);
  };

  const updateTarget = (key: string, updates: Partial<TargetRow>) => {
    setTargets((prev) =>
      prev.map((t) => (t._key === key ? { ...t, ...updates } : t)),
    );
  };

  const removeTarget = (key: string) => {
    setTargets((prev) => prev.filter((t) => t._key !== key));
  };

  const totalWeight = targets
    .filter((t) => !t.is_fallback)
    .reduce((s, t) => s + (t.weight || 0), 0);

  const primaryTargets = targets.filter((t) => !t.is_fallback);
  const fallbackTargets = targets.filter((t) => t.is_fallback);

  const handleSave = () => {
    if (!name.trim()) return;
    const cleanTargets = targets
      .filter((t) => t.advertiser_id)
      .map(({ _key, ...rest }) => rest);
    onSave({
      name: name.trim(),
      rule_type: ruleType,
      priority,
      conditions,
      targets: cleanTargets,
    });
  };

  const usedAdvertiserIds = new Set(
    targets.map((t) => t.advertiser_id).filter(Boolean),
  );

  const countryOptions = getCountryList().map((c) => ({
    value: c.code,
    label: `${c.code} – ${c.name}`,
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle>
            {initialRule ? "Edit Rule" : "New Distribution Rule"}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Rule Name</Label>
                <Input
                  placeholder="e.g. UAE Mobile Traffic"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Evaluation Priority</Label>
                <Input
                  type="number"
                  min={0}
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  placeholder="0 = first"
                />
                <p className="text-xs text-muted-foreground">
                  Lower number = evaluated first
                </p>
              </div>
            </div>

            <Separator />

            {/* IF Block — Conditions */}
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs px-2">
                  IF
                </Badge>
                <span className="text-sm font-semibold">Conditions</span>
                <span className="text-xs text-muted-foreground ml-1">
                  (leave empty to match all)
                </span>
              </div>

              {/* Countries */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Countries (GEO)
                </Label>
                <MultiSelect
                  options={countryOptions}
                  selected={conditions.country_codes || []}
                  onChange={(v) => updateCondition("country_codes", v)}
                  placeholder="Select countries…"
                  searchPlaceholder="Search country or code…"
                  showBadges
                />
              </div>

              {/* Affiliates */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Affiliates
                </Label>
                <MultiSelect
                  options={affiliates
                    .filter((a) => a.is_active)
                    .map((a) => ({
                      value: a.id,
                      label: a.name,
                      badgeLabel: a.name,
                    }))}
                  selected={conditions.affiliate_ids || []}
                  onChange={(v) => updateCondition("affiliate_ids", v)}
                  placeholder="Select affiliates…"
                  searchPlaceholder="Search affiliate…"
                  showBadges
                />
              </div>
            </div>

            <Separator />

            {/* THEN Block — Targets */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs px-2">
                  THEN
                </Badge>
                <span className="text-sm font-semibold">Send To</span>
                {ruleType === "weighted" && totalWeight > 0 && (
                  <Badge
                    variant={totalWeight === 100 ? "default" : "destructive"}
                    className="ml-auto text-xs"
                  >
                    {totalWeight}% total
                  </Badge>
                )}
              </div>

              {/* Primary targets */}
              <div className="space-y-2">
                {primaryTargets.length > 0 && (
                  <p className="text-xs text-muted-foreground font-medium">
                    Primary advertisers
                  </p>
                )}
                {primaryTargets.map((t, idx) => (
                  <TargetRowItem
                    key={t._key}
                    target={t}
                    index={idx}
                    ruleType={ruleType}
                    advertisers={advertisers}
                    usedIds={usedAdvertiserIds}
                    onChange={(u) => updateTarget(t._key, u)}
                    onRemove={() => removeTarget(t._key)}
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTarget}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Advertiser
                </Button>
              </div>

              {/* Fallback section */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <ArrowDown className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Fallback Chain
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  If all primary advertisers are unavailable, try these in
                  order.
                </p>
                {fallbackTargets.map((t, idx) => (
                  <TargetRowItem
                    key={t._key}
                    target={t}
                    index={idx}
                    ruleType="priority"
                    advertisers={advertisers}
                    usedIds={usedAdvertiserIds}
                    onChange={(u) => updateTarget(t._key, u)}
                    onRemove={() => removeTarget(t._key)}
                    isFallback
                  />
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addFallback}
                  className="w-full border border-dashed"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Fallback Advertiser
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="px-6 py-4 border-t shrink-0 flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              isSaving ||
              !name.trim() ||
              targets.filter((t) => !t.is_fallback && t.advertiser_id)
                .length === 0
            }
          >
            {isSaving ? "Saving…" : initialRule ? "Update Rule" : "Create Rule"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function TargetRowItem({
  target,
  index,
  ruleType,
  advertisers,
  usedIds,
  onChange,
  onRemove,
  isFallback = false,
}: {
  target: TargetRow;
  index: number;
  ruleType: RuleType;
  advertisers: Advertiser[];
  usedIds: Set<string>;
  onChange: (u: Partial<TargetRow>) => void;
  onRemove: () => void;
  isFallback?: boolean;
}) {
  const available = advertisers.filter(
    (a) => a.is_active && (a.id === target.advertiser_id || !usedIds.has(a.id)),
  );
  const selectedName = available.find((a) => a.id === target.advertiser_id)?.name;
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/20">
      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
      {!isFallback && ruleType === "priority" && (
        <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">
          {index + 1}.
        </span>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex-1 h-8 text-sm justify-between font-normal"
          >
            <span className="truncate">
              {selectedName || "Select advertiser…"}
            </span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search advertiser…" className="h-8" />
            <CommandList>
              <CommandEmpty>No advertiser found.</CommandEmpty>
              <CommandGroup>
                {available.map((a) => (
                  <CommandItem
                    key={a.id}
                    value={a.name}
                    onSelect={() => {
                      onChange({ advertiser_id: a.id });
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={`mr-2 h-3.5 w-3.5 ${target.advertiser_id === a.id ? "opacity-100" : "opacity-0"}`}
                    />
                    {a.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {!isFallback && ruleType === "weighted" && (
        <div className="flex items-center gap-1 shrink-0">
          <Input
            type="number"
            min={1}
            max={1000}
            value={target.weight}
            onChange={(e) => onChange({ weight: Number(e.target.value) })}
            className="w-16 h-8 text-sm text-center"
          />
          <span className="text-xs text-muted-foreground">wt</span>
        </div>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="h-8 w-8 p-0 shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );
}
