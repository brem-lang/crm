import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TablePagination } from "@/components/ui/table-pagination";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { differenceInDays } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { usePageSizeState } from "@/hooks/usePageSizeState";

type DatePreset = "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "all" | "custom";

interface CountryPerformanceData {
  country_code: string;
  clicks: number;
  leads: number;
  accepted: number;
  rejected: number;
  conversions: number;
  pending_conversions: number;
  cr: number;
  c2l: number;
}

interface BreakdownData {
  id: string;
  name: string;
  leads: number;
  conversions: number;
  cr: number;
}

export default function CountryPerformance() {
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
  const [countryFilter, setCountryFilter] = useState("all");
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCountryForBreakdown, setSelectedCountryForBreakdown] = useState<string | null>(null);
  const [breakdownTab, setBreakdownTab] = useState<"advertiser" | "affiliate">("advertiser");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = usePageSizeState();

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
    queryKey: ['country-performance', showAllDates, fromDate, toDate],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      // Get all leads within date range
      let leadsQ = supabase
        .from('leads')
        .select('country_code, status, is_ftd, ftd_released, click_id, lead_distributions(status)');
      if (!showAllDates) {
        leadsQ = leadsQ.gte('created_at', fromDate.toISOString()).lte('created_at', toDate.toISOString());
      }
      const { data: leads, error } = await leadsQ;

      if (error) throw error;
      if (!leads) return [];

      // Group by country
      const countryMap: Record<string, CountryPerformanceData> = {};

      leads.forEach((lead: any) => {
        const country = lead.country_code || 'Unknown';

        if (!countryMap[country]) {
          countryMap[country] = {
            country_code: country,
            clicks: 0,
            leads: 0,
            accepted: 0,
            rejected: 0,
            conversions: 0,
            pending_conversions: 0,
            cr: 0,
            c2l: 0,
          };
        }

        if (lead.click_id) {
          countryMap[country].clicks++;
        }

        const wentToAdvertiser = lead.lead_distributions?.some((d: any) => d.status === 'sent');
        if (wentToAdvertiser) {
          countryMap[country].accepted++;
        }

        if (lead.status === 'rejected') {
          countryMap[country].rejected++;
        }

        if (lead.is_ftd) {
          if (lead.ftd_released) {
            countryMap[country].conversions++;
          } else {
            countryMap[country].pending_conversions++;
          }
        }
      });

      // Leads = accepted + rejected; CR is based on accepted (advertiser-sent) leads.
      // C2L = % of leads that carry click-tracking data (this CRM has no separate
      // click log, so "clicks" here means leads with a click_id, not raw ad clicks).
      const results = Object.values(countryMap).map(country => ({
        ...country,
        leads: country.accepted + country.rejected,
        cr: country.accepted > 0 ? (country.conversions / country.accepted) * 100 : 0,
        c2l: (country.accepted + country.rejected) > 0
          ? (country.clicks / (country.accepted + country.rejected)) * 100
          : 0,
      }));

      // Sort by leads descending
      return results.sort((a, b) => b.leads - a.leads);
    },
  });

  // Fetch breakdown data when a country is selected
  const { data: breakdownData, isLoading: isBreakdownLoading } = useQuery({
    queryKey: ['country-breakdown', selectedCountryForBreakdown, showAllDates, fromDate, toDate, breakdownTab],
    staleTime: 2 * 60 * 1000,
    enabled: !!selectedCountryForBreakdown,
    queryFn: async () => {
      if (!selectedCountryForBreakdown) return { advertisers: [], affiliates: [] };

      // Get leads for the selected country with relationships
      let breakdownQ = supabase
        .from('leads')
        .select(`
          id,
          is_ftd,
          affiliate_id,
          affiliates!inner(id, name),
          lead_distributions!inner(
            advertiser_id,
            status,
            advertisers!inner(id, name)
          )
        `)
        .eq('country_code', selectedCountryForBreakdown);
      if (!showAllDates) {
        breakdownQ = breakdownQ.gte('created_at', fromDate.toISOString()).lte('created_at', toDate.toISOString());
      }
      const { data: leads, error } = await breakdownQ;

      if (error) throw error;
      if (!leads) return { advertisers: [], affiliates: [] };

      // Group by advertiser
      const advertiserMap: Record<string, BreakdownData> = {};
      const affiliateMap: Record<string, BreakdownData> = {};

      leads.forEach((lead: any) => {
        // Advertiser breakdown (from distributions)
        lead.lead_distributions?.forEach((dist: any) => {
          if (dist.status === 'sent' && dist.advertisers) {
            const advId = dist.advertisers.id;
            if (!advertiserMap[advId]) {
              advertiserMap[advId] = {
                id: advId,
                name: dist.advertisers.name,
                leads: 0,
                conversions: 0,
                cr: 0,
              };
            }
            advertiserMap[advId].leads++;
            if (lead.is_ftd) {
              advertiserMap[advId].conversions++;
            }
          }
        });

        // Affiliate breakdown
        if (lead.affiliates) {
          const affId = lead.affiliates.id;
          if (!affiliateMap[affId]) {
            affiliateMap[affId] = {
              id: affId,
              name: lead.affiliates.name,
              leads: 0,
              conversions: 0,
              cr: 0,
            };
          }
          affiliateMap[affId].leads++;
          if (lead.is_ftd) {
            affiliateMap[affId].conversions++;
          }
        }
      });

      // Calculate CR
      const advertisers = Object.values(advertiserMap).map(a => ({
        ...a,
        cr: a.leads > 0 ? (a.conversions / a.leads) * 100 : 0,
      })).sort((a, b) => b.leads - a.leads);

      const affiliates = Object.values(affiliateMap).map(a => ({
        ...a,
        cr: a.leads > 0 ? (a.conversions / a.leads) * 100 : 0,
      })).sort((a, b) => b.leads - a.leads);

      return { advertisers, affiliates };
    },
  });

  // Get all unique countries for filter dropdown
  const allCountries = useMemo(() => {
    if (!performanceData) return [];
    return performanceData.map(d => d.country_code).sort();
  }, [performanceData]);

  // Filter data based on select and selected countries
  const filteredData = useMemo(() => {
    if (!performanceData) return [];
    
    return performanceData.filter(row => {
      const matchesSelect = countryFilter === "all" || row.country_code === countryFilter;
      const matchesFilter = selectedCountries.size === 0 || 
        selectedCountries.has(row.country_code);
      return matchesSelect && matchesFilter;
    });
  }, [performanceData, countryFilter, selectedCountries]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const totals = filteredData.reduce(
    (acc, row) => ({
      clicks: acc.clicks + row.clicks,
      leads: acc.leads + row.leads,
      accepted: acc.accepted + row.accepted,
      rejected: acc.rejected + row.rejected,
      conversions: acc.conversions + row.conversions,
      pending_conversions: acc.pending_conversions + row.pending_conversions,
    }),
    { clicks: 0, leads: 0, accepted: 0, rejected: 0, conversions: 0, pending_conversions: 0 }
  );

  const totalCR = totals.accepted > 0 ? (totals.conversions / totals.accepted) * 100 : 0;
  const totalC2L = totals.leads > 0 ? (totals.clicks / totals.leads) * 100 : 0;

  const toggleCountry = (country: string) => {
    const newSelected = new Set(selectedCountries);
    if (newSelected.has(country)) {
      newSelected.delete(country);
    } else {
      newSelected.add(country);
    }
    setSelectedCountries(newSelected);
  };

  const clearFilters = () => {
    setSelectedCountries(new Set());
    setCountryFilter("all");
  };

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
          <h1 className="text-3xl font-bold">Country Performance Report</h1>
          <p className="text-muted-foreground text-sm">
            Home / Reports / Country Performance
          </p>
        </div>

        {/* Date Tabs & Filters */}
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* Date bar — presets left, date range right, single row */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b overflow-x-auto">
              <div className="flex gap-1 shrink-0">
                {datePresets.map((preset) => (
                  <button
                    key={preset.key}
                    onClick={() => handlePresetChange(preset.key)}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-none border-b-2 transition-colors whitespace-nowrap",
                      datePreset === preset.key
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {!showAllDates && (
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                        <CalendarIcon className="h-3 w-3" />
                        From: {formatDate(fromDate, "yyyy-MM-dd HH:mm:ss")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
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

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                        <CalendarIcon className="h-3 w-3" />
                        To: {formatDate(toDate, "yyyy-MM-dd HH:mm:ss")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
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

                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { const d = differenceInDays(toDate, fromDate) + 1; setFromDate(new Date(fromDate.getTime() - d * 86400000)); setToDate(new Date(toDate.getTime() - d * 86400000)); setDatePreset("custom"); }}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs text-muted-foreground min-w-[28px] text-center">{differenceInDays(toDate, fromDate) + 1}d</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { const d = differenceInDays(toDate, fromDate) + 1; setFromDate(new Date(fromDate.getTime() + d * 86400000)); setToDate(new Date(toDate.getTime() + d * 86400000)); setDatePreset("custom"); }}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-full sm:w-[160px] h-9">
                  <SelectValue placeholder="All Countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {allCountries.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant={selectedCountries.size > 0 ? "default" : "outline"} size="sm">
                    Filter Countries
                    {selectedCountries.size > 0 && (
                      <span className="ml-2 bg-background text-foreground rounded-full px-2 py-0.5 text-xs">
                        {selectedCountries.size === 1 
                          ? `1 (${Array.from(selectedCountries)[0]})`
                          : selectedCountries.size}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2">
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {allCountries.map((country) => (
                        <div key={country} className="flex items-center space-x-2">
                          <Checkbox
                            id={`country-${country}`}
                            checked={selectedCountries.has(country)}
                            onCheckedChange={() => toggleCountry(country)}
                          />
                          <label
                            htmlFor={`country-${country}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {country}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              {(selectedCountries.size > 0 || countryFilter !== "all") && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
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
            <CardTitle>Country Performance Report</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Country</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead className="text-right">C2L</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Failed Leads</TableHead>
                    <TableHead className="text-right">CR</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData && paginatedData.length > 0 ? (
                    <>
                      {paginatedData.map((row) => (
                        <TableRow
                          key={row.country_code}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedCountryForBreakdown(row.country_code)}
                        >
                          <TableCell className="font-medium">{row.country_code}</TableCell>
                          <TableCell className="text-right">{row.clicks}</TableCell>
                          <TableCell className="text-right">{row.c2l.toFixed(2)}%</TableCell>
                          <TableCell className="text-right">{row.leads}</TableCell>
                          <TableCell className="text-right">{row.rejected}</TableCell>
                          <TableCell className="text-right">{row.cr.toFixed(2)}%</TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell>Total:</TableCell>
                        <TableCell className="text-right">{totals.clicks}</TableCell>
                        <TableCell className="text-right">{totalC2L.toFixed(2)}%</TableCell>
                        <TableCell className="text-right">{totals.leads}</TableCell>
                        <TableCell className="text-right">{totals.rejected}</TableCell>
                        <TableCell className="text-right">{totalCR.toFixed(2)}%</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No data available for the selected period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
          {filteredData.length > 0 && (
            <CardFooter className="pt-0">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredData.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                itemLabel="countries"
              />
            </CardFooter>
          )}
        </Card>

        {/* Breakdown Dialog */}
        <Dialog 
          open={!!selectedCountryForBreakdown} 
          onOpenChange={(open) => !open && setSelectedCountryForBreakdown(null)}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedCountryForBreakdown} - Performance Breakdown
              </DialogTitle>
            </DialogHeader>
            
            <Tabs value={breakdownTab} onValueChange={(v) => setBreakdownTab(v as "advertiser" | "affiliate")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="advertiser">By Advertiser</TabsTrigger>
                <TabsTrigger value="affiliate">By Affiliate</TabsTrigger>
              </TabsList>
              
              <TabsContent value="advertiser" className="mt-4">
                {isBreakdownLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Advertiser</TableHead>
                        <TableHead className="text-right">Leads Sent</TableHead>
                        <TableHead className="text-right">Conversions</TableHead>
                        <TableHead className="text-right">CR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {breakdownData?.advertisers && breakdownData.advertisers.length > 0 ? (
                        breakdownData.advertisers.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="text-right">{row.leads}</TableCell>
                            <TableCell className="text-right">{row.conversions}</TableCell>
                            <TableCell className="text-right">{row.cr.toFixed(2)}%</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                            No advertiser data for this country
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
              
              <TabsContent value="affiliate" className="mt-4">
                {isBreakdownLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Affiliate</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Conversions</TableHead>
                        <TableHead className="text-right">CR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {breakdownData?.affiliates && breakdownData.affiliates.length > 0 ? (
                        breakdownData.affiliates.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="text-right">{row.leads}</TableCell>
                            <TableCell className="text-right">{row.conversions}</TableCell>
                            <TableCell className="text-right">{row.cr.toFixed(2)}%</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                            No affiliate data for this country
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
