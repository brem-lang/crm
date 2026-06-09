import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAdvertisers } from "@/hooks/useAdvertisers";
import { useAffiliates } from "@/hooks/useAffiliates";
import { useDistributionSettings, useUpsertDistributionSetting, useBulkUpdateSettings } from "@/hooks/useDistributionSettings";
import {
  useAllDistributionRules,
  useUpdateDistributionRule,
  useDeleteDistributionRule,
  useBulkDeleteDistributionRules,
  useAffiliateDistributionRules,
} from "@/hooks/useAffiliateDistributionRules";
import { useTodayDistributionCounts } from "@/hooks/useTodayDistributionCounts";
import { useRecentDistributionStats } from "@/hooks/useRecentDistributionStats";
import { BulkAddRuleDialog } from "@/components/distribution/BulkAddRuleDialog";
import { AdvertiserSidebar } from "@/components/distribution/AdvertiserSidebar";
import { AdvertiserConfigPanel } from "@/components/distribution/AdvertiserConfigPanel";
import { ConflictLinterBadge, ConflictLinterSheet } from "@/components/distribution/ConflictLinterSheet";
import { TelemetryStrip } from "@/components/distribution/TelemetryStrip";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users, Plus, Trash2, List, AlertTriangle, Columns3, CheckSquare, X, PauseCircle, PlayCircle } from "lucide-react";
import { countryData } from "@/components/advertisers/countryData";

type ViewMode = 'config' | 'rules';

export default function DistributionSettings() {
  const [viewMode, setViewMode] = useState<ViewMode>('config');
  const [selectedAdvertiserId, setSelectedAdvertiserId] = useState<string | null>(null);

  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [linterOpen, setLinterOpen] = useState(false);

  // Rules-view state (preserved from old page)
  const [activeRulesTab, setActiveRulesTab] = useState("all-rules");
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string>("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [filterAdvertiserId, setFilterAdvertiserId] = useState("all");

  const { data: advertisers, isLoading: loadingAdvertisers } = useAdvertisers();
  const { data: affiliates, isLoading: loadingAffiliates } = useAffiliates();
  const { data: settings, isLoading: loadingSettings } = useDistributionSettings();
  const { data: allRules, isLoading: loadingAllRules } = useAllDistributionRules();
  const { data: affiliateRules, isLoading: loadingAffiliateRules } = useAffiliateDistributionRules(
    selectedAffiliateId || undefined
  );
  const { data: todayCounts = {} } = useTodayDistributionCounts();

  const { data: avgStats = {} } = useRecentDistributionStats(7);

  const upsertSetting = useUpsertDistributionSetting();
  const bulkUpdateSettings = useBulkUpdateSettings();
  const updateRule = useUpdateDistributionRule();
  const deleteRule = useDeleteDistributionRule();
  const bulkDeleteRules = useBulkDeleteDistributionRules();

  // Must be before any early return — hooks cannot be called conditionally
  const advertiserFilterOptions = useMemo(() => {
    const seen = new Set<string>();
    return (allRules || [])
      .filter(r => r.advertiser_is_active !== false && r.advertiser_id && r.advertiser_name)
      .filter(r => { if (seen.has(r.advertiser_id)) return false; seen.add(r.advertiser_id); return true; })
      .map(r => ({ value: r.advertiser_id, label: r.advertiser_name! }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allRules]);

  const bulkAdvertiserIds = useMemo(
    () => [...bulkSelectedIds]
      .map(id => ({
        id: (settings || []).find(s => s.advertiser_id === id)?.id,
        advertiser_id: id,
      }))
      .filter((x): x is { id: string; advertiser_id: string } => !!x.id),
    [bulkSelectedIds, settings]
  );

  const handleSaveSetting = (updates: { advertiser_id: string; [key: string]: unknown }) => {
    upsertSetting.mutate({
      advertiser_id: updates.advertiser_id,
      is_active: (updates.is_active as boolean) ?? false,
      priority: 1,
      countries: (updates.countries as string[] | null)?.length
        ? (updates.countries as string[])
        : null,
      affiliates: (updates.affiliates as string[] | null)?.length
        ? (updates.affiliates as string[])
        : null,
      base_weight: (updates.base_weight as number) || 100,
      start_time: (updates.start_time as string) || '00:00',
      end_time: (updates.end_time as string) || '23:59',
      default_daily_cap: (updates.default_daily_cap as number) || 100,
      default_hourly_cap: (updates.default_hourly_cap as number | null) ?? null,
      weekly_schedule: updates.weekly_schedule,
    } as any);
  };

  const handleDeleteRule = (id: string) => {
    if (confirm('Delete this distribution rule?')) deleteRule.mutate(id);
  };

  const handleBulkDelete = () => {
    if (!selectedRuleIds.size) return;
    if (confirm(`Delete ${selectedRuleIds.size} distribution rules?`)) {
      bulkDeleteRules.mutate(Array.from(selectedRuleIds), {
        onSuccess: () => {
          setSelectedRuleIds(new Set());
          setFilterAdvertiserId("all");
        },
      });
    }
  };

  if (loadingAdvertisers || loadingSettings || loadingAffiliates) {
    return (
      <DashboardLayout>
        <div className="space-y-4 p-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      </DashboardLayout>
    );
  }

  const filteredAllRules = (allRules || [])
    .filter(r => r.advertiser_is_active !== false)
    .filter(r => filterAdvertiserId === "all" || r.advertiser_id === filterAdvertiserId);

  const allRulesSelected = filteredAllRules.length > 0 && filteredAllRules.every(r => selectedRuleIds.has(r.id));
  const someRulesSelected = filteredAllRules.some(r => selectedRuleIds.has(r.id)) && !allRulesSelected;

  const selectedAdvertiser = advertisers?.find(a => a.id === selectedAdvertiserId) ?? null;
  const selectedSetting = settings?.find(s => s.advertiser_id === selectedAdvertiserId) ?? null;

  const rulesByCountry = (affiliateRules || []).reduce((acc, rule) => {
    if (!acc[rule.country_code]) acc[rule.country_code] = [];
    acc[rule.country_code].push(rule);
    return acc;
  }, {} as Record<string, typeof affiliateRules>);

  const handleBulkPause = (is_active: boolean) => {
    const updates = bulkAdvertiserIds.map(x => ({ id: x.id, is_active }));
    bulkUpdateSettings.mutate(updates, {
      onSuccess: () => { setBulkSelectedIds(new Set()); setBulkSelectMode(false); },
    });
  };

  return (
    <DashboardLayout>
      <ConflictLinterSheet open={linterOpen} onOpenChange={setLinterOpen} />

      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b shrink-0 gap-3">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <h1 className="text-xl font-bold">Distribution Settings</h1>
            <ConflictLinterBadge
              advertisers={advertisers || []}
              settings={settings as any[] || []}
              avgStats={avgStats}
              onClick={() => setLinterOpen(true)}
            />
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
            {viewMode === 'config' && (
              <Button
                variant={bulkSelectMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setBulkSelectMode(v => !v); setBulkSelectedIds(new Set()); }}
              >
                <CheckSquare className="h-4 w-4 mr-1.5" />
                {bulkSelectMode ? 'Cancel select' : 'Select'}
              </Button>
            )}
            <Button
              variant={viewMode === 'config' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('config')}
            >
              <Columns3 className="h-4 w-4 mr-1.5" />
              Advertiser Config
            </Button>
            <Button
              variant={viewMode === 'rules' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('rules')}
            >
              <List className="h-4 w-4 mr-1.5" />
              Distribution Rules
            </Button>
          </div>
        </div>

        {/* Bulk action bar */}
        {bulkSelectMode && bulkSelectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-6 py-2 border-b bg-primary/5 shrink-0">
            <Badge variant="secondary">{bulkSelectedIds.size} selected</Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkPause(false)}
              disabled={bulkUpdateSettings.isPending}
            >
              <PauseCircle className="h-4 w-4 mr-1.5" />
              Pause all
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkPause(true)}
              disabled={bulkUpdateSettings.isPending}
            >
              <PlayCircle className="h-4 w-4 mr-1.5" />
              Activate all
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setBulkSelectedIds(new Set())}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        )}

        {/* Live telemetry strip */}
        {viewMode === 'config' && (
          <TelemetryStrip
            advertisers={advertisers || []}
            settings={(settings || []).map(s => ({
              advertiser_id: s.advertiser_id,
              is_active: s.is_active,
              default_daily_cap: s.default_daily_cap,
            }))}
            todayCounts={todayCounts}
          />
        )}

        {/* Two-pane layout */}
        {viewMode === 'config' && (
          <div className="flex flex-1 overflow-hidden">
            {/* Left pane */}
            <div className="w-72 shrink-0 overflow-hidden">
              <AdvertiserSidebar
                advertisers={advertisers || []}
                settings={(settings || []).map(s => ({
                  advertiser_id: s.advertiser_id,
                  is_active: s.is_active,
                  default_daily_cap: s.default_daily_cap,
                  default_hourly_cap: s.default_hourly_cap,
                  start_time: s.start_time,
                  end_time: s.end_time,
                  weekly_schedule: (s as any).weekly_schedule,
                }))}
                todayCounts={todayCounts}
                selectedId={selectedAdvertiserId}
                onSelect={id => { if (!bulkSelectMode) setSelectedAdvertiserId(id); }}
                bulkSelectMode={bulkSelectMode}
                bulkSelectedIds={bulkSelectedIds}
                onBulkSelectChange={setBulkSelectedIds}
              />
            </div>

            {/* Center pane */}
            <div className="flex-1 overflow-hidden">
              {selectedAdvertiser ? (
                <AdvertiserConfigPanel
                  key={selectedAdvertiser.id}
                  advertiser={selectedAdvertiser}
                  setting={
                    selectedSetting
                      ? {
                          advertiser_id: selectedSetting.advertiser_id,
                          is_active: selectedSetting.is_active,
                          base_weight: selectedSetting.base_weight,
                          default_daily_cap: selectedSetting.default_daily_cap,
                          default_hourly_cap: selectedSetting.default_hourly_cap,
                          start_time: selectedSetting.start_time,
                          end_time: selectedSetting.end_time,
                          countries: selectedSetting.countries,
                          affiliates: selectedSetting.affiliates,
                          weekly_schedule: (selectedSetting as any).weekly_schedule,
                        }
                      : null
                  }
                  affiliates={affiliates || []}
                  allAdvertisers={advertisers || []}
                  allSettings={(settings || []).map(s => ({
                    advertiser_id: s.advertiser_id,
                    is_active: s.is_active,
                    base_weight: s.base_weight,
                    default_daily_cap: s.default_daily_cap,
                    default_hourly_cap: s.default_hourly_cap,
                    start_time: s.start_time,
                    end_time: s.end_time,
                    countries: s.countries,
                    affiliates: s.affiliates,
                    weekly_schedule: (s as any).weekly_schedule,
                  }))}
                  todayCount={todayCounts[selectedAdvertiserId!] ?? 0}
                  onSave={handleSaveSetting}
                  isSaving={upsertSetting.isPending}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Settings className="h-12 w-12 mb-4 opacity-20" />
                  <p className="font-medium">Select an advertiser</p>
                  <p className="text-sm mt-1">
                    Choose an advertiser from the left panel to configure its settings.
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Rules view (preserved from original page) */}
        {viewMode === 'rules' && (
          <div className="flex-1 overflow-auto p-6">
            <Tabs value={activeRulesTab} onValueChange={setActiveRulesTab}>
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="all-rules" className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  All Rules
                </TabsTrigger>
                <TabsTrigger value="affiliate" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  By Affiliate
                </TabsTrigger>
              </TabsList>

              {/* All Rules */}
              <TabsContent value="all-rules" className="mt-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle>All Distribution Rules</CardTitle>
                      <CardDescription>
                        View and edit all affiliate distribution rules. Only active advertisers are shown.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <SearchableSelect
                        value={filterAdvertiserId}
                        onValueChange={setFilterAdvertiserId}
                        options={advertiserFilterOptions}
                        placeholder="All Advertisers"
                        searchPlaceholder="Search advertiser..."
                        className="w-48"
                      />
                      {selectedRuleIds.size > 0 && (
                        <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkDeleteRules.isPending}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete {selectedRuleIds.size} Selected
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingAllRules ? (
                      <Skeleton className="h-48 w-full" />
                    ) : !filteredAllRules.length ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <p>No distribution rules configured yet.</p>
                        <p className="text-sm mt-2">Use the "By Affiliate" tab to add rules.</p>
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">
                                <Checkbox
                                  checked={someRulesSelected ? 'indeterminate' : allRulesSelected}
                                  onCheckedChange={checked =>
                                    setSelectedRuleIds(
                                      checked ? new Set(filteredAllRules.map(r => r.id)) : new Set()
                                    )
                                  }
                                />
                              </TableHead>
                              <TableHead>Affiliate</TableHead>
                              <TableHead>Country</TableHead>
                              <TableHead>Advertiser</TableHead>
                              <TableHead className="w-24 text-center">Active</TableHead>
                              <TableHead className="w-16">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredAllRules.map(rule => {
                              const affiliateInactive = rule.affiliate_is_active === false;
                              const effectivelyInactive = affiliateInactive || !rule.is_active;

                              return (
                                <TableRow key={rule.id} className={effectivelyInactive ? 'opacity-60 bg-muted/30' : ''}>
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedRuleIds.has(rule.id)}
                                      onCheckedChange={checked => {
                                        setSelectedRuleIds(prev => {
                                          const n = new Set(prev);
                                          checked ? n.add(rule.id) : n.delete(rule.id);
                                          return n;
                                        });
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      {rule.affiliate_name}
                                      {affiliateInactive && (
                                        <Badge variant="destructive" className="text-xs">
                                          <AlertTriangle className="h-3 w-3 mr-1" />
                                          Inactive
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{rule.country_code}</Badge>
                                    <span className="ml-2 text-muted-foreground text-sm">
                                      {countryData[rule.country_code]?.name}
                                    </span>
                                  </TableCell>
                                  <TableCell>{rule.advertiser_name}</TableCell>
                                  <TableCell className="text-center">
                                    <Switch
                                      checked={rule.is_active}
                                      onCheckedChange={v => updateRule.mutate({ id: rule.id, is_active: v })}
                                      disabled={updateRule.isPending}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteRule(rule.id)}
                                      disabled={deleteRule.isPending}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* By Affiliate */}
              <TabsContent value="affiliate" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Select Affiliate</CardTitle>
                    <CardDescription>Choose an affiliate to manage their distribution rules</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Select value={selectedAffiliateId} onValueChange={setSelectedAffiliateId}>
                      <SelectTrigger className="w-full max-w-md">
                        <SelectValue placeholder="Select an affiliate..." />
                      </SelectTrigger>
                      <SelectContent>
                        {affiliates?.map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}{!a.is_active && ' (Inactive)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {selectedAffiliateId && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>Distribution Rules</CardTitle>
                        <CardDescription>
                          Leads from this affiliate will only go to advertisers listed here (by country)
                        </CardDescription>
                      </div>
                      <Button onClick={() => setIsAddDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Rules
                      </Button>
                      <BulkAddRuleDialog
                        open={isAddDialogOpen}
                        onOpenChange={setIsAddDialogOpen}
                        affiliateId={selectedAffiliateId}
                        advertisers={advertisers || []}
                        existingRules={(affiliateRules || []).map(r => ({
                          country_code: r.country_code,
                          advertiser_id: r.advertiser_id,
                        }))}
                      />
                    </CardHeader>
                    <CardContent>
                      {loadingAffiliateRules ? (
                        <Skeleton className="h-48 w-full" />
                      ) : Object.keys(rulesByCountry).length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <p>No distribution rules configured for this affiliate.</p>
                          <p className="text-sm mt-2">Without rules, leads will use the global advertiser settings.</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {Object.entries(rulesByCountry).map(([countryCode, countryRules]) => (
                            <div key={countryCode} className="border rounded-lg overflow-hidden">
                              <div className="bg-muted px-4 py-2 flex items-center gap-2">
                                <span className="font-semibold">{countryCode}</span>
                                <span className="text-muted-foreground">
                                  - {countryData[countryCode]?.name || countryCode}
                                </span>
                                <Badge variant="secondary" className="ml-auto">
                                  {countryRules?.length} advertiser{(countryRules?.length || 0) !== 1 && 's'}
                                </Badge>
                              </div>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Advertiser</TableHead>
                                    <TableHead className="w-24 text-center">Active</TableHead>
                                    <TableHead className="w-16">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {countryRules?.map(rule => {
                                    const advertiserInactive = rule.advertiser_is_active === false;
                                    return (
                                      <TableRow
                                        key={rule.id}
                                        className={advertiserInactive ? 'opacity-60 bg-muted/30' : ''}
                                      >
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
                                          <Switch
                                            checked={advertiserInactive ? false : rule.is_active}
                                            onCheckedChange={v => updateRule.mutate({ id: rule.id, is_active: v })}
                                            disabled={advertiserInactive || updateRule.isPending}
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <Button size="sm" variant="ghost" onClick={() => handleDeleteRule(rule.id)} disabled={deleteRule.isPending}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
