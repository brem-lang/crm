import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  ColumnConfig,
  LeadColumnSelector,
} from "@/components/leads/LeadColumnSelector";
import { LeadsFilterBar } from "@/components/leads/LeadsFilterBar";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { ResendLeadsDialog } from "@/components/leads/ResendLeadsDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/ui/table-pagination";
import { useAuth } from "@/hooks/useAuth";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { countryData } from "@/components/advertisers/countryData";
import { useSystemSettings, useUpdateSystemSettings } from "@/hooks/useSystemSettings";
import { usePageSizeState } from "@/hooks/usePageSizeState";
import {
  useBulkAddToTest,
  useBulkDeleteLeads,
  useDeleteLead,
  useLeads,
  useLeadsRealtime,
  useUpdateLead,
} from "@/hooks/useLeads";
import { useCurrentUserPermissions } from "@/hooks/useUserPermissions";
import { useMyAffiliateRestriction } from "@/hooks/useUserAffiliateAssignments";
import { useMyAdvertiserRestriction } from "@/hooks/useUserAdvertiserAssignments";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Download, FlaskConical, RefreshCw, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "leads-column-visibility";
const ADVERTISER_COLUMN_IDS = new Set(["advertiser", "advertiser_id"]);
const NAME_COLUMN_IDS      = new Set(["firstname", "lastname"]);
const ID_COLUMN_IDS        = new Set(["request_id", "api_request_id"]);
const COUNTRY_COLUMN_IDS   = new Set(["country_code", "country", "city"]);
const IP_COLUMN_IDS        = new Set(["ip_address"]);
const STATUS_COLUMN_IDS    = new Set(["status", "sale_status"]);
const FTD_COLUMN_IDS       = new Set(["is_ftd", "ftd_date", "ftd_id", "injection_ftd"]);
const AFFILIATE_COLUMN_IDS = new Set(["affiliate", "affiliate_id"]);
const OFFER_COLUMN_IDS     = new Set(["offer_name"]);
const AUTOLOGIN_COLUMN_IDS = new Set(["autologin"]);
const DEVICE_COLUMN_IDS    = new Set(["user_agent", "platform", "browser"]);
const COMMENT_COLUMN_IDS   = new Set(["comment"]);
const DATE_COLUMN_IDS      = new Set(["created_at"]);
const SCORE_COLUMN_IDS     = new Set(["live_lead_status", "live_lead_score"]);

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "request_id",     label: "Lead ID",     visible: true  },
  { id: "api_request_id", label: "Request ID",  visible: false },
  { id: "firstname", label: "First Name", visible: true },
  { id: "lastname", label: "Last Name", visible: true },
  { id: "email", label: "Email", visible: true },
  { id: "mobile", label: "Phone", visible: true },
  { id: "country_code", label: "Country Code", visible: true },
  { id: "country", label: "Country", visible: false },
  { id: "city", label: "City", visible: false },
  { id: "ip_address",    label: "IP Address", visible: false },
  { id: "locale",        label: "Locale",     visible: false },
  { id: "status", label: "Status", visible: true },
  { id: "sale_status", label: "Sale Status", visible: true },
  { id: "advertiser", label: "Advertiser", visible: true },
  { id: "advertiser_id", label: "Advertiser ID", visible: false },
  { id: "is_ftd", label: "FTD", visible: true },
  { id: "ftd_date", label: "FTD Date", visible: false },
  { id: "ftd_id", label: "FTD ID", visible: false },
  { id: "injection_ftd", label: "Injection FTD", visible: true },
  { id: "affiliate", label: "Affiliate", visible: true },
  { id: "affiliate_id", label: "Affiliate ID", visible: false },
  { id: "offer_name",    label: "Offer Name",    visible: false },
  { id: "click_id",      label: "Click ID",      visible: false },
  { id: "autologin",     label: "AutoLogin URL", visible: false },
  { id: "user_agent",    label: "User Agent",    visible: false },
  { id: "platform",      label: "Platform",      visible: false },
  { id: "browser",       label: "Browser",       visible: false },
  { id: "comment",       label: "Comment",       visible: false },
  { id: "custom1", label: "Custom 1", visible: false },
  { id: "custom2", label: "Custom 2", visible: false },
  { id: "custom3", label: "Custom 3", visible: false },
  { id: "custom4", label: "Custom 4", visible: false },
  { id: "custom5", label: "Custom 5", visible: false },
  { id: "live_lead_status", label: "Live Lead", visible: false },
  { id: "live_lead_score",  label: "Live Score", visible: false },
  { id: "created_at", label: "Created", visible: true },
];

// Reorders `current` to match `orderIds` (the super_admin-managed global order),
// preserving each column's own `visible` flag. Columns not present in `orderIds`
// (e.g. newly added columns not yet in the saved order) are appended at the end.
function applyColumnOrder(current: ColumnConfig[], orderIds: string[]): ColumnConfig[] {
  const byId = new Map(current.map((c) => [c.id, c]));
  const ordered = orderIds
    .map((id) => byId.get(id))
    .filter((c): c is ColumnConfig => !!c);
  const orderedIds = new Set(orderIds);
  const remaining = current.filter((c) => !orderedIds.has(c.id));
  return [...ordered, ...remaining];
}

export default function Leads() {
  useLeadsRealtime(); // Subscribe to realtime updates
  const {
    showLeadId,
    getStartOfMonth,
    getEndOfMonth,
    getNow,
    getStartOfDay,
    getEndOfDay,
    formatDate,
  } = useCRMSettings();
  // null = no restriction; string[] = scoped to these IDs; undefined = still loading
  const { data: affiliateRestriction } = useMyAffiliateRestriction();
  const { data: advertiserRestriction } = useMyAdvertiserRestriction();
  const restrictionsResolved = affiliateRestriction !== undefined && advertiserRestriction !== undefined;
  const { data: leads, isLoading, isFetching, error, refetch } = useLeads({
    filterAffiliateIds: Array.isArray(affiliateRestriction) ? affiliateRestriction : undefined,
    filterAdvertiserIds: Array.isArray(advertiserRestriction) ? advertiserRestriction : undefined,
    enabled: restrictionsResolved,
  });
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const bulkDeleteLeads = useBulkDeleteLeads();
  const bulkAddToTest = useBulkAddToTest();
  const { isSuperAdmin } = useAuth();
  const {
    canViewPhone,
    canViewEmail,
    canExportLeads,
    canDeleteLeads,
    canEditLeads,
    canViewAdvertiserName,
    canViewLeadName,
    canViewLeadId,
    canViewLeadCountry,
    canViewLeadIp,
    canViewLeadStatus,
    canViewLeadFtd,
    canViewLeadAffiliate,
    canViewLeadOffer,
    canViewLeadAutologin,
    canViewLeadDevice,
    canViewLeadComment,
    canViewLeadDate,
    canViewLeadLive,
  } = useCurrentUserPermissions();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{
    column: string;
    direction: "asc" | "desc" | null;
  }>({
    column: "created_at",
    direction: "desc",
  });

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [saleStatusFilter, setSaleStatusFilter] = useState<string[]>([]);
  const [liveLeadStatusFilter, setLiveLeadStatusFilter] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResendOpen, setIsResendOpen] = useState(false);
  const [editForm, setEditForm] = useState({ status: "", is_ftd: false, ftd_id: "" });
  const [deleteLeadId, setDeleteLeadId] = useState<string | null>(null);
  const [releaseFtdId, setReleaseFtdId] = useState<string | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  // Date and advanced filters - use timezone-aware helpers (default to Today)
  const [showAllDates, setShowAllDates] = useState(false);
  const [fromDate, setFromDate] = useState<Date>(() => getStartOfDay(getNow()));
  const [toDate, setToDate] = useState<Date>(() => getEndOfDay(getNow()));
  const [advertiserFilter, setAdvertiserFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [affiliateFilter, setAffiliateFilter] = useState<string>("all");
  const [freeSearch, setFreeSearch] = useState("");

  // Fetch advertisers for filter dropdown
  const { data: advertisers } = useQuery({
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

  // Fetch affiliates for filter dropdown
  const { data: affiliates } = useQuery({
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

  // Extract unique countries from leads
  const countries = useMemo(() => {
    const codes = new Set(
      leads?.map((l) => l.country_code).filter(Boolean) || [],
    );
    return Array.from(codes).sort();
  }, [leads]);

  // Extract unique sale statuses from leads
  const saleStatuses = useMemo(() => {
    const statuses = new Set(
      leads?.map((l) => l.sale_status).filter(Boolean) || [],
    );
    return Array.from(statuses).sort();
  }, [leads]);

  // Pagination state - use settings default
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = usePageSizeState();
  const pageSizeOptions = [5, 10, 15, 25, 50, 100, 200];
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ColumnConfig[];
        // Reconcile old saved configs with current defaults (e.g. replace old "name" column
        // with new "firstname" + "lastname" columns).
        const savedById = new Map(parsed.map((c) => [c.id, c]));
        // Preserve saved order; append any new columns not yet in saved state
        const savedOrder = parsed
          .map((saved) => {
            const def = DEFAULT_COLUMNS.find((c) => c.id === saved.id);
            if (!def) return null;
            if (def.id === "request_id") return { ...def, visible: saved.visible ?? showLeadId };
            return { ...def, visible: !!saved.visible };
          })
          .filter((c): c is ColumnConfig => c !== null);
        const newCols = DEFAULT_COLUMNS.filter((c) => !savedById.has(c.id)).map((col) =>
          col.id === "request_id" ? { ...col, visible: showLeadId } : col
        );
        return [...savedOrder, ...newCols];
      } catch {
        return DEFAULT_COLUMNS.map((col) =>
          col.id === "request_id" ? { ...col, visible: showLeadId } : col,
        );
      }
    }
    return DEFAULT_COLUMNS.map((col) =>
      col.id === "request_id" ? { ...col, visible: showLeadId } : col,
    );
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  }, [columns]);

  // Super_admin-managed global column order, shared with all roles. Overrides
  // the locally-saved order while preserving each user's own visibility toggles.
  const { data: systemSettings } = useSystemSettings();
  const updateSystemSettings = useUpdateSystemSettings();
  useEffect(() => {
    const orderIds = systemSettings?.leads_column_order;
    if (orderIds && orderIds.length > 0) {
      setColumns((prev) => applyColumnOrder(prev, orderIds));
    }
  }, [systemSettings?.leads_column_order]);

  const handleToggleColumn = (columnId: string) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId ? { ...col, visible: !col.visible } : col,
      ),
    );
  };

  const handleReorderColumns = (newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
    if (isSuperAdmin) {
      updateSystemSettings.mutate({ leads_column_order: newColumns.map((col) => col.id) });
    }
  };

  // Map each column set to its required permission (super admins bypass all)
  const columnPermissions: [Set<string>, boolean][] = [
    [ADVERTISER_COLUMN_IDS, canViewAdvertiserName],
    [NAME_COLUMN_IDS,       canViewLeadName],
    [ID_COLUMN_IDS,         canViewLeadId],
    [COUNTRY_COLUMN_IDS,    canViewLeadCountry],
    [IP_COLUMN_IDS,         canViewLeadIp],
    [STATUS_COLUMN_IDS,     canViewLeadStatus],
    [FTD_COLUMN_IDS,        canViewLeadFtd],
    [AFFILIATE_COLUMN_IDS,  canViewLeadAffiliate],
    [OFFER_COLUMN_IDS,      canViewLeadOffer],
    [AUTOLOGIN_COLUMN_IDS,  canViewLeadAutologin],
    [DEVICE_COLUMN_IDS,     canViewLeadDevice],
    [COMMENT_COLUMN_IDS,    canViewLeadComment],
    [DATE_COLUMN_IDS,       canViewLeadDate],
    [SCORE_COLUMN_IDS,      canViewLeadLive],
  ];

  const effectiveColumns = useMemo(() => {
    if (isSuperAdmin) return columns;
    return columns.map(col => {
      const restricted = columnPermissions.some(
        ([ids, permitted]) => ids.has(col.id) && !permitted
      );
      return restricted ? { ...col, visible: false } : col;
    });
  }, [columns, isSuperAdmin, ...columnPermissions.map(([, p]) => p)]);

  const filteredLeads = useMemo(() => {
    return (
      leads?.filter((lead) => {
        // Internal status filter (sent to affiliates)
        const matchesStatus =
          statusFilter === "all" || lead.status === statusFilter;

        // Sale status filter (from advertiser CRM) - multi-select
        const matchesSaleStatus =
          saleStatusFilter.length === 0 ||
          (lead.sale_status && saleStatusFilter.includes(lead.sale_status));

        // Live lead status filter
        const matchesLiveLeadStatus =
          liveLeadStatusFilter === "all" ||
          (lead as any).live_lead_status === liveLeadStatusFilter;

        // Date range filter - use timezone-aware day boundaries
        // Also match leads injected within the range (injection_sent_at), even if created earlier
        const fromStart = getStartOfDay(fromDate);
        const toEnd = getEndOfDay(toDate);
        const createdDate = new Date(lead.created_at);
        const injectedDate = (lead as any).injection_sent_at
          ? new Date((lead as any).injection_sent_at)
          : null;
        const matchesDate =
          showAllDates ||
          (createdDate >= fromStart && createdDate <= toEnd) ||
          (injectedDate !== null &&
            injectedDate >= fromStart &&
            injectedDate <= toEnd);

        // Advertiser filter - check lead_distributions
        const matchesAdvertiser =
          advertiserFilter === "all" ||
          (lead as any).lead_distributions?.some(
            (d: any) => d.advertiser_id === advertiserFilter,
          );

        // Country filter
        const matchesCountry =
          countryFilter === "all" || lead.country_code === countryFilter;

        // Affiliate filter by ID
        const matchesAffiliate =
          affiliateFilter === "all" || lead.affiliate_id === affiliateFilter;

        // Free search across ID, email, phone, IP (case-insensitive contains)
        let matchesFreeSearch = true;
        if (freeSearch.trim()) {
          const searchLower = freeSearch.toLowerCase().trim();
          const leadIdVal = (lead.id || "").toLowerCase();
          const reqIdVal = (lead.request_id || "").toLowerCase();
          const affIdVal = ((lead as any).affiliate_id || "").toLowerCase();
          const sentDistForSearch = (lead as any).lead_distributions?.find((d: any) => d.status === "sent");
          const advIdVal = (sentDistForSearch?.advertiser_id || "").toLowerCase();
          const ftdIdVal = ((lead as any).ftd_id || "").toLowerCase();
          const email = (lead.email || "").toLowerCase();
          const phone = (lead.mobile || "").toLowerCase();
          const ip = (lead.ip_address || "").toLowerCase();
          matchesFreeSearch =
            leadIdVal.includes(searchLower) ||
            reqIdVal.includes(searchLower) ||
            affIdVal.includes(searchLower) ||
            advIdVal.includes(searchLower) ||
            ftdIdVal.includes(searchLower) ||
            email.includes(searchLower) ||
            phone.includes(searchLower) ||
            ip.includes(searchLower);
        }

        return (
          matchesStatus &&
          matchesSaleStatus &&
          matchesDate &&
          matchesAdvertiser &&
          matchesCountry &&
          matchesAffiliate &&
          matchesFreeSearch &&
          matchesLiveLeadStatus
        );
      }) || []
    );
  }, [
    leads,
    statusFilter,
    saleStatusFilter,
    showAllDates,
    fromDate,
    toDate,
    advertiserFilter,
    countryFilter,
    affiliateFilter,
    freeSearch,
    liveLeadStatusFilter,
    getStartOfDay,
    getEndOfDay,
  ]);

  // Sorted leads
  const sortedLeads = useMemo(() => {
    if (!sortConfig.direction) return filteredLeads;

    return [...filteredLeads].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortConfig.column) {
        case "firstname":
        case "lastname":
        case "email":
        case "mobile":
        case "country_code":
        case "status":
          aVal = a[sortConfig.column] || "";
          bVal = b[sortConfig.column] || "";
          break;
        case "affiliate":
          aVal = (a as any).affiliates?.name || "";
          bVal = (b as any).affiliates?.name || "";
          break;
        case "created_at": {
          // Sort by the most recent activity: injection_sent_at if present, otherwise created_at
          const aInj = (a as any).injection_sent_at
            ? new Date((a as any).injection_sent_at).getTime()
            : 0;
          const bInj = (b as any).injection_sent_at
            ? new Date((b as any).injection_sent_at).getTime()
            : 0;
          aVal = Math.max(new Date(a.created_at).getTime(), aInj);
          bVal = Math.max(new Date(b.created_at).getTime(), bInj);
          return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        }
        case "ftd_date":
          aVal = a[sortConfig.column]
            ? new Date(a[sortConfig.column]).getTime()
            : 0;
          bVal = b[sortConfig.column]
            ? new Date(b[sortConfig.column]).getTime()
            : 0;
          return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        case "is_ftd":
          aVal = a.is_ftd ? 1 : 0;
          bVal = b.is_ftd ? 1 : 0;
          return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        default:
          aVal = a[sortConfig.column] || "";
          bVal = b[sortConfig.column] || "";
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortConfig.direction === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return 0;
    });
  }, [filteredLeads, sortConfig]);

  // Pagination calculations
  const totalPages = Math.ceil(sortedLeads.length / pageSize);
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedLeads.slice(startIndex, startIndex + pageSize);
  }, [sortedLeads, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    statusFilter,
    saleStatusFilter,
    liveLeadStatusFilter,
    showAllDates,
    pageSize,
    fromDate,
    toDate,
    advertiserFilter,
    countryFilter,
    affiliateFilter,
    freeSearch,
  ]);

  const handleSort = (columnId: string) => {
    setSortConfig((prev) => {
      if (prev.column === columnId) {
        // Cycle: asc -> desc -> null
        if (prev.direction === "asc")
          return { column: columnId, direction: "desc" };
        if (prev.direction === "desc") return { column: "", direction: null };
      }
      return { column: columnId, direction: "asc" };
    });
  };

  const handleEdit = (lead: any) => {
    setSelectedLead(lead);
    setEditForm({ status: lead.status, is_ftd: lead.is_ftd, ftd_id: lead.ftd_id || "" });
    setIsEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (selectedLead) {
      updateLead.mutate({
        id: selectedLead.id,
        status: editForm.status as any,
        is_ftd: editForm.is_ftd,
        ftd_date:
          editForm.is_ftd && !selectedLead.is_ftd
            ? new Date().toISOString()
            : selectedLead.ftd_date,
        ftd_id: editForm.ftd_id || null,
      });
      setIsEditOpen(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteLeadId(id);
  };

  const confirmDelete = () => {
    if (deleteLeadId) deleteLead.mutate(deleteLeadId);
    setDeleteLeadId(null);
  };

  const handleReleaseFtd = (id: string) => {
    setReleaseFtdId(id);
  };

  const confirmReleaseFtd = () => {
    if (releaseFtdId) {
      updateLead.mutate({
        id: releaseFtdId,
        ftd_released: true,
        ftd_released_at: new Date().toISOString(),
      });
    }
    setReleaseFtdId(null);
  };

  const handleSelectChange = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && paginatedLeads) {
      setSelectedIds(new Set(paginatedLeads.map((l) => l.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleteOpen(true);
  };

  const confirmBulkDelete = () => {
    bulkDeleteLeads.mutate(Array.from(selectedIds), {
      onSuccess: () => setSelectedIds(new Set()),
    });
    setIsBulkDeleteOpen(false);
  };

  // Plain-text counterpart to LeadsTable's renderCellValue, used for CSV export
  // so the exported columns/values match what's actually visible in the table.
  const getExportValue = (lead: any, columnId: string): string => {
    switch (columnId) {
      case "request_id": return lead.id || "";
      case "api_request_id": return lead.request_id || "";
      case "firstname": return lead.firstname || "";
      case "lastname": return lead.lastname || "";
      case "email": return canViewEmail ? (lead.email || "") : "***";
      case "mobile": return canViewPhone ? (lead.mobile || "") : "***";
      case "country_code": return lead.country_code || "";
      case "country": return lead.country || countryData[lead.country_code?.toUpperCase()]?.name || "";
      case "city": return lead.city || "";
      case "ip_address": return lead.ip_address || "";
      case "locale": return lead.locale || "";
      case "status": return lead.is_ftd ? "converted" : lead.status || "";
      case "sale_status": return lead.sale_status || "";
      case "advertiser": {
        const sentDist = lead.lead_distributions?.find((d: any) => d.status === "sent");
        return sentDist?.advertisers?.name || "";
      }
      case "advertiser_id": {
        const sentDist = lead.lead_distributions?.find((d: any) => d.status === "sent");
        return sentDist?.advertiser_id || "";
      }
      case "is_ftd": return lead.is_ftd ? (lead.ftd_released ? "Released" : "Pending") : "No";
      case "ftd_date": return lead.ftd_date ? formatDate(lead.ftd_date) : "";
      case "ftd_id": return lead.ftd_id || "";
      case "injection_ftd": return lead.injection_ftd ? "FTD" : "";
      case "affiliate": return lead.affiliates?.name || "";
      case "affiliate_id": return lead.affiliate_id || "";
      case "offer_name": return lead.offer_name || "";
      case "click_id": return lead.click_id || "";
      case "autologin": return lead.autologin || "";
      case "user_agent": return lead.user_agent || "";
      case "platform": return lead.platform || "";
      case "browser": return lead.browser || "";
      case "comment": return lead.comment || "";
      case "custom1": return lead.custom1 || "";
      case "custom2": return lead.custom2 || "";
      case "custom3": return lead.custom3 || "";
      case "custom4": return lead.custom4 || "";
      case "custom5": return lead.custom5 || "";
      case "live_lead_status": return lead.live_lead_status || "";
      case "live_lead_score": return lead.live_lead_score != null ? String(lead.live_lead_score) : "";
      case "created_at": return lead.created_at ? formatDate(lead.created_at) : "";
      default: return "";
    }
  };

  const handleBulkExport = () => {
    if (!filteredLeads) return;

    const leadsToExport =
      selectedIds.size > 0
        ? filteredLeads.filter((l) => selectedIds.has(l.id))
        : filteredLeads;

    if (leadsToExport.length === 0) {
      toast.error("No leads to export");
      return;
    }

    // Export only the columns currently visible (and in the same order) in the table
    const exportColumns = effectiveColumns.filter((c) => c.visible);
    if (exportColumns.length === 0) {
      toast.error("No columns selected to export");
      return;
    }

    const headers = exportColumns.map((c) => c.label);
    const rows = leadsToExport.map((lead) =>
      exportColumns.map((c) => getExportValue(lead, c.id)),
    );

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Exported ${leadsToExport.length} leads`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Leads</h1>
            <p className="text-muted-foreground">
              Manage and track all your leads
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2${isFetching ? " animate-spin" : ""}`} />
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        {/* Date & Advanced Filters */}
        <Card className="p-4">
          <LeadsFilterBar
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
            freeSearch={freeSearch}
            onFreeSearchChange={setFreeSearch}
            advertisers={advertisers}
            affiliates={affiliates}
            countries={countries}
            saleStatuses={saleStatuses}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            saleStatusFilter={saleStatusFilter}
            onSaleStatusFilterChange={setSaleStatusFilter}
            liveLeadStatusFilter={liveLeadStatusFilter}
            onLiveLeadStatusFilterChange={setLiveLeadStatusFilter}
            // Pagination props
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            totalItems={sortedLeads.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          >
            <LeadColumnSelector
              columns={isSuperAdmin ? effectiveColumns : effectiveColumns.filter(col =>
                !columnPermissions.some(([ids, permitted]) => ids.has(col.id) && !permitted)
              )}
              onToggle={handleToggleColumn}
              onReorder={handleReorderColumns}
              isSuperAdmin={isSuperAdmin}
            />
            {canExportLeads && (
              <Button variant="outline" size="sm" onClick={handleBulkExport}>
                <Download className="h-4 w-4 mr-2" />
                Export {selectedIds.size > 0 ? `(${selectedIds.size})` : "All"}
              </Button>
            )}
            {canEditLeads && selectedIds.size > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsResendOpen(true)}
              >
                <Send className="h-4 w-4 mr-2" />
                Resend ({selectedIds.size})
              </Button>
            )}
            {canEditLeads && selectedIds.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  bulkAddToTest.mutate(Array.from(selectedIds), {
                    onSuccess: () => setSelectedIds(new Set()),
                  });
                }}
                disabled={bulkAddToTest.isPending}
              >
                <FlaskConical className="h-4 w-4 mr-2" />
                Add to Test ({selectedIds.size})
              </Button>
            )}
            {canDeleteLeads && selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkDeleteLeads.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({selectedIds.size})
              </Button>
            )}
          </LeadsFilterBar>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3 pt-3 border-t">
              <span>
                {selectedIds.size} lead{selectedIds.size !== 1 ? "s" : ""}{" "}
                selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
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
                Failed to load leads. Please try again.
              </p>
            ) : filteredLeads.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No leads found.
              </p>
            ) : (
              <>
                <LeadsTable
                  leads={paginatedLeads}
                  columns={effectiveColumns}
                  isSuperAdmin={isSuperAdmin}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onReleaseFtd={handleReleaseFtd}
                  onAddToTest={(id) => bulkAddToTest.mutate([id])}
                  selectedIds={selectedIds}
                  onSelectChange={handleSelectChange}
                  onSelectAll={handleSelectAll}
                  canViewPhone={canViewPhone}
                  canViewEmail={canViewEmail}
                  canEditLeads={canEditLeads}
                  canDeleteLeads={canDeleteLeads}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
              </>
            )}
          </CardContent>
          {filteredLeads.length > 0 && (
            <CardFooter className="pt-0">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                pageSizeOptions={pageSizeOptions}
                totalItems={sortedLeads.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                itemLabel="leads"
              />
            </CardFooter>
          )}
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Lead</DialogTitle>
              <DialogDescription>
                Update lead status and FTD information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm({ ...editForm, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_ftd"
                  checked={editForm.is_ftd}
                  onChange={(e) =>
                    setEditForm({ ...editForm, is_ftd: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                <Label htmlFor="is_ftd">Mark as FTD (First Time Deposit)</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ftd_id">FTD ID</Label>
                <Input
                  id="ftd_id"
                  value={editForm.ftd_id}
                  onChange={(e) => setEditForm({ ...editForm, ftd_id: e.target.value })}
                  placeholder="Advertiser's FTD/conversion ID (optional)"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={updateLead.isPending}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Resend Leads Dialog */}
        <ResendLeadsDialog
          open={isResendOpen}
          onOpenChange={setIsResendOpen}
          selectedLeads={sortedLeads.filter((l) => selectedIds.has(l.id))}
          advertisers={advertisers || []}
          onSuccess={() => setSelectedIds(new Set())}
        />

        {/* Delete Lead Confirmation */}
        <AlertDialog open={!!deleteLeadId} onOpenChange={(open) => !open && setDeleteLeadId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Lead</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this lead? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Leads Confirmation */}
        <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedIds.size} Lead{selectedIds.size !== 1 ? 's' : ''}</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmBulkDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete {selectedIds.size} Lead{selectedIds.size !== 1 ? 's' : ''}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Release FTD Confirmation */}
        <AlertDialog open={!!releaseFtdId} onOpenChange={(open) => !open && setReleaseFtdId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Release FTD to Affiliate</AlertDialogTitle>
              <AlertDialogDescription>
                The affiliate will see <code className="text-xs bg-muted px-1 rounded">is_ftd=1</code> for this lead via the API. This cannot be reversed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmReleaseFtd}>
                Release FTD
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
