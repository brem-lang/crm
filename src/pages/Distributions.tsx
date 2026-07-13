import React, { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TablePagination } from "@/components/ui/table-pagination";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MultiSelect } from "@/components/ui/multi-select";
import { countryData } from "@/components/advertisers/countryData";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { format, startOfDay, endOfDay } from "date-fns";
import { CheckCircle, XCircle, Search, Eye, RefreshCw, ExternalLink, Trash2 } from "lucide-react";
import { DateFilterBar } from "@/components/filters/DateFilterBar";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { usePageSizeState } from "@/hooks/usePageSizeState";
import { useBulkDeleteDistributions } from "@/hooks/useDistributions";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { deepParseJsonStrings } from "@/lib/utils";

const statusIcons = {
  sent: <CheckCircle className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
};

const statusColors = {
  sent: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

// Columns shared conceptually with the Leads page's own columns — each
// lists the Leads column id(s) it corresponds to, so the Leads page's
// saved `leads_column_order` (super_admin-managed, in crm_settings) can
// reorder these the same way. Columns with no Leads counterpart (the
// distribution-specific ones) are appended after these, always in the
// same relative order.
interface DistColumn {
  key: string;
  label: string;
  orderIds: string[];
  cell: (dist: Distribution) => React.ReactNode;
}

const MAPPED_COLUMNS: DistColumn[] = [
  {
    key: "request_id",
    label: "Lead ID",
    orderIds: ["request_id"],
    cell: (dist) => {
      const fullLeadId = dist.leads?.request_id || dist.lead_id;
      return (
        <span className="font-mono text-xs bg-muted px-2 py-1 rounded" title={fullLeadId}>
          {fullLeadId.slice(0, 8)}
        </span>
      );
    },
  },
  {
    key: "firstname",
    label: "First Name",
    orderIds: ["firstname"],
    cell: (dist) => <span className="font-medium">{dist.leads?.firstname || "-"}</span>,
  },
  {
    key: "lastname",
    label: "Last Name",
    orderIds: ["lastname"],
    cell: (dist) => <span className="font-medium">{dist.leads?.lastname || "-"}</span>,
  },
  {
    key: "email",
    label: "Email",
    orderIds: ["email"],
    cell: (dist) => <span className="text-sm">{dist.leads?.email || "-"}</span>,
  },
  {
    key: "mobile",
    label: "Phone",
    orderIds: ["mobile"],
    cell: (dist) => <span className="text-sm">{dist.leads?.mobile || "-"}</span>,
  },
  {
    key: "country_code",
    label: "Country",
    orderIds: ["country_code", "country"],
    cell: (dist) => <>{dist.leads?.country_code || "-"}</>,
  },
  {
    key: "sale_status",
    label: "Sale Status",
    orderIds: ["sale_status"],
    cell: (dist) =>
      dist.leads?.sale_status ? (
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
          {dist.leads.sale_status}
        </Badge>
      ) : (
        <span className="text-muted-foreground text-sm">-</span>
      ),
  },
  {
    key: "advertiser",
    label: "Advertiser",
    orderIds: ["advertiser"],
    cell: (dist) =>
      dist.advertisers?.name ? (
        <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
          {dist.advertisers.name}
        </Badge>
      ) : (
        <span className="text-muted-foreground text-sm">-</span>
      ),
  },
  {
    key: "affiliate",
    label: "Affiliate",
    orderIds: ["affiliate"],
    cell: (dist) => <>{dist.affiliates?.name || "-"}</>,
  },
  {
    key: "autologin",
    label: "Autologin",
    orderIds: ["autologin"],
    cell: (dist) =>
      dist.autologin_url ? (
        <a
          href={dist.autologin_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
        >
          <ExternalLink className="h-3 w-3" />
          Open
        </a>
      ) : (
        <span className="text-muted-foreground text-sm">-</span>
      ),
  },
];

// Distribution-specific columns with no Leads counterpart — always appended
// after the mapped/reorderable ones above, in this fixed relative order.
const EXTRA_COLUMNS: DistColumn[] = [
  {
    key: "lead_status",
    label: "Lead Status",
    orderIds: [],
    cell: (dist) =>
      dist.leads?.status ? (
        <Badge variant="secondary" className="text-xs">
          {dist.leads.status}
        </Badge>
      ) : (
        <span className="text-muted-foreground text-sm">-</span>
      ),
  },
  {
    key: "status",
    label: "Status",
    orderIds: [],
    cell: (dist) => (
      <div className="flex items-center gap-2">
        {statusIcons[dist.status as keyof typeof statusIcons]}
        <Badge className={statusColors[dist.status as keyof typeof statusColors]}>
          {dist.status}
        </Badge>
      </div>
    ),
  },
  {
    key: "sent_at",
    label: "Sent At",
    orderIds: [],
    cell: (dist) => <>{dist.sent_at ? format(new Date(dist.sent_at), "MMM d, yyyy HH:mm") : "-"}</>,
  },
];

interface Distribution {
  id: string;
  lead_id: string;
  advertiser_id: string;
  affiliate_id: string | null;
  status: string;
  response: string | null;
  autologin_url: string | null;
  sent_at: string | null;
  created_at: string;
  leads: { firstname: string; lastname: string; email: string; mobile: string | null; country_code: string; request_id: string | null; sale_status: string | null; status: string | null } | null;
  advertisers: { name: string; advertiser_type: string } | null;
  affiliates: { name: string } | null;
}

export default function Distributions() {
  const { getStartOfMonth, getEndOfMonth, getNow } = useCRMSettings();
  const { data: systemSettings } = useSystemSettings();

  // Reorder the mapped columns to match the Leads page's saved column
  // order (crm_settings.leads_column_order), falling back to MAPPED_COLUMNS'
  // own default order when nothing's been customized yet.
  const orderedColumns = useMemo(() => {
    const orderIds = systemSettings?.leads_column_order;
    if (!orderIds || orderIds.length === 0) return MAPPED_COLUMNS;

    const seen = new Set<string>();
    const ordered: DistColumn[] = [];
    for (const id of orderIds) {
      const col = MAPPED_COLUMNS.find((c) => !seen.has(c.key) && c.orderIds.includes(id));
      if (col) {
        ordered.push(col);
        seen.add(col.key);
      }
    }
    for (const col of MAPPED_COLUMNS) {
      if (!seen.has(col.key)) ordered.push(col);
    }
    return ordered;
  }, [systemSettings?.leads_column_order]);

  const displayColumns = useMemo(() => [...orderedColumns, ...EXTRA_COLUMNS], [orderedColumns]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [advertiserFilter, setAdvertiserFilter] = useState<string>("all");
  const [affiliateFilter, setAffiliateFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string[]>([]);
  const [selectedDistribution, setSelectedDistribution] = useState<Distribution | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const bulkDeleteMutation = useBulkDeleteDistributions();
  
  // Date filter state - use timezone-aware helpers
  const [showAllDates, setShowAllDates] = useState(false);
  const [fromDate, setFromDate] = useState<Date>(() => getStartOfMonth(getNow()));
  const [toDate, setToDate] = useState<Date>(() => getEndOfMonth(getNow()));

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = usePageSizeState();
  const pageSizeOptions = [5, 10, 15, 25, 50, 100, 200];

  const { data: distributions, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['distributions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_distributions')
        .select(`
          *,
          leads(firstname, lastname, email, mobile, country_code, request_id, sale_status, status),
          advertisers(name, advertiser_type),
          affiliates(name)
        `)
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (error) throw error;
      return data as unknown as Distribution[];
    },
  });

  const { data: advertisers } = useQuery({
    queryKey: ['advertisers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('advertisers')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: affiliates } = useQuery({
    queryKey: ['affiliates-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliates')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Full country list, not just codes present in loaded distributions —
  // matches the Leads page's country filter (Leads.tsx).
  const countries = useMemo(() => Object.keys(countryData).sort(), []);

  // Memoize date boundaries for queries
  const fromStartISO = useMemo(() => startOfDay(fromDate).toISOString(), [fromDate]);
  const toEndISO = useMemo(() => endOfDay(toDate).toISOString(), [toDate]);

  // Get rejected leads count filtered by date range
  const { data: rejectedCount } = useQuery({
    queryKey: ['rejected-leads-count', fromStartISO, toEndISO],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('rejected_leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', fromStartISO)
        .lte('created_at', toEndISO);
      if (error) throw error;
      return count || 0;
    },
  });

  // Filter distributions
  const filteredDistributions = useMemo(() => {
    return distributions?.filter(dist => {
      const matchesSearch = searchTerm === "" || 
        dist.leads?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dist.leads?.firstname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dist.leads?.lastname?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || dist.status === statusFilter;
      
      const matchesAdvertiser = advertiserFilter === "all" || dist.advertiser_id === advertiserFilter;

      const matchesAffiliate = affiliateFilter === "all" || dist.affiliate_id === affiliateFilter;

      const matchesCountry = countryFilter.length === 0 || (dist.leads?.country_code && countryFilter.includes(dist.leads.country_code));

      // Date filter - ensure proper day boundaries
      const distDate = new Date(dist.created_at);
      const fromStart = startOfDay(fromDate);
      const toEnd = endOfDay(toDate);
      const matchesDate = showAllDates || (distDate >= fromStart && distDate <= toEnd);

      return matchesSearch && matchesStatus && matchesAdvertiser && matchesAffiliate && matchesCountry && matchesDate;
    }) || [];
  }, [distributions, searchTerm, statusFilter, advertiserFilter, affiliateFilter, countryFilter, fromDate, toDate]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredDistributions.length / pageSize);
  const paginatedDistributions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredDistributions.slice(startIndex, startIndex + pageSize);
  }, [filteredDistributions, currentPage, pageSize]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, advertiserFilter, affiliateFilter, countryFilter, searchTerm, pageSize, fromDate, toDate]);

  // Selection helpers - use paginated distributions for current page selection
  const allVisibleSelected = paginatedDistributions.length > 0 && 
    paginatedDistributions.every(d => selectedIds.has(d.id));
  
  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedDistributions.map(d => d.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedIds), {
      onSuccess: () => {
        setSelectedIds(new Set());
        setShowDeleteDialog(false);
      },
    });
  };

  // Calculate stats from FILTERED distributions (respects date range)
  const distSent = filteredDistributions.filter(d => d.status === 'sent').length;
  const distFailed = filteredDistributions.filter(d => d.status === 'failed').length;
  const totalFailed = distFailed + (rejectedCount || 0);

  const stats = {
    total: filteredDistributions.length + (rejectedCount || 0),
    sent: distSent,
    failed: totalFailed,
  };

  const successRate = (stats.sent + stats.failed) > 0 
    ? Math.round((stats.sent / (stats.sent + stats.failed)) * 100) || 0
    : 0;

  const formatResponse = (response: string | null) => {
    if (!response) return null;
    try {
      const parsed = JSON.parse(response);
      // Some advertisers embed a JSON object as an escaped string in a field
      // like "request_body" — expand those too so the whole response
      // pretty-prints instead of leaving one unreadable escaped line.
      return JSON.stringify(deepParseJsonStrings(parsed), null, 2);
    } catch {
      return response;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Distributions</h1>
            <p className="text-muted-foreground">
              Track lead distributions to advertisers
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2${isFetching ? " animate-spin" : ""}`} />
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        {/* Date Filter Bar with Pagination */}
        <Card className="p-4">
          <DateFilterBar
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
            onShowAllChange={setShowAllDates}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            totalItems={filteredDistributions.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="distributions"
          >
            <SearchableSelect
              value={advertiserFilter}
              onValueChange={setAdvertiserFilter}
              options={(advertisers ?? []).map((adv) => ({ value: adv.id, label: adv.name }))}
              placeholder="All Advertisers"
              searchPlaceholder="Search advertiser..."
              emptyMessage="No advertisers found"
              className="w-full sm:w-[160px]"
            />
            <SearchableSelect
              value={affiliateFilter}
              onValueChange={setAffiliateFilter}
              options={(affiliates ?? []).map((aff) => ({ value: aff.id, label: aff.name }))}
              placeholder="All Affiliates"
              searchPlaceholder="Search affiliate..."
              emptyMessage="No affiliates found"
              className="w-full sm:w-[160px]"
            />
            <MultiSelect
              options={countries.map((code) => ({ value: code, label: code }))}
              selected={countryFilter}
              onChange={setCountryFilter}
              placeholder="All Countries"
              searchPlaceholder="Search country..."
              emptyMessage="No countries found"
              className="w-full sm:w-[160px]"
            />
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            {selectedIds.size > 0 && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={bulkDeleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({selectedIds.size})
              </Button>
            )}
          </DateFilterBar>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Distributions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Last 200 records</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Sent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.sent}</div>
              <p className="text-xs text-muted-foreground">{successRate}% success rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0}% failure rate
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Distributions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Distributions</CardTitle>
            <CardDescription>
              View and filter lead distribution history
            </CardDescription>
          </CardHeader>
          <CardContent>

            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <p className="text-center text-muted-foreground py-8">
                Failed to load distributions. Please try again.
              </p>
            ) : paginatedDistributions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {searchTerm || statusFilter !== "all" || advertiserFilter !== "all" || affiliateFilter !== "all" || countryFilter.length > 0
                  ? "No distributions match your filters."
                  : "No distributions found."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="whitespace-nowrap">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                      {displayColumns.map((col) => (
                        <TableHead key={col.key}>{col.label}</TableHead>
                      ))}
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedDistributions.map((dist) => (
                      <TableRow key={dist.id} className={selectedIds.has(dist.id) ? "bg-muted/50" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(dist.id)}
                            onCheckedChange={() => toggleSelect(dist.id)}
                            aria-label={`Select ${dist.leads?.email || 'distribution'}`}
                          />
                        </TableCell>
                        {displayColumns.map((col) => (
                          <TableCell key={col.key}>{col.cell(dist)}</TableCell>
                        ))}
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedDistribution(dist)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          {!isLoading && !error && filteredDistributions.length > 0 && (
            <CardFooter className="pt-0">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                pageSizeOptions={pageSizeOptions}
                totalItems={filteredDistributions.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                itemLabel="distributions"
              />
            </CardFooter>
          )}
        </Card>

        {/* Response Detail Modal */}
        <Dialog open={!!selectedDistribution} onOpenChange={() => setSelectedDistribution(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Distribution Details</DialogTitle>
              <DialogDescription>
                View complete distribution information and API response
              </DialogDescription>
            </DialogHeader>
            {selectedDistribution && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Lead</label>
                    <p className="font-medium">
                      {selectedDistribution.leads?.firstname} {selectedDistribution.leads?.lastname}
                    </p>
                    <p className="text-sm text-muted-foreground">{selectedDistribution.leads?.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Advertiser</label>
                    <p className="font-medium">{selectedDistribution.advertisers?.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {selectedDistribution.advertisers?.advertiser_type?.replace('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div className="flex items-center gap-2 mt-1">
                      {statusIcons[selectedDistribution.status as keyof typeof statusIcons]}
                      <Badge className={statusColors[selectedDistribution.status as keyof typeof statusColors]}>
                        {selectedDistribution.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Sent At</label>
                    <p className="font-medium">
                      {selectedDistribution.sent_at 
                        ? format(new Date(selectedDistribution.sent_at), "MMM d, yyyy HH:mm:ss")
                        : "-"
                      }
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Affiliate</label>
                    <p className="font-medium">{selectedDistribution.affiliates?.name || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Created</label>
                    <p className="font-medium">
                      {format(new Date(selectedDistribution.created_at), "MMM d, yyyy HH:mm:ss")}
                    </p>
                  </div>
                </div>

                {selectedDistribution.autologin_url && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Tracking URL</label>
                    <div className="mt-2 flex items-center gap-2">
                      <a
                        href={selectedDistribution.autologin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-primary hover:underline break-all"
                      >
                        <ExternalLink className="h-4 w-4 flex-shrink-0" />
                        {selectedDistribution.autologin_url}
                      </a>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-muted-foreground">API Response</label>
                  <div className="mt-2 bg-muted rounded-lg p-4 overflow-x-auto">
                    <pre className="text-sm whitespace-pre-wrap break-all">
                      {formatResponse(selectedDistribution.response) || "No response recorded"}
                    </pre>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  <p>Lead ID: {selectedDistribution.lead_id}</p>
                  <p>Distribution ID: {selectedDistribution.id}</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Distributions</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedIds.size} distribution{selectedIds.size > 1 ? 's' : ''}? 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
