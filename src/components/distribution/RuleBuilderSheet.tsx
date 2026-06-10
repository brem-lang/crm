import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { GripVertical, Plus, Trash2, ArrowDown } from "lucide-react";
import { countryData } from "@/components/advertisers/countryData";
import type { DistributionRule, RuleConditions, RuleTarget, RuleType } from "@/hooks/useDistributionRules";

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

const DEVICE_TYPES = ["mobile", "desktop", "tablet"];

const COMMON_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "ar", name: "Arabic" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "pt", name: "Portuguese" },
  { code: "it", name: "Italian" },
  { code: "ru", name: "Russian" },
  { code: "zh", name: "Chinese" },
  { code: "tr", name: "Turkish" },
];

function countryOptions() {
  return Object.entries(countryData)
    .map(([code, info]) => ({ code, name: info.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function MultiToggle({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (val: string) => {
    if (selected.includes(val)) onChange(selected.filter((x) => x !== val));
    else onChange([...selected, val]);
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              selected.includes(opt.value)
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
        (initialRule.targets || []).map((t) => ({ ...t, _key: newTargetKey() }))
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
    value: RuleConditions[K]
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
    setTargets((prev) => prev.map((t) => (t._key === key ? { ...t, ...updates } : t)));
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
    onSave({ name: name.trim(), rule_type: ruleType, priority, conditions, targets: cleanTargets });
  };

  const usedAdvertiserIds = new Set(targets.map((t) => t.advertiser_id).filter(Boolean));

  const countries = countryOptions();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle>{initialRule ? "Edit Rule" : "New Distribution Rule"}</SheetTitle>
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
                <Label>Rule Type</Label>
                <Select value={ruleType} onValueChange={(v) => setRuleType(v as RuleType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RULE_TYPE_LABELS) as RuleType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {RULE_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <p className="text-xs text-muted-foreground">Lower number = evaluated first</p>
              </div>
            </div>

            <Separator />

            {/* IF Block — Conditions */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs px-2">IF</Badge>
                <span className="text-sm font-semibold">Conditions</span>
                <span className="text-xs text-muted-foreground ml-1">(leave empty to match all)</span>
              </div>

              {/* Countries */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Countries (GEO)
                </Label>
                <div className="grid grid-cols-3 gap-1 max-h-40 overflow-y-auto border rounded-md p-2">
                  {countries.slice(0, 60).map((c) => {
                    const sel = conditions.country_codes?.includes(c.code) ?? false;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          const curr = conditions.country_codes || [];
                          updateCondition(
                            "country_codes",
                            sel ? curr.filter((x) => x !== c.code) : [...curr, c.code]
                          );
                        }}
                        className={`text-left px-2 py-1 rounded text-xs transition-colors ${
                          sel
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        {c.code} – {c.name}
                      </button>
                    );
                  })}
                </div>
                {(conditions.country_codes?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {conditions.country_codes!.map((code) => (
                      <Badge key={code} variant="secondary" className="text-xs gap-1">
                        {code}
                        <button
                          type="button"
                          onClick={() =>
                            updateCondition(
                              "country_codes",
                              conditions.country_codes!.filter((x) => x !== code)
                            )
                          }
                          className="ml-0.5 hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Affiliates */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Affiliates
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {affiliates.filter((a) => a.is_active).map((a) => {
                    const sel = conditions.affiliate_ids?.includes(a.id) ?? false;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          const curr = conditions.affiliate_ids || [];
                          updateCondition(
                            "affiliate_ids",
                            sel ? curr.filter((x) => x !== a.id) : [...curr, a.id]
                          );
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                          sel
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {a.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Device types */}
              <MultiToggle
                label="Device Type"
                options={DEVICE_TYPES.map((d) => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) }))}
                selected={conditions.device_types || []}
                onChange={(v) => updateCondition("device_types", v)}
              />

              {/* Language */}
              <MultiToggle
                label="Language"
                options={COMMON_LANGUAGES.map((l) => ({ value: l.code, label: l.name }))}
                selected={conditions.language_codes || []}
                onChange={(v) => updateCondition("language_codes", v)}
              />
            </div>

            <Separator />

            {/* THEN Block — Targets */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs px-2">THEN</Badge>
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
                  <p className="text-xs text-muted-foreground font-medium">Primary advertisers</p>
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
                <Button type="button" variant="outline" size="sm" onClick={addTarget} className="w-full">
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
                  If all primary advertisers are unavailable, try these in order.
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim() || targets.filter((t) => !t.is_fallback && t.advertiser_id).length === 0}
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
    (a) => a.is_active && (a.id === target.advertiser_id || !usedIds.has(a.id))
  );

  return (
    <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/20">
      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
      {!isFallback && ruleType === "priority" && (
        <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">{index + 1}.</span>
      )}
      <Select
        value={target.advertiser_id || ""}
        onValueChange={(v) => onChange({ advertiser_id: v })}
      >
        <SelectTrigger className="flex-1 h-8 text-sm">
          <SelectValue placeholder="Select advertiser…" />
        </SelectTrigger>
        <SelectContent>
          {available.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
