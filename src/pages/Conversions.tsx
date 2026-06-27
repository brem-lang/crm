import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, ChevronLeft, ChevronRight, Send, Eye, Copy, Download, Trash2, X, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { differenceInDays } from "date-fns";
import { LeadColumnSelector, type ColumnConfig } from "@/components/leads/LeadColumnSelector";
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
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useCRMSettings } from "@/hooks/useCRMSettings";

type DatePreset = "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "all" | "custom";

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  qualified: "bg-purple-100 text-purple-800",
  converted: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
};

const DEFAULT_CONVERSION_COLUMNS: ColumnConfig[] = [
  { id: "request_id",    label: "Lead ID",       visible: true  },
  { id: "firstname",     label: "First Name",    visible: true  },
  { id: "lastname",      label: "Last Name",     visible: true  },
  { id: "email",         label: "Email",         visible: true  },
  { id: "mobile",        label: "Phone",         visible: true  },
  { id: "country_code",  label: "Country Code",  visible: true  },
  { id: "country",       label: "Country",       visible: true  },
  { id: "city",          label: "City",          visible: true  },
  { id: "ip_address",    label: "IP Address",    visible: false },
  { id: "affiliate",     label: "Affiliate",     visible: true  },
  { id: "created_at",    label: "Created",       visible: true  },
  { id: "status",        label: "Status",        visible: true  },
  { id: "offer_name",    label: "Offer Name",    visible: false },
  { id: "advertiser",    label: "Advertiser",    visible: true  },
  { id: "sale_status",   label: "Sale Status",   visible: true  },
  { id: "ftd_date",      label: "FTD Date",      visible: true  },
  { id: "ftd_id",        label: "FTD ID",        visible: false },
  { id: "injection_ftd", label: "Injection FTD", visible: false },
  { id: "ftd_status",    label: "FTD Status",    visible: true  },
  { id: "is_live",       label: "Live",          visible: false },
  { id: "autologin",     label: "AutoLogin",     visible: false },
  { id: "platform",      label: "Platform",      visible: false },
  { id: "browser",       label: "Browser",       visible: false },
  { id: "user_agent",    label: "User Agent",    visible: false },
  { id: "comment",       label: "Comment",       visible: false },
];

export default function Conversions() {
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
  const [searchEmail, setSearchEmail] = useState("");
  const [advertiserFilter, setAdvertiserFilter] = useState("all");
  const [affiliateFilter, setAffiliateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [releaseConfirmId, setReleaseConfirmId] = useState<string | null>(null);
  const [isRemoveFtdOpen, setIsRemoveFtdOpen] = useState(false);
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem("conversions-column-visibility");
      if (saved) {
        const parsed: Record<string, boolean> = JSON.parse(saved);
        return DEFAULT_CONVERSION_COLUMNS.map(c => ({ ...c, visible: parsed[c.id] ?? c.visible }));
      }
    } catch {}
    return DEFAULT_CONVERSION_COLUMNS;
  });

  const handleToggleColumn = (columnId: string) => {
    setColumns(prev => {
      const next = prev.map(c => c.id === columnId ? { ...c, visible: !c.visible } : c);
      const vis: Record<string, boolean> = {};
      next.forEach(c => { vis[c.id] = c.visible; });
      localStorage.setItem("conversions-column-visibility", JSON.stringify(vis));
      return next;
    });
  };

  const isVisible = (id: string) => columns.find(c => c.id === id)?.visible ?? true;

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

  const queryClient = useQueryClient();

  // Fetch advertisers for filter
  const { data: advertisers } = useQuery({
    queryKey: ['advertisers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('advertisers')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch affiliates for filter
  const { data: affiliates } = useQuery({
    queryKey: ['affiliates-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliates')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: conversions, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['conversions', showAllDates, fromDate, toDate, searchEmail, advertiserFilter, affiliateFilter],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select(`
          id,
          request_id,
          firstname,
          lastname,
          email,
          mobile,
          country_code,
          country,
          city,
          ip_address,
          status,
          is_ftd,
          ftd_date,
          ftd_released,
          ftd_id,
          injection_ftd,
          sale_status,
          offer_name,
          autologin,
          is_live,
          user_agent,
          platform,
          browser,
          comment,
          created_at,
          affiliate_id,
          affiliates (name),
          lead_distributions (
            advertiser_id,
            external_lead_id,
            last_polled_at,
            response,
            advertisers (id, name)
          )
        `)
        .eq('is_ftd', true)
        .order('ftd_date', { ascending: false });
      if (!showAllDates) {
        query = query
          .gte('ftd_date', fromDate.toISOString())
          .lte('ftd_date', toDate.toISOString());
      }

      if (searchEmail) {
        query = query.ilike('email', `%${searchEmail}%`);
      }

      if (affiliateFilter !== "all") {
        query = query.eq('affiliate_id', affiliateFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Filter conversions by advertiser (client-side since it's in nested relation)
  const filteredConversions = useMemo(() => {
    if (!conversions) return [];
    
    let filtered = conversions;

    // Filter by advertiser (from lead_distributions)
    if (advertiserFilter !== "all") {
      filtered = filtered.filter((lead: any) => {
        const distributions = lead.lead_distributions || [];
        return distributions.some((d: any) => d.advertiser_id === advertiserFilter);
      });
    }

    // Filter by status (released/pending)
    if (statusFilter !== "all") {
      filtered = filtered.filter((lead: any) => {
        if (statusFilter === "released") return lead.ftd_released;
        if (statusFilter === "pending") return !lead.ftd_released;
        return true;
      });
    }

    // Filter by country
    if (countryFilter !== "all") {
      filtered = filtered.filter((lead: any) => lead.country_code === countryFilter);
    }

    return filtered;
  }, [conversions, advertiserFilter, statusFilter, countryFilter]);

  // Extract unique countries from conversions
  const uniqueCountries = useMemo(() => {
    if (!conversions) return [];
    const countries = new Set(conversions.map((c: any) => c.country_code).filter(Boolean));
    return Array.from(countries).sort() as string[];
  }, [conversions]);

  const releaseFtd = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from('leads')
        .update({
          ftd_released: true,
          ftd_released_at: new Date().toISOString(),
        })
        .eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("FTD released to affiliate");
      queryClient.invalidateQueries({ queryKey: ['conversions'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: () => {
      toast.error("Failed to release FTD");
    },
  });

  const handleReleaseFtd = (id: string) => {
    setReleaseConfirmId(id);
  };

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // First remove is_ftd flag and ftd_date from leads
      const { error } = await supabase
        .from('leads')
        .update({ is_ftd: false, ftd_date: null, ftd_released: false, ftd_released_at: null })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      toast.success(`Removed FTD status from ${ids.length} lead(s)`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['conversions'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: () => {
      toast.error("Failed to remove FTD status");
    },
  });

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setIsRemoveFtdOpen(true);
  };

  const confirmRemoveFtd = () => {
    bulkDeleteMutation.mutate(Array.from(selectedIds));
    setIsRemoveFtdOpen(false);
  };

  const handleExport = () => {
    const dataToExport = selectedIds.size > 0 
      ? filteredConversions?.filter((c: any) => selectedIds.has(c.id)) 
      : filteredConversions;

    if (!dataToExport || dataToExport.length === 0) {
      toast.error("No data to export");
      return;
    }

    const csvRows = [
      ["Lead ID", "First Name", "Last Name", "Email", "Country", "Affiliate", "Created Date", "Advertiser", "Sale Status", "FTD Date", "Status"].join(","),
      ...dataToExport.map((lead: any) => {
        const distribution = lead.lead_distributions?.[0];
        const advertiserName = distribution?.advertisers?.name || '';
        const affiliateName = lead.affiliates?.name || '';
        return [
          lead.request_id || lead.id,
          `"${(lead.firstname || '').replace(/"/g, '""')}"`,
          `"${(lead.lastname || '').replace(/"/g, '""')}"`,
          `"${(lead.email || '').replace(/"/g, '""')}"`,
          lead.country_code || '',
          `"${(affiliateName).replace(/"/g, '""')}"`,
          lead.created_at ? formatDate(lead.created_at, "yyyy-MM-dd HH:mm:ss") : '',
          `"${(advertiserName).replace(/"/g, '""')}"`,
          lead.sale_status || '',
          lead.ftd_date ? formatDate(lead.ftd_date, "yyyy-MM-dd HH:mm:ss") : '',
          lead.ftd_released ? 'Released' : 'Pending',
        ].join(",");
      }),
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `conversions_${formatDate(fromDate, "yyyy-MM-dd")}_to_${formatDate(toDate, "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${dataToExport.length} conversion(s)`);
  };

  const toggleSelectAll = () => {
    if (!filteredConversions) return;
    if (selectedIds.size === filteredConversions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredConversions.map((c: any) => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
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

  const totalConversions = filteredConversions?.length || 0;
  const releasedConversions = filteredConversions?.filter(c => c.ftd_released).length || 0;
  const pendingConversions = totalConversions - releasedConversions;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Conversions (FTD)</h1>
          <p className="text-muted-foreground text-sm">
            Home / Reports / Conversions
          </p>
        </div>

        {/* Stats Summary */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total FTDs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalConversions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Released</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{releasedConversions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Release</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{pendingConversions}</div>
            </CardContent>
          </Card>
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

            {/* Filters Row */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
              <Select value={advertiserFilter} onValueChange={setAdvertiserFilter}>
                <SelectTrigger className="w-full sm:w-[160px] h-9">
                  <SelectValue placeholder="All Advertisers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Advertisers</SelectItem>
                  {advertisers?.map((adv) => (
                    <SelectItem key={adv.id} value={adv.id}>
                      {adv.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={affiliateFilter} onValueChange={setAffiliateFilter}>
                <SelectTrigger className="w-full sm:w-[160px] h-9">
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

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px] h-9">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="released">Released</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-full sm:w-[140px] h-9">
                  <SelectValue placeholder="All Countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {uniqueCountries.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Search by email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="col-span-2 sm:col-span-1 w-full sm:w-[180px] h-9"
              />

              <div className="col-span-2 sm:col-span-1 sm:ml-auto flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                  <RefreshCw className={`h-4 w-4 mr-2${isFetching ? " animate-spin" : ""}`} />
                  {isFetching ? "Refreshing…" : "Refresh"}
                </Button>
                <LeadColumnSelector columns={columns} onToggle={handleToggleColumn} />
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export {selectedIds.size > 0 ? `(${selectedIds.size})` : "All"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <Card className="border-primary bg-primary/5">
            <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {selectedIds.size} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  className="h-7 gap-1"
                >
                  <X className="h-3 w-3" />
                  Clear
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  className="gap-1.5"
                >
                  <Download className="h-4 w-4" />
                  Export Selected
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteMutation.isPending}
                  className="gap-1.5"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove FTD Status
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Conversions Table */}
        <Card>
          <CardHeader>
            <CardTitle>FTD Conversions</CardTitle>
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
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filteredConversions && filteredConversions.length > 0 && selectedIds.size === filteredConversions.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    {isVisible("request_id")    && <TableHead>Lead ID</TableHead>}
                    {isVisible("firstname")     && <TableHead>First Name</TableHead>}
                    {isVisible("lastname")      && <TableHead>Last Name</TableHead>}
                    {isVisible("email")         && <TableHead>Email</TableHead>}
                    {isVisible("mobile")        && <TableHead>Phone</TableHead>}
                    {isVisible("country_code")  && <TableHead>Country Code</TableHead>}
                    {isVisible("country")       && <TableHead>Country</TableHead>}
                    {isVisible("city")          && <TableHead>City</TableHead>}
                    {isVisible("ip_address")    && <TableHead>IP Address</TableHead>}
                    {isVisible("affiliate")     && <TableHead>Affiliate</TableHead>}
                    {isVisible("created_at")    && <TableHead>Created</TableHead>}
                    {isVisible("status")        && <TableHead>Status</TableHead>}
                    {isVisible("offer_name")    && <TableHead>Offer Name</TableHead>}
                    {isVisible("advertiser")    && <TableHead>Advertiser</TableHead>}
                    {isVisible("sale_status")   && <TableHead>Sale Status</TableHead>}
                    {isVisible("ftd_date")      && <TableHead>FTD Date</TableHead>}
                    {isVisible("ftd_id")        && <TableHead>FTD ID</TableHead>}
                    {isVisible("injection_ftd") && <TableHead>Injection FTD</TableHead>}
                    {isVisible("ftd_status")    && <TableHead>FTD Status</TableHead>}
                    {isVisible("is_live")       && <TableHead>Live</TableHead>}
                    {isVisible("autologin")     && <TableHead>AutoLogin</TableHead>}
                    {isVisible("platform")      && <TableHead>Platform</TableHead>}
                    {isVisible("browser")       && <TableHead>Browser</TableHead>}
                    {isVisible("user_agent")    && <TableHead>User Agent</TableHead>}
                    {isVisible("comment")       && <TableHead>Comment</TableHead>}
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConversions && filteredConversions.length > 0 ? (
                    filteredConversions.map((lead: any) => {
                      const distribution = lead.lead_distributions?.[0];
                      const advertiserName = distribution?.advertisers?.name || '-';
                      const affiliateName = lead.affiliates?.name || '-';
                      const responseData = distribution?.response;
                      const lastPolledAt = distribution?.last_polled_at;
                      
                      return (
                        <TableRow key={lead.id} className={selectedIds.has(lead.id) ? "bg-muted/50" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(lead.id)}
                              onCheckedChange={() => toggleSelect(lead.id)}
                            />
                          </TableCell>
                          {isVisible("request_id") && (
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                                {(lead.request_id || lead.id).slice(0, 8)}
                              </span>
                            </TableCell>
                          )}
                          {isVisible("firstname") && <TableCell>{lead.firstname}</TableCell>}
                          {isVisible("lastname")  && <TableCell>{lead.lastname}</TableCell>}
                          {isVisible("email") && (
                            <TableCell>
                              <span className="flex items-center gap-1.5 group">
                                <span className="truncate max-w-[150px]">{lead.email}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => { navigator.clipboard.writeText(lead.email); toast.success("Email copied"); }}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </span>
                            </TableCell>
                          )}
                          {isVisible("mobile")       && <TableCell>{lead.mobile || '-'}</TableCell>}
                          {isVisible("country_code") && <TableCell>{lead.country_code}</TableCell>}
                          {isVisible("country")      && <TableCell>{lead.country || '-'}</TableCell>}
                          {isVisible("city")         && <TableCell>{lead.city || '-'}</TableCell>}
                          {isVisible("ip_address")   && <TableCell>{lead.ip_address || '-'}</TableCell>}
                          {isVisible("affiliate")    && <TableCell>{affiliateName}</TableCell>}
                          {isVisible("created_at") && (
                            <TableCell className="text-sm">
                              {lead.created_at ? formatDate(lead.created_at, "yyyy-MM-dd HH:mm") : '-'}
                            </TableCell>
                          )}
                          {isVisible("status") && (
                            <TableCell>
                              <Badge className={`${statusColors["converted"]} pointer-events-none`}>converted</Badge>
                            </TableCell>
                          )}
                          {isVisible("offer_name") && <TableCell>{lead.offer_name || '-'}</TableCell>}
                          {isVisible("advertiser") && <TableCell>{advertiserName}</TableCell>}
                          {isVisible("sale_status") && (
                            <TableCell>
                              {lead.sale_status ? (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                                  {lead.sale_status}
                                </Badge>
                              ) : <span className="text-muted-foreground text-sm">-</span>}
                            </TableCell>
                          )}
                          {isVisible("ftd_date") && (
                            <TableCell>{lead.ftd_date ? formatDate(lead.ftd_date, "yyyy-MM-dd HH:mm") : '-'}</TableCell>
                          )}
                          {isVisible("ftd_id") && <TableCell>{lead.ftd_id || '-'}</TableCell>}
                          {isVisible("injection_ftd") && (
                            <TableCell>
                              {lead.injection_ftd
                                ? <Badge className="bg-purple-100 text-purple-800">FTD</Badge>
                                : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                          )}
                          {isVisible("ftd_status") && (
                            <TableCell>
                              {lead.ftd_released
                                ? <Badge className="bg-green-100 text-green-800">Released</Badge>
                                : <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>}
                            </TableCell>
                          )}
                          {isVisible("is_live") && (
                            <TableCell>
                              {lead.is_live
                                ? <Badge className="bg-green-100 text-green-800">Live</Badge>
                                : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                          )}
                          {isVisible("autologin") && (
                            <TableCell>
                              {lead.autologin
                                ? <span className="max-w-32 truncate block font-mono text-xs" title={lead.autologin}>{lead.autologin}</span>
                                : '-'}
                            </TableCell>
                          )}
                          {isVisible("platform")  && <TableCell>{lead.platform || '-'}</TableCell>}
                          {isVisible("browser")   && <TableCell>{lead.browser || '-'}</TableCell>}
                          {isVisible("user_agent") && (
                            <TableCell>
                              {lead.user_agent
                                ? <span className="max-w-40 truncate block text-xs" title={lead.user_agent}>{lead.user_agent}</span>
                                : '-'}
                            </TableCell>
                          )}
                          {isVisible("comment") && (
                            <TableCell>
                              {lead.comment
                                ? <span className="max-w-32 truncate block" title={lead.comment}>{lead.comment}</span>
                                : '-'}
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {responseData && (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                                    <DialogHeader>
                                      <DialogTitle>Advertiser Response</DialogTitle>
                                    </DialogHeader>
                                    <ScrollArea className="max-h-[400px]">
                                      <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto whitespace-pre-wrap">
                                        {typeof responseData === 'string' 
                                          ? responseData 
                                          : JSON.stringify(responseData, null, 2)}
                                      </pre>
                                    </ScrollArea>
                                    <div className="text-xs text-muted-foreground mt-2">
                                      Last polled: {lastPolledAt ? formatDate(lastPolledAt) : 'Never'}
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              )}
                              {!lead.ftd_released && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReleaseFtd(lead.id)}
                                  disabled={releaseFtd.isPending}
                                  className="gap-1"
                                >
                                  <Send className="h-3 w-3" />
                                  Release
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.filter(c => c.visible).length + 2} className="text-center text-muted-foreground py-8">
                        No conversions found for the selected period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Remove FTD Confirmation */}
      <AlertDialog open={isRemoveFtdOpen} onOpenChange={setIsRemoveFtdOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove FTD Status</AlertDialogTitle>
            <AlertDialogDescription>
              Remove FTD status from {selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''}? This will set <code className="text-xs bg-muted px-1 rounded">is_ftd=false</code> and the affiliate will no longer see them as FTD via the API.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveFtd}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remove FTD from {selectedIds.size} Lead{selectedIds.size !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!releaseConfirmId} onOpenChange={(open) => { if (!open) setReleaseConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release FTD</AlertDialogTitle>
            <AlertDialogDescription>
              Release this FTD to the affiliate? They will see <code>is_ftd=1</code> in the API. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (releaseConfirmId) {
                  releaseFtd.mutate(releaseConfirmId, { onSettled: () => setReleaseConfirmId(null) });
                }
              }}
            >
              {releaseFtd.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Release
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
