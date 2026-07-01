import { RuleBuilderSheet } from "@/components/distribution/RuleBuilderSheet";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { TablePagination } from "@/components/ui/table-pagination";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdvertisers } from "@/hooks/useAdvertisers";
import { useAffiliates } from "@/hooks/useAffiliates";
import {
  useCreateDistributionRule,
  useDeleteDistributionRule,
  useDistributionRules,
  useToggleDistributionRule,
  useUpdateDistributionRule,
  type DistributionRule,
  type RuleConditions,
  type RuleTarget,
  type RuleType,
} from "@/hooks/useDistributionRules";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { usePageSizeState } from "@/hooks/usePageSizeState";
import { countryData } from "@/components/advertisers/countryData";
import { shortId } from "@/lib/utils";
import { ArrowUpDown, GitMerge, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";

const RULE_TYPE_META: Record<RuleType, { label: string; color: string }> = {
  priority: {
    label: "Priority",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  weighted: {
    label: "Weighted",
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
  affiliate: {
    label: "Affiliate",
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  geo: {
    label: "GEO",
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
};


export default function DistributionRules() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DistributionRule | null>(null);
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);
  const [priorityRule, setPriorityRule] = useState<DistributionRule | null>(null);
  const [priorityValue, setPriorityValue] = useState(0);
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [affiliateFilter, setAffiliateFilter] = useState("all");
  const [advertiserFilter, setAdvertiserFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = usePageSizeState();

  const { data: rules, isLoading } = useDistributionRules();
  const { data: advertisers } = useAdvertisers();
  const { data: affiliates } = useAffiliates();

  const createRule = useCreateDistributionRule();
  const updateRule = useUpdateDistributionRule();
  const deleteRule = useDeleteDistributionRule();
  const toggleRule = useToggleDistributionRule();

  // Countries actually referenced by at least one rule, for the filter dropdown
  const usedCountryCodes = useMemo(() => {
    const codes = new Set<string>();
    rules?.forEach(r => r.conditions.country_codes?.forEach(cc => codes.add(cc)));
    return Array.from(codes).sort();
  }, [rules]);

  const filteredRules = useMemo(() => {
    if (!rules) return [];
    let result = rules;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        r => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q),
      );
    }

    if (countryFilter !== "all") {
      result = result.filter(
        r => !r.conditions.country_codes?.length || r.conditions.country_codes.includes(countryFilter),
      );
    }

    if (affiliateFilter !== "all") {
      result = result.filter(
        r => !r.conditions.affiliate_ids?.length || r.conditions.affiliate_ids.includes(affiliateFilter),
      );
    }

    if (advertiserFilter !== "all") {
      result = result.filter(r => r.targets?.some(t => t.advertiser_id === advertiserFilter));
    }

    return result;
  }, [rules, search, countryFilter, affiliateFilter, advertiserFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRules.length / pageSize));
  const paginatedRules = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRules.slice(start, start + pageSize);
  }, [filteredRules, currentPage, pageSize]);

  const allSelected = paginatedRules.length > 0 && paginatedRules.every(r => selectedIds.has(r.id));
  const someSelected = paginatedRules.some(r => selectedIds.has(r.id)) && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(paginatedRules.map(r => r.id)));
    else setSelectedIds(new Set());
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    checked ? next.add(id) : next.delete(id);
    setSelectedIds(next);
  };

  const handleOpenCreate = () => {
    setEditingRule(null);
    setSheetOpen(true);
  };

  const handleOpenEdit = (rule: DistributionRule) => {
    setEditingRule(rule);
    setSheetOpen(true);
  };

  const handleOpenPriority = (rule: DistributionRule) => {
    setPriorityRule(rule);
    setPriorityValue(rule.priority);
  };

  const handleSavePriority = () => {
    if (!priorityRule) return;
    updateRule.mutate(
      { id: priorityRule.id, rule: { priority: priorityValue } },
      { onSuccess: () => setPriorityRule(null) },
    );
  };

  const handleSave = (data: {
    name: string;
    rule_type: RuleType;
    priority: number;
    conditions: RuleConditions;
    targets: RuleTarget[];
  }) => {
    if (editingRule) {
      updateRule.mutate(
        { id: editingRule.id, rule: data, targets: data.targets },
        { onSuccess: () => setSheetOpen(false) },
      );
    } else {
      createRule.mutate(
        { rule: data, targets: data.targets },
        { onSuccess: () => setSheetOpen(false) },
      );
    }
  };

  const handleDelete = () => {
    if (!deleteRuleId) return;
    deleteRule.mutate(deleteRuleId, {
      onSuccess: () => setDeleteRuleId(null),
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <GitMerge className="h-6 w-6" />
            <div>
              <h1 className="text-2xl font-bold">Distribution Rules</h1>
              <p className="text-sm text-muted-foreground">
                Define how incoming leads are routed to advertisers.
              </p>
            </div>
          </div>
          <Button onClick={handleOpenCreate} className="self-start sm:self-auto">
            <Plus className="h-4 w-4 mr-2" />
            New Rule
          </Button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 flex-wrap">
          {(Object.keys(RULE_TYPE_META) as RuleType[]).map((t) => (
            <div
              key={t}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${RULE_TYPE_META[t].color}`}
              >
                {RULE_TYPE_META[t].label}
              </span>
              <span>
                {t === "priority" && "First available wins"}
                {t === "weighted" && "Traffic split by weight"}
                {t === "affiliate" && "Affiliate-specific routing"}
                {t === "geo" && "Country-based routing"}
              </span>
            </div>
          ))}
        </div>

        {/* Rules table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Active Rules</CardTitle>
                  <CardDescription>
                    Rules are evaluated by priority — 0 is highest priority and gets the most leads, 100 is lowest and gets the least — regardless of the table's sort. The first matching rule routes the lead. Table below is sorted by most recently created.
                  </CardDescription>
                </div>
                <Input
                  placeholder="Search by name or ID..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="w-52 h-8 text-sm"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={countryFilter} onValueChange={(v) => { setCountryFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All countries</SelectItem>
                    {usedCountryCodes.map((code) => (
                      <SelectItem key={code} value={code} className="text-xs">
                        {code} — {(countryData as Record<string, { name: string }>)[code]?.name ?? code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={affiliateFilter} onValueChange={(v) => { setAffiliateFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue placeholder="Affiliate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All affiliates</SelectItem>
                    {(affiliates ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={advertiserFilter} onValueChange={(v) => { setAdvertiserFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue placeholder="Advertiser" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All advertisers</SelectItem>
                    {(advertisers ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(countryFilter !== "all" || affiliateFilter !== "all" || advertiserFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setCountryFilter("all");
                      setAffiliateFilter("all");
                      setAdvertiserFilter("all");
                      setCurrentPage(1);
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredRules.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground space-y-3">
                <GitMerge className="h-12 w-12 mx-auto opacity-20" />
                <p className="font-medium">No distribution rules yet</p>
                <p className="text-sm">
                  Create your first rule to start routing leads to advertisers.
                </p>
                <Button variant="outline" onClick={handleOpenCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Rule
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={someSelected ? "indeterminate" : allSelected}
                          onCheckedChange={(c) => handleSelectAll(!!c)}
                        />
                      </TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Countries</TableHead>
                      <TableHead>Affiliates</TableHead>
                      <TableHead>Advertisers (THEN)</TableHead>
                      <TableHead className="w-20 text-center">Active</TableHead>
                      <TableHead className="w-20 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRules.map((rule) => {
                      const meta = RULE_TYPE_META[rule.rule_type as RuleType];
                      const primaryTargets =
                        rule.targets?.filter((t) => !t.is_fallback) || [];
                      const fallbackTargets =
                        rule.targets?.filter((t) => t.is_fallback) || [];

                      return (
                        <TableRow
                          key={rule.id}
                          className={
                            selectedIds.has(rule.id)
                              ? "bg-muted/50"
                              : !rule.is_active
                              ? "opacity-50 bg-muted/20"
                              : undefined
                          }
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(rule.id)}
                              onCheckedChange={(c) => handleSelectOne(rule.id, !!c)}
                            />
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs bg-muted px-2 py-1 rounded" title={rule.id}>
                              {shortId(rule.id)}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">
                            {rule.name}
                          </TableCell>
                          <TableCell>
                            {rule.conditions.country_codes?.length ? (
                              <div className="flex flex-wrap gap-1">
                                {rule.conditions.country_codes.slice(0, 3).map((cc) => (
                                  <Badge key={cc} variant="outline" className="text-xs font-mono px-1.5 py-0">
                                    {cc}
                                  </Badge>
                                ))}
                                {rule.conditions.country_codes.length > 3 && (
                                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                    +{rule.conditions.country_codes.length - 3}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">All</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(rule.conditions.affiliate_ids ?? []).map((id) => {
                                const name = affiliates?.find((a) => a.id === id)?.name ?? id.slice(0, 8);
                                return (
                                  <Badge key={id} variant="outline" className="text-xs px-1.5 py-0">
                                    {name}
                                  </Badge>
                                );
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-1">
                                {primaryTargets.map((t, i) => (
                                  <Badge
                                    key={t.advertiser_id}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {rule.rule_type === "weighted"
                                      ? `${t.advertiser_name} (${t.weight}wt)`
                                      : `${i + 1}. ${t.advertiser_name}`}
                                  </Badge>
                                ))}
                              </div>
                              {fallbackTargets.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-xs text-muted-foreground">
                                    ↳ fallback:
                                  </span>
                                  {fallbackTargets.map((t) => (
                                    <Badge
                                      key={t.advertiser_id}
                                      variant="outline"
                                      className="text-xs opacity-70"
                                    >
                                      {t.advertiser_name}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={rule.is_active}
                              onCheckedChange={(v) =>
                                toggleRule.mutate({ id: rule.id, is_active: v })
                              }
                              disabled={toggleRule.isPending}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenEdit(rule)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenPriority(rule)}>
                                  <ArrowUpDown className="h-4 w-4 mr-2" />
                                  Priority ({rule.priority})
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setDeleteRuleId(rule.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          {filteredRules.length > 0 && (
            <CardFooter className="pt-0">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredRules.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                itemLabel="rules"
              />
            </CardFooter>
          )}
        </Card>

        {/* Routing flow info card */}
        {/* <Card className="bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Routing Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="text-sm text-muted-foreground space-y-1.5">
              {[
                "Lead arrives from affiliate",
                "System identifies affiliate ID, country, language, and device type",
                "Rules evaluated in priority order — first matching rule is used",
                "Eligible advertisers filtered (status, schedule, caps, allowed countries/affiliates)",
                "Advertiser selected based on rule type (priority order or weighted random)",
                "Lead sent to selected advertiser",
                "On failure or cap — tries next advertiser in fallback chain",
                "If no advertiser available — lead rejected with reason",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="font-mono text-xs bg-muted rounded px-1.5 py-0.5 shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card> */}
      </div>

      {/* Rule Builder Sheet */}
      <RuleBuilderSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        advertisers={advertisers || []}
        affiliates={affiliates || []}
        initialRule={editingRule}
        onSave={handleSave}
        isSaving={createRule.isPending || updateRule.isPending}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteRuleId}
        onOpenChange={(o) => !o && setDeleteRuleId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Leads will no longer be routed by
              this rule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Priority editor */}
      <Dialog open={!!priorityRule} onOpenChange={(o) => !o && setPriorityRule(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change priority</DialogTitle>
            <DialogDescription>
              {priorityRule?.name} — 0 is highest priority and gets the most leads (matches first, so its
              advertisers fill up first). Higher numbers get progressively fewer leads.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Priority (0 = highest)</Label>
            <Input
              type="number"
              min={0}
              value={priorityValue}
              onChange={(e) => setPriorityValue(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              e.g. 0 → highest priority, 50 → medium, 100 → lowest priority.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriorityRule(null)}>
              Cancel
            </Button>
            <Button onClick={handleSavePriority} disabled={updateRule.isPending}>
              {updateRule.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
