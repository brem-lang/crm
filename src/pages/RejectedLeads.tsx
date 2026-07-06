import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRejectedLeads, useDeleteRejectedLeads } from "@/hooks/useRejectedLeads";
import { ColumnConfig, LeadColumnSelector } from "@/components/leads/LeadColumnSelector";
import { SortConfig } from "@/components/leads/SortableHeader";
import { RejectedLeadsFilterBar } from "@/components/rejected-leads/RejectedLeadsFilterBar";
import { RejectedLeadsTable } from "@/components/rejected-leads/RejectedLeadsTable";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trash2 } from "lucide-react";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { usePageSizeState } from "@/hooks/usePageSizeState";
import { TablePagination } from "@/components/ui/table-pagination";
import { useCurrentUserPermissions } from "@/hooks/useUserPermissions";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "rejected-leads-column-visibility";

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "request_id",       label: "Lead ID",          visible: true  },
  { id: "firstname",        label: "First Name",       visible: true  },
  { id: "lastname",         label: "Last Name",        visible: true  },
  { id: "email",            label: "Email",            visible: true  },
  { id: "mobile",           label: "Phone",            visible: true  },
  { id: "country_code",     label: "Country Code",     visible: true  },
  { id: "country",          label: "Country",          visible: false },
  { id: "city",             label: "City",             visible: false },
  { id: "ip_address",       label: "IP Address",       visible: false },
  { id: "status",           label: "Status",           visible: true  },
  { id: "sale_status",      label: "Sale Status",      visible: true  },
  { id: "advertiser",       label: "Advertiser",       visible: true  },
  { id: "advertiser_id",    label: "Advertiser ID",    visible: false },
  { id: "is_ftd",           label: "FTD",              visible: true  },
  { id: "ftd_date",         label: "FTD Date",         visible: false },
  { id: "ftd_id",           label: "FTD ID",           visible: false },
  { id: "injection_ftd",    label: "Injection FTD",    visible: true  },
  { id: "affiliate",        label: "Affiliate",        visible: true  },
  { id: "affiliate_id",     label: "Affiliate ID",     visible: false },
  { id: "offer_name",       label: "Offer Name",       visible: true  },
  { id: "autologin",        label: "AutoLogin URL",    visible: false },
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
    if (!saved) return DEFAULT_COLUMNS;
    const parsed: ColumnConfig[] = JSON.parse(saved);
    if (!Array.isArray(parsed)) return DEFAULT_COLUMNS;
    const savedById = new Map(parsed.map(c => [c.id, c]));
    const savedOrder = parsed
      .map(s => {
        const def = DEFAULT_COLUMNS.find(c => c.id === s.id);
        return def ? { ...def, visible: !!s.visible } : null;
      })
      .filter((c): c is ColumnConfig => c !== null);
    const newCols = DEFAULT_COLUMNS.filter(c => !savedById.has(c.id));
    return [...savedOrder, ...newCols];
  } catch {
    return DEFAULT_COLUMNS;
  }
}

const PAGE_SIZE_OPTIONS = [5, 10, 15, 25, 50, 100];

export default function RejectedLeads() {
  const { data: rejectedLeads, isLoading, isFetching, error, refetch } = useRejectedLeads();
  const deleteRejectedLeads = useDeleteRejectedLeads();
  const { formatDate, getStartOfMonth, getEndOfMonth, getNow, getStartOfDay, getEndOfDay } = useCRMSettings();
  const { canDeleteLeads } = useCurrentUserPermissions();
  const { isSuperAdmin } = useAuth();

  const [showAllDates, setShowAllDates] = useState(false);
  const [fromDate, setFromDate] = useState<Date>(() => getStartOfMonth(getNow()));
  const [toDate, setToDate] = useState<Date>(() => getEndOfMonth(getNow()));
  const [search, setSearch] = useState("");
  const [advertiserFilter, setAdvertiserFilter] = useState<string>("all");
  const [affiliateFilter, setAffiliateFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [columns, setColumns] = useState<ColumnConfig[]>(loadColumns);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = usePageSizeState();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: "", direction: null });
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  // Fetch advertisers/affiliates for filter dropdowns
  const { data: advertisers = [] } = useQuery({
    queryKey: ["advertisers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advertisers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: affiliates = [] } = useQuery({
    queryKey: ["affiliates-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliates")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const countries = useMemo(() => {
    const codes = new Set(
      (rejectedLeads || []).map((r: any) => r.leads?.country_code).filter(Boolean)
    );
    return Array.from(codes).sort();
  }, [rejectedLeads]);

  const handleToggleColumn = (columnId: string) => {
    setColumns(prev => {
      const next = prev.map(col =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleReorderColumns = (newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newColumns));
  };

  const visibleColumns = columns.filter(c => c.visible);

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rejectedLeads?.filter((rejection: any) => {
      if (!showAllDates) {
        const rejectedDate = new Date(rejection.created_at);
        const fromStart = getStartOfDay(fromDate);
        const toEnd = getEndOfDay(toDate);
        if (rejectedDate < fromStart || rejectedDate > toEnd) return false;
      }
      if (advertiserFilter !== "all" && rejection.advertiser_id !== advertiserFilter) return false;
      if (affiliateFilter !== "all" && rejection.leads?.affiliate_id !== affiliateFilter) return false;
      if (countryFilter !== "all" && rejection.leads?.country_code !== countryFilter) return false;
      if (term) {
        const lead = rejection.leads as any;
        const haystack = [
          lead?.firstname,
          lead?.lastname,
          lead?.email,
          lead?.mobile,
          lead?.request_id,
          lead?.ip_address,
          lead?.ftd_id,
          rejection.id,
          rejection.lead_id,
          rejection.advertisers?.name,
          lead?.affiliates?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    }) || [];
  }, [rejectedLeads, showAllDates, fromDate, toDate, advertiserFilter, affiliateFilter, countryFilter, search]);

  const sortedLeads = useMemo(() => {
    if (!sortConfig.direction) return filteredLeads;

    return [...filteredLeads].sort((a: any, b: any) => {
      let aVal: any;
      let bVal: any;

      switch (sortConfig.column) {
        case "affiliate":
          aVal = a.leads?.affiliates?.name || "";
          bVal = b.leads?.affiliates?.name || "";
          break;
        case "advertiser":
          aVal = a.advertisers?.name || "";
          bVal = b.advertisers?.name || "";
          break;
        case "created_at":
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        case "ftd_date":
          aVal = a.leads?.ftd_date ? new Date(a.leads.ftd_date).getTime() : 0;
          bVal = b.leads?.ftd_date ? new Date(b.leads.ftd_date).getTime() : 0;
          return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        case "is_ftd":
          aVal = a.leads?.is_ftd ? 1 : 0;
          bVal = b.leads?.is_ftd ? 1 : 0;
          return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        default:
          aVal = a.leads?.[sortConfig.column] ?? "";
          bVal = b.leads?.[sortConfig.column] ?? "";
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortConfig.direction === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return 0;
    });
  }, [filteredLeads, sortConfig]);

  const handleSort = (columnId: string) => {
    setSortConfig((prev) => {
      if (prev.column === columnId) {
        if (prev.direction === "asc") return { column: columnId, direction: "desc" };
        if (prev.direction === "desc") return { column: "", direction: null };
      }
      return { column: columnId, direction: "asc" };
    });
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [showAllDates, fromDate, toDate, advertiserFilter, affiliateFilter, countryFilter, search]);

  const totalPages = Math.ceil(sortedLeads.length / pageSize);
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedLeads.slice(start, start + pageSize);
  }, [sortedLeads, currentPage, pageSize]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(sortedLeads.map((lead: any) => lead.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectChange = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) newSelected.add(id);
    else newSelected.delete(id);
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = () => {
    const itemsToDelete = sortedLeads
      .filter((lead: any) => selectedIds.has(lead.id))
      .map((lead: any) => ({
        id: lead.id,
        source: lead.source,
        lead_id: lead.lead_id,
      }));

    deleteRejectedLeads.mutate(itemsToDelete, {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  const handleConfirmSingleDelete = () => {
    if (!pendingDelete) return;
    deleteRejectedLeads.mutate(
      [{ id: pendingDelete.id, source: pendingDelete.source, lead_id: pendingDelete.lead_id }],
      { onSuccess: () => setPendingDelete(null) }
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Rejected Leads</h1>
            <p className="text-muted-foreground">
              View leads that failed distribution to advertisers
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2${isFetching ? " animate-spin" : ""}`} />
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        <Card className="p-4">
          <RejectedLeadsFilterBar
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={(d) => { setShowAllDates(false); setFromDate(d); }}
            onToDateChange={(d) => { setShowAllDates(false); setToDate(d); }}
            onShowAllDates={() => setShowAllDates(true)}
            advertiserFilter={advertiserFilter}
            onAdvertiserFilterChange={setAdvertiserFilter}
            countryFilter={countryFilter}
            onCountryFilterChange={setCountryFilter}
            affiliateFilter={affiliateFilter}
            onAffiliateFilterChange={setAffiliateFilter}
            freeSearch={search}
            onFreeSearchChange={setSearch}
            advertisers={advertisers}
            affiliates={affiliates}
            countries={countries}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            totalItems={sortedLeads.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          >
            <LeadColumnSelector
              columns={columns}
              onToggle={handleToggleColumn}
              onReorder={handleReorderColumns}
              isSuperAdmin={isSuperAdmin}
            />
            {canDeleteLeads && selectedIds.size > 0 && (
              <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete ({selectedIds.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Rejected Leads</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {selectedIds.size} rejected lead{selectedIds.size > 1 ? "s" : ""}?
                      This action cannot be undone.
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
            )}
          </RejectedLeadsFilterBar>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3 pt-3 border-t">
              <span>
                {selectedIds.size} lead{selectedIds.size !== 1 ? "s" : ""} selected
              </span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear selection
              </Button>
            </div>
          )}
        </Card>

        <Card>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <p className="text-center text-muted-foreground py-8">
                Failed to load rejected leads. Please try again.
              </p>
            ) : sortedLeads.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No rejected leads found.
              </p>
            ) : (
              <RejectedLeadsTable
                rejections={paginatedLeads}
                columns={visibleColumns}
                selectedIds={selectedIds}
                onSelectChange={handleSelectChange}
                onSelectAll={handleSelectAll}
                onDelete={setPendingDelete}
                canDeleteLeads={canDeleteLeads}
                sortConfig={sortConfig}
                onSort={handleSort}
              />
            )}
          </CardContent>
          {sortedLeads.length > 0 && (
            <CardFooter className="pt-0">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                totalItems={sortedLeads.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                itemLabel="rejected leads"
              />
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Single-row delete confirmation */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rejected Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this rejected lead? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSingleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
