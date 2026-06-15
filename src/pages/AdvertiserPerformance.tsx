import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, X } from "lucide-react";
import { useCRMSettings } from "@/hooks/useCRMSettings";

type DatePreset = "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "all" | "custom";

interface AdvertiserPerformanceData {
  advertiser_id: string;
  advertiser_name: string;
  leads: number;
  conversions: number;
  pending_conversions: number;
  cr: number;
}

export default function AdvertiserPerformance() {
  const { 
    formatDate,
    getNow,
    getStartOfDay,
    getEndOfDay,
    getStartOfWeek,
    getEndOfWeek,
    getStartOfMonth,
    getEndOfMonth,
    tzSubDays,
    tzSubWeeks,
    tzSubMonths,
  } = useCRMSettings();
  
  const [datePreset, setDatePreset] = useState<DatePreset>("thisMonth");
  const [showAllDates, setShowAllDates] = useState(false);
  const [fromDate, setFromDate] = useState<Date>(() => getStartOfMonth(getNow()));
  const [toDate, setToDate] = useState<Date>(() => getEndOfMonth(getNow()));
  const [advertiserSearch, setAdvertiserSearch] = useState("");

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === "all") {
      setShowAllDates(true);
      return;
    }
    setShowAllDates(false);
    const now = getNow();

    switch (preset) {
      case "today":
        setFromDate(getStartOfDay(now));
        setToDate(getEndOfDay(now));
        break;
      case "yesterday": {
        const yesterday = tzSubDays(now, 1);
        setFromDate(getStartOfDay(yesterday));
        setToDate(getEndOfDay(yesterday));
        break;
      }
      case "thisWeek":
        setFromDate(getStartOfWeek(now));
        setToDate(getEndOfWeek(now));
        break;
      case "lastWeek": {
        const lastWeek = tzSubWeeks(now, 1);
        setFromDate(getStartOfWeek(lastWeek));
        setToDate(getEndOfWeek(lastWeek));
        break;
      }
      case "thisMonth":
        setFromDate(getStartOfMonth(now));
        setToDate(getEndOfMonth(now));
        break;
      case "lastMonth": {
        const lastMonth = tzSubMonths(now, 1);
        setFromDate(getStartOfMonth(lastMonth));
        setToDate(getEndOfMonth(lastMonth));
        break;
      }
    }
  };

  const { data: performanceData, isLoading } = useQuery({
    queryKey: ['advertiser-performance', showAllDates, fromDate, toDate, advertiserSearch],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      // 1 query: get filtered advertisers
      let advertiserQuery = supabase.from('advertisers').select('id, name');
      if (advertiserSearch) {
        advertiserQuery = advertiserQuery.ilike('name', `%${advertiserSearch}%`);
      }
      const { data: advertisers } = await advertiserQuery;
      if (!advertisers?.length) return [];

      const advertiserIds = advertisers.map(a => a.id);

      // 1 batched query: all distributions in range (replaces N count queries)
      let distsQuery = supabase
        .from('lead_distributions')
        .select('advertiser_id, lead_id')
        .in('advertiser_id', advertiserIds)
        .eq('status', 'sent');
      if (!showAllDates) {
        distsQuery = distsQuery
          .gte('created_at', fromDate.toISOString())
          .lte('created_at', toDate.toISOString());
      }
      const { data: distributions } = await distsQuery;
      if (!distributions?.length) return [];

      // 1 batched query: FTD status for all unique lead IDs
      const leadIds = [...new Set(distributions.map(d => d.lead_id))];
      const { data: ftdLeads } = await supabase
        .from('leads')
        .select('id, is_ftd, ftd_released')
        .in('id', leadIds);

      const ftdMap = new Map((ftdLeads || []).map(l => [l.id, l]));

      // Aggregate client-side
      const stats: Record<string, { leads: number; conversions: number; pending: number }> = {};
      for (const dist of distributions) {
        if (!stats[dist.advertiser_id]) stats[dist.advertiser_id] = { leads: 0, conversions: 0, pending: 0 };
        stats[dist.advertiser_id].leads++;
        const lead = ftdMap.get(dist.lead_id);
        if (lead?.is_ftd && lead.ftd_released) stats[dist.advertiser_id].conversions++;
        if (lead?.is_ftd && !lead.ftd_released) stats[dist.advertiser_id].pending++;
      }

      return advertisers
        .map(adv => {
          const s = stats[adv.id];
          if (!s || (s.leads === 0 && s.conversions === 0)) return null;
          return {
            advertiser_id: adv.id,
            advertiser_name: adv.name,
            leads: s.leads,
            conversions: s.conversions,
            pending_conversions: s.pending,
            cr: s.leads > 0 ? (s.conversions / s.leads) * 100 : 0,
          };
        })
        .filter(Boolean) as AdvertiserPerformanceData[];
    },
  });

  const totals = performanceData?.reduce(
    (acc, row) => ({
      leads: acc.leads + row.leads,
      conversions: acc.conversions + row.conversions,
      pending_conversions: acc.pending_conversions + row.pending_conversions,
    }),
    { leads: 0, conversions: 0, pending_conversions: 0 }
  ) || { leads: 0, conversions: 0, pending_conversions: 0 };

  const totalCR = totals.leads > 0 ? (totals.conversions / totals.leads) * 100 : 0;

  const datePresets: { key: DatePreset; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "thisWeek", label: "This Week" },
    { key: "lastWeek", label: "Last Week" },
    { key: "thisMonth", label: "This Month" },
    { key: "lastMonth", label: "Last Month" },
    { key: "all", label: "All" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Advertiser Performance Report</h1>
          <p className="text-muted-foreground text-sm">
            Home / Advertisers / Performance
          </p>
        </div>

        {/* Date Tabs & Filters */}
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* Date Preset Row — horizontally scrollable */}
            <div className="flex overflow-x-auto gap-1 pb-2 border-b">
              {datePresets.map((preset) => (
                <Button
                  key={preset.key}
                  variant={datePreset === preset.key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handlePresetChange(preset.key)}
                  className="text-sm shrink-0"
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            {/* Date Range Row — From → To side by side */}
            {!showAllDates && (
              <div className="flex flex-wrap items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                      <CalendarIcon className="h-3 w-3" />
                      {formatDate(fromDate, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={fromDate}
                      onSelect={(date) => {
                        if (date) {
                          setFromDate(getStartOfDay(date));
                          setDatePreset("custom");
                        }
                      }}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>

                <span className="text-muted-foreground text-xs">→</span>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                      <CalendarIcon className="h-3 w-3" />
                      {formatDate(toDate, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={toDate}
                      onSelect={(date) => {
                        if (date) {
                          setToDate(getEndOfDay(date));
                          setDatePreset("custom");
                        }
                      }}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search advertiser..."
                value={advertiserSearch}
                onChange={(e) => setAdvertiserSearch(e.target.value)}
                className="w-full sm:w-44 h-9"
              />

              {advertiserSearch && (
                <Button variant="ghost" size="sm" onClick={() => setAdvertiserSearch("")}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Advertiser Performance Report</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Advertiser</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Conversions</TableHead>
                    <TableHead className="text-right">CR</TableHead>
                    <TableHead className="text-right">Pending Conv.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performanceData && performanceData.length > 0 ? (
                    <>
                      {performanceData.map((row) => (
                        <TableRow key={row.advertiser_id}>
                          <TableCell className="font-medium">{row.advertiser_name}</TableCell>
                          <TableCell className="text-right">{row.leads}</TableCell>
                          <TableCell className="text-right">{row.conversions}</TableCell>
                          <TableCell className="text-right">{row.cr.toFixed(2)}%</TableCell>
                          <TableCell className="text-right">{row.pending_conversions}</TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell>Total:</TableCell>
                        <TableCell className="text-right">{totals.leads}</TableCell>
                        <TableCell className="text-right">{totals.conversions}</TableCell>
                        <TableCell className="text-right">{totalCR.toFixed(2)}%</TableCell>
                        <TableCell className="text-right">{totals.pending_conversions}</TableCell>
                      </TableRow>
                    </>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No data available for the selected period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
