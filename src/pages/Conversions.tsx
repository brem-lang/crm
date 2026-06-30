import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import { TablePagination } from "@/components/ui/table-pagination";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CalendarIcon, ChevronLeft, ChevronRight, Send, Eye, Copy, Download, Trash2, X, Loader2, RefreshCw, MoreHorizontal } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { usePageSizeState } from "@/hooks/usePageSizeState";
import { useAuth } from "@/hooks/useAuth";
import { countryData } from "@/components/advertisers/countryData";

type DatePreset = "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "all" | "custom";

const STORAGE_KEY = "conversions-column-visibility";

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  qualified: "bg-purple-100 text-purple-800",
  converted: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
};

const DEFAULT_CONVERSION_COLUMNS: ColumnConfig[] = [
  { id: "request_id",       label: "Lead ID",          visible: true  },
  { id: "firstname",        label: "First Name",       visible: true  },
  { id: "lastname",         label: "Last Name",        visible: true  },
  { id: "email",            label: "Email",            visible: true  },
  { id: "mobile",           label: "Phone",            visible: true  },
  { id: "country_code",     label: "Country Code",     visible: true  },
  { id: "country",          label: "Country",          visible: true  },
  { id: "city",             label: "City",             visible: true  },
  { id: "ip_address",       label: "IP Address",       visible: false },
  { id: "status",           label: "Status",           visible: true  },
  { id: "sale_status",      label: "Sale Status",      visible: true  },
  { id: "advertiser",       label: "Advertiser",       visible: true  },
  { id: "advertiser_id",    label: "Advertiser ID",    visible: false },
  { id: "ftd_date",         label: "FTD Date",         visible: true  },
  { id: "ftd_id",           label: "FTD ID",           visible: false },
  { id: "injection_ftd",    label: "Injection FTD",    visible: false },
  { id: "ftd_status",       label: "FTD Status",       visible: true  },
  { id: "affiliate",        label: "Affiliate",        visible: true  },
  { id: "affiliate_id",     label: "Affiliate ID",     visible: false },
  { id: "offer_name",       label: "Offer Name",       visible: false },
  { id: "autologin",        label: "AutoLogin",        visible: false },
  { id: "user_agent",       label: "User Agent",       visible: false },
  { id: "platform",         label: "Platform",         visible: false },
  { id: "browser",          label: "Browser",          visible: false },
  { id: "comment",          label: "Comment",          visible: false },
  { id: "custom1",          label: "Custom 1",         visible: false },
  { id: "custom2",          label: "Custom 2",         visible: false },
  { id: "custom3",          label: "Custom 3",         visible: false },
  { id: "custom4",          label: "Custom 4",         visible: false },
  { id: "custom5",          label: "Custom 5",         visible: false },
  { id: "live_lead_status", label: "Live Lead",        visible: false },
  { id: "live_lead_score",  label: "Live Score",       visible: false },
  { id: "created_at",       label: "Created",          visible: true  },
];

function loadColumns(): ColumnConfig[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_CONVERSION_COLUMNS;
    const parsed: ColumnConfig[] = JSON.parse(saved);
    if (!Array.isArray(parsed)) return DEFAULT_CONVERSION_COLUMNS;
    const savedById = new Map(parsed.map(c => [c.id, c]));
    const savedOrder = parsed
      .map(s => {
        const def = DEFAULT_CONVERSION_COLUMNS.find(c => c.id === s.id);
        return def ? { ...def, visible: !!s.visible } : null;
      })
      .filter((c): c is ColumnConfig => c !== null);
    const newCols = DEFAULT_CONVERSION_COLUMNS.filter(c => !savedById.has(c.id));
    return [...savedOrder, ...newCols];
  } catch {
    return DEFAULT_CONVERSION_COLUMNS;
  }
}

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
  const { isSuperAdmin } = useAuth();

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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = usePageSizeState();
  const [viewResponseLead, setViewResponseLead] = useState<any | null>(null);
  const [columns, setColumns] = useState<ColumnConfig[]>(loadColumns);

  const handleToggleColumn = (columnId: string) => {
    setColumns(prev => {
      const next = prev.map(c => c.id === columnId ? { ...c, visible: !c.visible } : c);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleReorderColumns = (newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newColumns));
  };

  const visibleColumns = columns.filter(c => c.visible);

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
          user_agent,
          platform,
          browser,
          comment,
          custom1,
          custom2,
          custom3,
          custom4,
          custom5,
          live_lead_status,
          live_lead_score,
          created_at,
          affiliate_id,
          advertiser_id,
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

  const filteredConversions = useMemo(() => {
    if (!conversions) return [];

    let filtered = conversions;

    if (advertiserFilter !== "all") {
      filtered = filtered.filter((lead: any) => {
        const distributions = lead.lead_distributions || [];
        return distributions.some((d: any) => d.advertiser_id === advertiserFilter);
      });
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((lead: any) => {
        if (statusFilter === "released") return lead.ftd_released;
        if (statusFilter === "pending") return !lead.ftd_released;
        return true;
      });
    }

    if (countryFilter !== "all") {
      filtered = filtered.filter((lead: any) => lead.country_code === countryFilter);
    }

    return filtered;
  }, [conversions, advertiserFilter, statusFilter, countryFilter]);

  const uniqueCountries = useMemo(() => {
    if (!conversions) return [];
    const countries = new Set(conversions.map((c: any) => c.country_code).filter(Boolean));
    return Array.from(countries).sort() as string[];
  }, [conversions]);

  const totalPages = Math.max(1, Math.ceil((filteredConversions?.length ?? 0) / pageSize));
  const paginatedConversions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredConversions?.slice(start, start + pageSize) ?? [];
  }, [filteredConversions, currentPage, pageSize]);

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

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
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

  const renderCellValue = (lead: any, columnId: string) => {
    const distribution = lead.lead_distributions?.[0];
    const advertiserName = distribution?.advertisers?.name || '-';
    const affiliateName = lead.affiliates?.name || '-';

    switch (columnId) {
      case "request_id":
        return (
          <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
            {(lead.request_id || lead.id).slice(0, 8)}
          </span>
        );
      case "firstname": return lead.firstname || '-';
      case "lastname":  return lead.lastname || '-';
      case "email":
        return (
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
        );
      case "mobile": return lead.mobile || '-';
      case "country_code":
        return lead.country_code ? <Badge variant="secondary">{lead.country_code}</Badge> : '-';
      case "country": {
        const name = lead.country || countryData[lead.country_code?.toUpperCase()]?.name;
        return name || '-';
      }
      case "city":       return lead.city || '-';
      case "ip_address": return lead.ip_address || '-';
      case "affiliate":  return affiliateName;
      case "affiliate_id":
        return lead.affiliate_id ? <span className="font-mono text-xs">{lead.affiliate_id}</span> : '-';
      case "advertiser": return advertiserName;
      case "advertiser_id":
        return lead.advertiser_id ? <span className="font-mono text-xs">{lead.advertiser_id}</span> : '-';
      case "created_at":
        return lead.created_at ? formatDate(lead.created_at, "yyyy-MM-dd HH:mm") : '-';
      case "status":
        return <Badge className={`${statusColors["converted"]} pointer-events-none`}>converted</Badge>;
      case "offer_name": return lead.offer_name || '-';
      case "sale_status":
        return lead.sale_status ? (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
            {lead.sale_status}
          </Badge>
        ) : '-';
      case "ftd_date":
        return lead.ftd_date ? formatDate(lead.ftd_date, "yyyy-MM-dd HH:mm") : '-';
      case "ftd_id": return lead.ftd_id || '-';
      case "injection_ftd":
        return lead.injection_ftd
          ? <Badge className="bg-purple-100 text-purple-800">FTD</Badge>
          : '-';
      case "ftd_status":
        return lead.ftd_released
          ? <Badge className="bg-green-100 text-green-800">Released</Badge>
          : <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "autologin":
        return lead.autologin
          ? <span className="max-w-32 truncate block font-mono text-xs" title={lead.autologin}>{lead.autologin}</span>
          : '-';
      case "platform":   return lead.platform || '-';
      case "browser":    return lead.browser || '-';
      case "user_agent":
        return lead.user_agent
          ? <span className="max-w-40 truncate block text-xs" title={lead.user_agent}>{lead.user_agent}</span>
          : '-';
      case "comment":
        return lead.comment
          ? <span className="max-w-32 truncate block" title={lead.comment}>{lead.comment}</span>
          : '-';
      case "custom1": return lead.custom1 || '-';
      case "custom2": return lead.custom2 || '-';
      case "custom3": return lead.custom3 || '-';
      case "custom4": return lead.custom4 || '-';
      case "custom5": return lead.custom5 || '-';
      case "live_lead_status": {
        const statusMap: Record<string, { label: string; className: string }> = {
          green:       { label: "Live",        className: "bg-green-100 text-green-800" },
          orange:      { label: "Likely Live", className: "bg-amber-100 text-amber-800" },
          "light-red": { label: "Suspicious",  className: "bg-orange-100 text-orange-800" },
          red:         { label: "NO",          className: "bg-red-100 text-red-800" },
        };
        const s = lead.live_lead_status;
        if (!s) return '-';
        const entry = statusMap[s];
        return entry
          ? <Badge className={entry.className}>{entry.label}</Badge>
          : <Badge variant="secondary">{s}</Badge>;
      }
      case "live_lead_score":
        return lead.live_lead_score != null ? String(lead.live_lead_score) : '-';
      default:
        return '-';
    }
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
                <LeadColumnSelector
                  columns={columns}
                  onToggle={handleToggleColumn}
                  onReorder={handleReorderColumns}
                  isSuperAdmin={isSuperAdmin}
                />
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={filteredConversions && filteredConversions.length > 0 && selectedIds.size === filteredConversions.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      {visibleColumns.map(col => (
                        <TableHead key={col.id}>{col.label}</TableHead>
                      ))}
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedConversions && paginatedConversions.length > 0 ? (
                      paginatedConversions.map((lead: any) => {
                        const distribution = lead.lead_distributions?.[0];
                        const responseData = distribution?.response;

                        return (
                          <TableRow key={lead.id} className={selectedIds.has(lead.id) ? "bg-muted/50" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(lead.id)}
                                onCheckedChange={() => toggleSelect(lead.id)}
                              />
                            </TableCell>
                            {visibleColumns.map(col => (
                              <TableCell key={col.id}>
                                {renderCellValue(lead, col.id)}
                              </TableCell>
                            ))}
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {responseData && (
                                    <DropdownMenuItem onClick={() => setViewResponseLead(lead)}>
                                      <Eye className="h-4 w-4 mr-2" />
                                      View Response
                                    </DropdownMenuItem>
                                  )}
                                  {!lead.ftd_released && (
                                    <>
                                      {responseData && <DropdownMenuSeparator />}
                                      <DropdownMenuItem onClick={() => handleReleaseFtd(lead.id)}>
                                        <Send className="h-4 w-4 mr-2" />
                                        Release FTD
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={visibleColumns.length + 2} className="text-center text-muted-foreground py-8">
                          No conversions found for the selected period
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          {(filteredConversions?.length ?? 0) > 0 && (
            <CardFooter className="pt-0">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredConversions?.length ?? 0}
                onPageChange={setCurrentPage}
                onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                itemLabel="conversions"
              />
            </CardFooter>
          )}
        </Card>
      </div>

      {/* View Response Dialog */}
      <Dialog open={!!viewResponseLead} onOpenChange={() => setViewResponseLead(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Advertiser Response</DialogTitle>
          </DialogHeader>
          {viewResponseLead && (
            <>
              <ScrollArea className="max-h-[400px]">
                <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto whitespace-pre-wrap">
                  {(() => {
                    const rd = viewResponseLead.lead_distributions?.[0]?.response;
                    if (!rd) return "No response";
                    return typeof rd === "string" ? rd : JSON.stringify(rd, null, 2);
                  })()}
                </pre>
              </ScrollArea>
              <div className="text-xs text-muted-foreground mt-2">
                Last polled: {viewResponseLead.lead_distributions?.[0]?.last_polled_at
                  ? formatDate(viewResponseLead.lead_distributions[0].last_polled_at)
                  : "Never"}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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
