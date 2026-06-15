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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, X } from "lucide-react";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { useAffiliates } from "@/hooks/useAffiliates";

type DatePreset = "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "all" | "custom";

interface AffiliatePerformanceData {
  affiliate_id: string;
  affiliate_name: string;
  leads: number;
  conversions: number;
  pending_conversions: number;
  cr: number;
}

export default function AffiliatePerformance() {
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
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string>("");
  const [affiliateSearch, setAffiliateSearch] = useState("");

  const { data: affiliates } = useAffiliates();

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
    queryKey: ['affiliate-performance', showAllDates, fromDate, toDate, selectedAffiliateId, affiliateSearch],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      // 1 query: get filtered affiliates
      let affiliateQuery = supabase.from('affiliates').select('id, name');
      if (selectedAffiliateId) {
        affiliateQuery = affiliateQuery.eq('id', selectedAffiliateId);
      } else if (affiliateSearch) {
        affiliateQuery = affiliateQuery.ilike('name', `%${affiliateSearch}%`);
      }
      const { data: filteredAffiliates } = await affiliateQuery;
      if (!filteredAffiliates?.length) return [];

      const affiliateIds = filteredAffiliates.map(a => a.id);

      // 1 batched query for all leads (replaces 3 queries × N affiliates)
      let leadsQuery = supabase
        .from('leads')
        .select('affiliate_id, is_ftd, ftd_released')
        .in('affiliate_id', affiliateIds);
      if (!showAllDates) {
        leadsQuery = leadsQuery
          .gte('created_at', fromDate.toISOString())
          .lte('created_at', toDate.toISOString());
      }
      const { data: leads } = await leadsQuery;

      // Aggregate client-side
      const stats: Record<string, { leads: number; conversions: number; pending: number }> = {};
      for (const lead of leads || []) {
        if (!stats[lead.affiliate_id]) stats[lead.affiliate_id] = { leads: 0, conversions: 0, pending: 0 };
        stats[lead.affiliate_id].leads++;
        if (lead.is_ftd && lead.ftd_released) stats[lead.affiliate_id].conversions++;
        if (lead.is_ftd && !lead.ftd_released) stats[lead.affiliate_id].pending++;
      }

      return filteredAffiliates
        .map(aff => {
          const s = stats[aff.id] || { leads: 0, conversions: 0, pending: 0 };
          if (s.leads === 0 && s.conversions === 0) return null;
          return {
            affiliate_id: aff.id,
            affiliate_name: aff.name,
            leads: s.leads,
            conversions: s.conversions,
            pending_conversions: s.pending,
            cr: s.leads > 0 ? (s.conversions / s.leads) * 100 : 0,
          };
        })
        .filter(Boolean) as AffiliatePerformanceData[];
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
          <h1 className="text-3xl font-bold">Affiliate Performance Report</h1>
          <p className="text-muted-foreground text-sm">
            Home / Affiliates / Performance
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
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
              <Select
                value={selectedAffiliateId}
                onValueChange={(value) => {
                  setSelectedAffiliateId(value === "all" ? "" : value);
                  if (value !== "all") setAffiliateSearch("");
                }}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="All Affiliates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Affiliates</SelectItem>
                  {affiliates?.map((aff) => (
                    <SelectItem key={aff.id} value={aff.id}>
                      {aff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Search affiliate..."
                value={affiliateSearch}
                onChange={(e) => {
                  setAffiliateSearch(e.target.value);
                  if (e.target.value) setSelectedAffiliateId("");
                }}
                className="w-full sm:w-44 h-9"
              />

              {(affiliateSearch || selectedAffiliateId) && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setAffiliateSearch("");
                  setSelectedAffiliateId("");
                }}>
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
            <CardTitle>Affiliate Performance Report</CardTitle>
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
                    <TableHead>Affiliate</TableHead>
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
                        <TableRow key={row.affiliate_id}>
                          <TableCell className="font-medium">{row.affiliate_name}</TableCell>
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
