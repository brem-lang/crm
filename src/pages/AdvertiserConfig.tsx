import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAdvertisers } from "@/hooks/useAdvertisers";
import { useAffiliates } from "@/hooks/useAffiliates";
import {
  useDistributionSettings,
  useUpsertDistributionSetting,
  useBulkUpdateSettings,
} from "@/hooks/useDistributionSettings";
import { useTodayDistributionCounts } from "@/hooks/useTodayDistributionCounts";
import { useRecentDistributionStats } from "@/hooks/useRecentDistributionStats";
import { AdvertiserSidebar } from "@/components/distribution/AdvertiserSidebar";
import { AdvertiserConfigPanel } from "@/components/distribution/AdvertiserConfigPanel";
import { ConflictLinterBadge, ConflictLinterSheet } from "@/components/distribution/ConflictLinterSheet";
import { TelemetryStrip } from "@/components/distribution/TelemetryStrip";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, PauseCircle, PlayCircle, Settings, X } from "lucide-react";

export default function AdvertiserConfig() {
  const [selectedAdvertiserId, setSelectedAdvertiserId] = useState<string | null>(null);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [linterOpen, setLinterOpen] = useState(false);

  const { data: advertisers, isLoading: loadingAdvertisers } = useAdvertisers();
  const { data: affiliates, isLoading: loadingAffiliates } = useAffiliates();
  const { data: settings, isLoading: loadingSettings } = useDistributionSettings();
  const { data: todayCounts = {} } = useTodayDistributionCounts();
  const { data: avgStats = {} } = useRecentDistributionStats(7);

  const upsertSetting = useUpsertDistributionSetting();
  const bulkUpdateSettings = useBulkUpdateSettings();

  const bulkAdvertiserIds = [...bulkSelectedIds]
    .map((id) => ({
      id: (settings || []).find((s) => s.advertiser_id === id)?.id,
      advertiser_id: id,
    }))
    .filter((x): x is { id: string; advertiser_id: string } => !!x.id);

  const handleSaveSetting = (updates: { advertiser_id: string; [key: string]: unknown }) => {
    upsertSetting.mutate({
      advertiser_id: updates.advertiser_id,
      is_active: (updates.is_active as boolean) ?? false,
      priority: (updates.priority as number) || 1,
      countries: (updates.countries as string[] | null)?.length
        ? (updates.countries as string[])
        : null,
      affiliates: (updates.affiliates as string[] | null)?.length
        ? (updates.affiliates as string[])
        : null,
      base_weight: (updates.base_weight as number) || 100,
      start_time: (updates.start_time as string) || "00:00",
      end_time: (updates.end_time as string) || "23:59",
      default_daily_cap: (updates.default_daily_cap as number) || 100,
      default_hourly_cap: (updates.default_hourly_cap as number | null) ?? null,
      weekly_schedule: updates.weekly_schedule,
      overflow_option: (updates.overflow_option as string) || "next_advertiser",
      timezone: (updates.timezone as string) || "UTC",
    } as any);
  };

  const handleBulkPause = (is_active: boolean) => {
    const updates = bulkAdvertiserIds.map((x) => ({ id: x.id, is_active }));
    bulkUpdateSettings.mutate(updates, {
      onSuccess: () => {
        setBulkSelectedIds(new Set());
        setBulkSelectMode(false);
      },
    });
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

  const selectedAdvertiser = advertisers?.find((a) => a.id === selectedAdvertiserId) ?? null;
  const selectedSetting = settings?.find((s) => s.advertiser_id === selectedAdvertiserId) ?? null;

  return (
    <DashboardLayout>
      <ConflictLinterSheet
        open={linterOpen}
        onOpenChange={setLinterOpen}
        onSelectAdvertiser={(id) => setSelectedAdvertiserId(id)}
      />

      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b shrink-0 gap-3">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <h1 className="text-xl font-bold">Advertiser Config</h1>
            <ConflictLinterBadge
              advertisers={advertisers || []}
              settings={settings as any[] || []}
              avgStats={avgStats}
              onClick={() => setLinterOpen(true)}
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant={bulkSelectMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setBulkSelectMode((v) => !v);
                setBulkSelectedIds(new Set());
              }}
            >
              <CheckSquare className="h-4 w-4 mr-1.5" />
              {bulkSelectMode ? "Cancel select" : "Select"}
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
        <TelemetryStrip
          advertisers={advertisers || []}
          settings={(settings || []).map((s) => ({
            advertiser_id: s.advertiser_id,
            is_active: s.is_active,
            default_daily_cap: s.default_daily_cap,
          }))}
          todayCounts={todayCounts}
        />

        {/* Two-pane layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left pane */}
          <div className="w-72 shrink-0 overflow-hidden">
            <AdvertiserSidebar
              advertisers={advertisers || []}
              settings={(settings || []).map((s) => ({
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
              onSelect={(id) => {
                if (!bulkSelectMode) setSelectedAdvertiserId(id);
              }}
              bulkSelectMode={bulkSelectMode}
              bulkSelectedIds={bulkSelectedIds}
              onBulkSelectChange={setBulkSelectedIds}
            />
          </div>

          {/* Right pane */}
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
                        overflow_option: (selectedSetting as any).overflow_option ?? "next_advertiser",
                        timezone: (selectedSetting as any).timezone ?? "UTC",
                      }
                    : null
                }
                affiliates={affiliates || []}
                allAdvertisers={advertisers || []}
                allSettings={(settings || []).map((s) => ({
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
      </div>
    </DashboardLayout>
  );
}
