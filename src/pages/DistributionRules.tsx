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
  AlertDialogTrigger,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { TablePagination } from "@/components/ui/table-pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  useAllDistributionRules,
  useUpdateDistributionRule,
  useDeleteDistributionRule,
  useBulkUpdateDistributionRules,
  useBulkDeleteDistributionRules,
  useDistributionRuleLeadCounts,
  type AffiliateDistributionRule,
  type BulkRuleUpdates,
} from "@/hooks/useAffiliateDistributionRules";
import { BulkAddRuleDialog } from "@/components/distribution/BulkAddRuleDialog";
import { usePageSizeState } from "@/hooks/usePageSizeState";
import { countryData } from "@/components/advertisers/countryData";
import { shortId } from "@/lib/utils";
import { AlertTriangle, GitMerge, MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useState, useMemo } from "react";

type TriState = "no_change" | "true" | "false";
type TierChoice = "no_change" | "primary" | "fallback";

export default function DistributionRules() {
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [affiliateFilter, setAffiliateFilter] = useState<string>("all");
  const [advertiserFilter, setAdvertiserFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = usePageSizeState();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkActive, setBulkActive] = useState<TriState>("no_change");
  const [bulkTier, setBulkTier] = useState<TierChoice>("no_change");
  const [bulkWeightEnabled, setBulkWeightEnabled] = useState(false);
  const [bulkWeight, setBulkWeight] = useState(100);
  const [bulkPriorityEnabled, setBulkPriorityEnabled] = useState(false);
  const [bulkPriorityValue, setBulkPriorityValue] = useState(100);
  const [editingRule, setEditingRule] = useState<AffiliateDistributionRule | null>(null);
  const [editTier, setEditTier] = useState<"primary" | "fallback">("primary");
  const [editPriority, setEditPriority] = useState(100);
  const [editWeight, setEditWeight] = useState(100);
  const [editActive, setEditActive] = useState(true);

  const { data: advertisers } = useAdvertisers();
  const { data: affiliates } = useAffiliates();

  const { data: allRules, isLoading: loadingRules } = useAllDistributionRules();
  const { data: leadCounts } = useDistributionRuleLeadCounts();
  const updateRule = useUpdateDistributionRule();
  const deleteRule = useDeleteDistributionRule();
  const bulkUpdateRules = useBulkUpdateDistributionRules();
  const bulkDeleteRules = useBulkDeleteDistributionRules();

  const handleDeleteRule = (id: string) => {
    if (confirm('Delete this distribution rule?')) deleteRule.mutate(id);
  };

  const affiliatesWithRules = useMemo(() => {
    const ids = new Set((allRules ?? []).map((rule) => rule.affiliate_id));
    return (affiliates ?? []).filter((a) => ids.has(a.id));
  }, [affiliates, allRules]);

  const advertisersWithRules = useMemo(() => {
    const ids = new Set((allRules ?? []).map((rule) => rule.advertiser_id));
    return (advertisers ?? []).filter((a) => ids.has(a.id));
  }, [advertisers, allRules]);

  const countriesWithRules = useMemo(() => {
    const codes = new Set((allRules ?? []).map((rule) => rule.country_code));
    return Array.from(codes).sort();
  }, [allRules]);

  const filteredRules = useMemo(() => {
    if (!allRules) return [];
    let result = allRules;

    if (affiliateFilter !== "all") {
      result = result.filter((rule) => rule.affiliate_id === affiliateFilter);
    }

    if (advertiserFilter !== "all") {
      result = result.filter((rule) => rule.advertiser_id === advertiserFilter);
    }

    if (countryFilter !== "all") {
      result = result.filter((rule) => rule.country_code === countryFilter);
    }

    if (activeFilter === "active") result = result.filter((rule) => rule.is_active);
    else if (activeFilter === "inactive") result = result.filter((rule) => !rule.is_active);

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((rule) => {
        const countryName = (countryData as Record<string, { name: string }>)[rule.country_code]?.name || "";
        return (
          rule.country_code.toLowerCase().includes(q) ||
          countryName.toLowerCase().includes(q) ||
          (rule.advertiser_name || "").toLowerCase().includes(q) ||
          (rule.affiliate_name || "").toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [allRules, affiliateFilter, advertiserFilter, countryFilter, activeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRules.length / pageSize));
  const paginatedRules = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRules.slice(start, start + pageSize);
  }, [filteredRules, currentPage, pageSize]);

  const allSelected = paginatedRules.length > 0 && paginatedRules.every((r) => selectedIds.has(r.id));
  const someSelected = paginatedRules.some((r) => selectedIds.has(r.id)) && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(paginatedRules.map((r) => r.id)));
    else setSelectedIds(new Set());
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    checked ? next.add(id) : next.delete(id);
    setSelectedIds(next);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const openBulkEdit = () => {
    setBulkActive("no_change");
    setBulkTier("no_change");
    setBulkWeightEnabled(false);
    setBulkWeight(100);
    setBulkPriorityEnabled(false);
    setBulkPriorityValue(100);
    setIsBulkEditOpen(true);
  };

  const handleBulkEditSave = () => {
    const updates: BulkRuleUpdates = {};
    if (bulkActive !== "no_change") updates.is_active = bulkActive === "true";
    if (bulkTier !== "no_change") updates.priority_type = bulkTier;
    if (bulkWeightEnabled) updates.weight = bulkWeight;
    if (bulkPriorityEnabled) updates.priority = bulkPriorityValue;

    if (Object.keys(updates).length === 0) {
      setIsBulkEditOpen(false);
      return;
    }

    bulkUpdateRules.mutate(
      { ids: Array.from(selectedIds), updates },
      {
        onSuccess: () => {
          setIsBulkEditOpen(false);
          clearSelection();
        },
      }
    );
  };

  const handleBulkDelete = () => {
    bulkDeleteRules.mutate(Array.from(selectedIds), {
      onSuccess: () => {
        setIsBulkDeleteOpen(false);
        clearSelection();
      },
    });
  };

  const openEditRule = (rule: AffiliateDistributionRule) => {
    setEditingRule(rule);
    setEditTier(rule.priority_type);
    setEditPriority(rule.priority);
    setEditWeight(rule.weight);
    setEditActive(rule.is_active);
  };

  const handleEditSave = () => {
    if (!editingRule) return;
    updateRule.mutate(
      {
        id: editingRule.id,
        priority_type: editTier,
        priority: editPriority,
        weight: editWeight,
        is_active: editActive,
      },
      { onSuccess: () => setEditingRule(null) }
    );
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
                Define how incoming leads are routed to advertisers, per affiliate and country.
              </p>
            </div>
          </div>
          <Button onClick={() => setIsAddRuleOpen(true)} className="self-start sm:self-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Rules
          </Button>
          <BulkAddRuleDialog
            open={isAddRuleOpen}
            onOpenChange={setIsAddRuleOpen}
            affiliates={affiliates || []}
            advertisers={advertisers || []}
            initialAffiliateId={affiliateFilter !== "all" ? affiliateFilter : undefined}
            existingRules={(allRules || []).map((r) => ({
              affiliate_id: r.affiliate_id,
              country_code: r.country_code,
              advertiser_id: r.advertiser_id,
            }))}
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Active Rules</CardTitle>
                  <CardDescription>
                    Leads from an affiliate only go to advertisers listed here (by country). No active rule for a
                    country means that affiliate's leads from that country are rejected outright.
                  </CardDescription>
                </div>
              </div>

              {/* Active/Inactive tabs */}
              <Tabs value={activeFilter} onValueChange={(v) => { setActiveFilter(v as "all" | "active" | "inactive"); setCurrentPage(1); }}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="active">Active</TabsTrigger>
                  <TabsTrigger value="inactive">Inactive</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={affiliateFilter} onValueChange={(v) => { setAffiliateFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="h-8 w-56 text-xs">
                    <SelectValue placeholder="Affiliate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All affiliates</SelectItem>
                    {affiliatesWithRules.map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {a.name}{!a.is_active && " (Inactive)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={advertiserFilter} onValueChange={(v) => { setAdvertiserFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="h-8 w-56 text-xs">
                    <SelectValue placeholder="Advertiser" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All advertisers</SelectItem>
                    {advertisersWithRules.map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {a.name}{!a.is_active && " (Inactive)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={countryFilter} onValueChange={(v) => { setCountryFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All countries</SelectItem>
                    {countriesWithRules.map((code) => (
                      <SelectItem key={code} value={code} className="text-xs">
                        {(countryData as Record<string, { name: string }>)[code]?.name || code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Search affiliate, country or advertiser..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="w-64 h-8 text-sm"
                />
                {filteredRules.length > 0 && (
                  <Badge variant="secondary" className="h-8 flex items-center">
                    {filteredRules.length} rule{filteredRules.length !== 1 && "s"}
                  </Badge>
                )}
              </div>

              {/* Bulk actions */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground pt-3 border-t flex-wrap">
                  <span>{selectedIds.size} rule{selectedIds.size !== 1 ? "s" : ""} selected</span>
                  <Button variant="outline" size="sm" onClick={openBulkEdit}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Bulk Edit
                  </Button>
                  <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete ({selectedIds.size})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Distribution Rules</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete {selectedIds.size} rule{selectedIds.size > 1 ? "s" : ""}?
                          Leads matching these affiliate/country/advertiser combinations will no longer route through
                          them. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleBulkDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    Clear selection
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingRules ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredRules.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground space-y-3">
                <Users className="h-12 w-12 mx-auto opacity-20" />
                <p className="font-medium">
                  {search || affiliateFilter !== "all" || advertiserFilter !== "all" || countryFilter !== "all" || activeFilter !== "all" ? "No rules match your filters" : "No distribution rules configured yet"}
                </p>
                {!search && affiliateFilter === "all" && advertiserFilter === "all" && countryFilter === "all" && activeFilter === "all" && (
                  <Button variant="outline" onClick={() => setIsAddRuleOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Rules
                  </Button>
                )}
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
                      <TableHead>Affiliate</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Advertiser</TableHead>
                      <TableHead className="w-20 text-center">Leads</TableHead>
                      <TableHead className="w-24">Tier</TableHead>
                      <TableHead className="w-20 text-right">Priority</TableHead>
                      <TableHead className="w-20 text-right">Weight</TableHead>
                      <TableHead className="w-20 text-center">Active</TableHead>
                      <TableHead className="w-16 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRules.map((rule) => {
                      const advertiserInactive = rule.advertiser_is_active === false;
                      return (
                        <TableRow
                          key={rule.id}
                          className={
                            selectedIds.has(rule.id)
                              ? "bg-muted/50"
                              : advertiserInactive
                              ? "opacity-60 bg-muted/30"
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
                            {rule.affiliate_name}
                            {rule.affiliate_is_active === false && (
                              <Badge variant="outline" className="text-xs ml-1.5">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs font-mono px-1.5 py-0 mr-1.5">
                              {rule.country_code}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {(countryData as Record<string, { name: string }>)[rule.country_code]?.name || rule.country_code}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {rule.advertiser_name}
                              {advertiserInactive && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Inactive
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {(() => {
                              const leadCount = leadCounts?.[`${rule.affiliate_id}|${rule.country_code}|${rule.advertiser_id}`] ?? 0;
                              return leadCount > 0 ? (
                                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 tabular-nums">
                                  {leadCount}
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground tabular-nums">0</span>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={rule.priority_type === "fallback" ? "outline" : "secondary"} className="text-xs">
                              {rule.priority_type === "fallback" ? "Fallback" : "Primary"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right" title="Lower = tried first within its tier">
                            <Input
                              key={`${rule.id}-priority-${rule.priority}`}
                              type="number"
                              min={0}
                              defaultValue={rule.priority}
                              disabled={updateRule.isPending}
                              className="h-7 w-16 text-right text-sm px-1.5 ml-auto"
                              onBlur={(e) => {
                                const next = Number(e.target.value);
                                if (!Number.isNaN(next) && next !== rule.priority) {
                                  updateRule.mutate({ id: rule.id, priority: next });
                                }
                              }}
                              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              key={`${rule.id}-weight-${rule.weight}`}
                              type="number"
                              min={1}
                              defaultValue={rule.weight}
                              disabled={updateRule.isPending}
                              className="h-7 w-16 text-right text-sm px-1.5 ml-auto"
                              onBlur={(e) => {
                                const next = Number(e.target.value);
                                if (!Number.isNaN(next) && next !== rule.weight && next >= 1) {
                                  updateRule.mutate({ id: rule.id, weight: next });
                                }
                              }}
                              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={advertiserInactive ? false : rule.is_active}
                              onCheckedChange={(v) => updateRule.mutate({ id: rule.id, is_active: v })}
                              disabled={advertiserInactive || updateRule.isPending}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditRule(rule)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteRule(rule.id)}
                                  disabled={deleteRule.isPending}
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
      </div>

      {/* Bulk edit dialog */}
      <Dialog open={isBulkEditOpen} onOpenChange={setIsBulkEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk edit {selectedIds.size} rule{selectedIds.size !== 1 ? "s" : ""}</DialogTitle>
            <DialogDescription>
              Only fields you change here will be updated — leave a field on "No change" to leave it as-is.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Active</Label>
              <Select value={bulkActive} onValueChange={(v) => setBulkActive(v as TriState)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_change">No change</SelectItem>
                  <SelectItem value="true">Set Active</SelectItem>
                  <SelectItem value="false">Set Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tier</Label>
              <Select value={bulkTier} onValueChange={(v) => setBulkTier(v as TierChoice)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_change">No change</SelectItem>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="fallback">Fallback</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bulk-priority-enabled"
                  checked={bulkPriorityEnabled}
                  onCheckedChange={(c) => setBulkPriorityEnabled(!!c)}
                />
                <Label htmlFor="bulk-priority-enabled">Set priority (0 = tried first within its tier)</Label>
              </div>
              <Input
                type="number"
                min={0}
                value={bulkPriorityValue}
                onChange={(e) => setBulkPriorityValue(Number(e.target.value))}
                disabled={!bulkPriorityEnabled}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bulk-weight-enabled"
                  checked={bulkWeightEnabled}
                  onCheckedChange={(c) => setBulkWeightEnabled(!!c)}
                />
                <Label htmlFor="bulk-weight-enabled">Set weight</Label>
              </div>
              <Input
                type="number"
                min={1}
                value={bulkWeight}
                onChange={(e) => setBulkWeight(Number(e.target.value))}
                disabled={!bulkWeightEnabled}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkEditSave} disabled={bulkUpdateRules.isPending}>
              {bulkUpdateRules.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single-row edit dialog */}
      <Dialog open={!!editingRule} onOpenChange={(open) => !open && setEditingRule(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit rule</DialogTitle>
            <DialogDescription>
              {editingRule?.affiliate_name} — {editingRule?.country_code} — {editingRule?.advertiser_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tier</Label>
              <Select value={editTier} onValueChange={(v) => setEditTier(v as "primary" | "fallback")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="fallback">Fallback</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority (0 = tried first within its tier)</Label>
              <Input
                type="number"
                min={0}
                value={editPriority}
                onChange={(e) => setEditPriority(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Weight</Label>
              <Input
                type="number"
                min={1}
                value={editWeight}
                onChange={(e) => setEditWeight(Number(e.target.value))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editActive} onCheckedChange={setEditActive} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRule(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={updateRule.isPending}>
              {updateRule.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
