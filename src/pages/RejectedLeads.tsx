import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRejectedLeads, useDeleteRejectedLeads } from "@/hooks/useRejectedLeads";
import { ColumnConfig, LeadColumnSelector } from "@/components/leads/LeadColumnSelector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { AlertCircle, XCircle, Trash2, Copy } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DateFilterBar } from "@/components/filters/DateFilterBar";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { TablePagination } from "@/components/ui/table-pagination";
import { useCurrentUserPermissions } from "@/hooks/useUserPermissions";
import { toast } from "sonner";

const STORAGE_KEY = "rejected-leads-column-visibility";

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "request_id",      label: "Lead ID",       visible: true  },
  { id: "firstname",       label: "First Name",    visible: true  },
  { id: "lastname",        label: "Last Name",     visible: true  },
  { id: "email",           label: "Email",         visible: true  },
  { id: "mobile",          label: "Phone",         visible: true  },
  { id: "country_code",    label: "Country Code",  visible: true  },
  { id: "country",         label: "Country",       visible: false },
  { id: "city",            label: "City",          visible: false },
  { id: "ip_address",      label: "IP Address",    visible: false },
  { id: "status",          label: "Status",        visible: true  },
  { id: "sale_status",     label: "Sale Status",   visible: true  },
  { id: "advertiser",      label: "Advertiser",    visible: true  },
  { id: "advertiser_id",   label: "Advertiser ID", visible: false },
  { id: "is_ftd",          label: "FTD",           visible: true  },
  { id: "ftd_date",        label: "FTD Date",      visible: false },
  { id: "ftd_id",          label: "FTD ID",        visible: false },
  { id: "injection_ftd",   label: "Injection FTD", visible: false },
  { id: "affiliate",       label: "Affiliate",     visible: true  },
  { id: "affiliate_id",    label: "Affiliate ID",  visible: false },
  { id: "offer_name",      label: "Offer Name",    visible: true  },
  { id: "autologin",       label: "AutoLogin",     visible: false },
  { id: "is_live",         label: "Live Lead",     visible: false },
  { id: "user_agent",      label: "User Agent",    visible: false },
  { id: "platform",        label: "Platform",      visible: false },
  { id: "browser",         label: "Browser",       visible: false },
  { id: "comment",         label: "Comment",       visible: false },
  { id: "created_at",      label: "Created",       visible: true  },
  { id: "rejection_reason",label: "Rejection Reason", visible: true },
];

const statusColors: Record<string, string> = {
  new:       "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  qualified: "bg-purple-100 text-purple-800",
  converted: "bg-green-100 text-green-800",
  lost:      "bg-red-100 text-red-800",
  rejected:  "bg-red-100 text-red-800",
};

function loadColumns(): ColumnConfig[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_COLUMNS;
    const savedMap: Record<string, boolean> = JSON.parse(saved);
    return DEFAULT_COLUMNS.map(col => ({
      ...col,
      visible: savedMap[col.id] ?? col.visible,
    }));
  } catch {
    return DEFAULT_COLUMNS;
  }
}

const PAGE_SIZE_OPTIONS = [5, 10, 15, 25, 50, 100];

export default function RejectedLeads() {
  const { data: rejectedLeads, isLoading, error } = useRejectedLeads();
  const deleteRejectedLeads = useDeleteRejectedLeads();
  const { formatDate, getStartOfMonth, getEndOfMonth, getNow, getStartOfDay, getEndOfDay, defaultPageSize } = useCRMSettings();
  const { canDeleteLeads } = useCurrentUserPermissions();

  const [showAllDates, setShowAllDates] = useState(false);
  const [fromDate, setFromDate] = useState<Date>(() => getStartOfMonth(getNow()));
  const [toDate, setToDate] = useState<Date>(() => getEndOfMonth(getNow()));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [columns, setColumns] = useState<ColumnConfig[]>(loadColumns);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const handleToggleColumn = (columnId: string) => {
    setColumns(prev => {
      const next = prev.map(col =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      );
      const visibilityMap: Record<string, boolean> = {};
      next.forEach(col => { visibilityMap[col.id] = col.visible; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibilityMap));
      return next;
    });
  };

  const visibleColumns = columns.filter(c => c.visible);

  const filteredLeads = useMemo(() => {
    return rejectedLeads?.filter((rejection) => {
      if (showAllDates) return true;
      const rejectedDate = new Date(rejection.created_at);
      const fromStart = getStartOfDay(fromDate);
      const toEnd = getEndOfDay(toDate);
      return rejectedDate >= fromStart && rejectedDate <= toEnd;
    }) || [];
  }, [rejectedLeads, showAllDates, fromDate, toDate]);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [showAllDates, fromDate, toDate]);

  const totalPages = Math.ceil(filteredLeads.length / pageSize);
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, currentPage, pageSize]);

  const allSelected = filteredLeads.length > 0 && filteredLeads.every(lead => selectedIds.has(lead.id));
  const someSelected = filteredLeads.some(lead => selectedIds.has(lead.id)) && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredLeads.map(lead => lead.id)));
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
    const itemsToDelete = filteredLeads
      .filter(lead => selectedIds.has(lead.id))
      .map(lead => ({
        id: lead.id,
        source: lead.source,
        lead_id: lead.lead_id,
      }));

    deleteRejectedLeads.mutate(itemsToDelete, {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  const renderCellValue = (rejection: any, columnId: string) => {
    const lead = rejection.leads as any;
    const advertiser = rejection.advertisers as any;

    switch (columnId) {
      case "request_id": {
        const rid = lead?.request_id || "-";
        return (
          <span className="font-mono text-xs bg-muted px-2 py-1 rounded" title={rid}>
            {rid !== "-" ? rid.substring(0, 8) : rid}
          </span>
        );
      }
      case "firstname":
        return lead?.firstname || "-";
      case "lastname":
        return lead?.lastname || "-";
      case "email":
        return (
          <div className="flex items-center gap-1">
            <span className="text-xs">{lead?.email || "-"}</span>
            {lead?.email && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(lead.email);
                  toast.success("Email copied");
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            )}
          </div>
        );
      case "mobile":
        return lead?.mobile || "-";
      case "country_code":
        return lead?.country_code
          ? <Badge variant="secondary">{lead.country_code}</Badge>
          : "-";
      case "country":
        return lead?.country || "-";
      case "city":
        return lead?.city || "-";
      case "ip_address":
        return lead?.ip_address || "-";
      case "status":
        return lead?.status
          ? (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[lead.status] || "bg-gray-100 text-gray-800"}`}>
              {lead.status}
            </span>
          )
          : "-";
      case "sale_status":
        return lead?.sale_status
          ? (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[lead.sale_status] || "bg-gray-100 text-gray-800"}`}>
              {lead.sale_status}
            </span>
          )
          : "-";
      case "advertiser":
        return <Badge variant="outline">{advertiser?.name || "Unknown"}</Badge>;
      case "advertiser_id":
        return lead?.advertiser_id
          ? <span className="font-mono text-xs">{lead.advertiser_id}</span>
          : "-";
      case "is_ftd":
        return lead?.is_ftd
          ? <Badge className="bg-green-100 text-green-800">Yes</Badge>
          : <Badge variant="secondary">No</Badge>;
      case "ftd_date":
        return lead?.ftd_date ? format(new Date(lead.ftd_date), "MMM d, yyyy") : "-";
      case "ftd_id":
        return lead?.ftd_id || "-";
      case "injection_ftd":
        return lead?.injection_ftd
          ? <Badge className="bg-green-100 text-green-800">Yes</Badge>
          : <Badge variant="secondary">No</Badge>;
      case "affiliate":
        return lead?.affiliates?.name || "-";
      case "affiliate_id":
        return lead?.affiliate_id
          ? <span className="font-mono text-xs">{lead.affiliate_id}</span>
          : "-";
      case "offer_name":
        return lead?.offer_name || "-";
      case "autologin":
        return lead?.autologin || "-";
      case "is_live":
        return lead?.is_live
          ? <Badge className="bg-blue-100 text-blue-800">Yes</Badge>
          : <Badge variant="secondary">No</Badge>;
      case "user_agent":
        return <span className="text-xs max-w-[200px] truncate block" title={lead?.user_agent}>{lead?.user_agent || "-"}</span>;
      case "platform":
        return lead?.platform || "-";
      case "browser":
        return lead?.browser || "-";
      case "comment":
        return lead?.comment || "-";
      case "created_at":
        return rejection.created_at ? formatDate(new Date(rejection.created_at)) : "-";
      case "rejection_reason":
        return (
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/50 hover:bg-destructive/10"
              >
                View Details
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Rejection Details</DialogTitle>
                <DialogDescription>
                  Full error response from {advertiser?.name}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[400px] border rounded-lg bg-muted/50">
                <pre className="p-4 text-xs whitespace-pre-wrap break-all">
                  {rejection.reason
                    ? (() => {
                        try {
                          return JSON.stringify(JSON.parse(rejection.reason), null, 2);
                        } catch {
                          return rejection.reason;
                        }
                      })()
                    : "No details available"}
                </pre>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        );
      default:
        return "-";
    }
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
          <div className="flex items-center gap-4 flex-wrap">
            {selectedIds.size > 0 && canDeleteLeads && (
              <AlertDialog>
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
            <LeadColumnSelector columns={columns} onToggle={handleToggleColumn} />
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{filteredLeads.length} rejected leads</span>
            </div>
          </div>
        </div>

        <Card className="p-4">
          <DateFilterBar
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
            onShowAllChange={setShowAllDates}
          />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Failed Distributions
            </CardTitle>
            <CardDescription>
              Leads rejected by advertisers with error details
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
                Failed to load rejected leads. Please try again.
              </p>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-12">
                <XCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No rejected leads found</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  All leads have been successfully distributed
                </p>
              </div>
            ) : (
              <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {canDeleteLeads && (
                        <TableHead className="w-12">
                          <Checkbox
                            checked={someSelected ? "indeterminate" : allSelected}
                            onCheckedChange={(checked) => handleSelectAll(!!checked)}
                          />
                        </TableHead>
                      )}
                      {visibleColumns.map(col => (
                        <TableHead key={col.id}>{col.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLeads.map((rejection) => (
                      <TableRow
                        key={rejection.id}
                        className={selectedIds.has(rejection.id) ? "bg-muted/50" : ""}
                      >
                        {canDeleteLeads && (
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(rejection.id)}
                              onCheckedChange={(checked) => handleSelectChange(rejection.id, !!checked)}
                            />
                          </TableCell>
                        )}
                        {visibleColumns.map(col => (
                          <TableCell key={col.id}>
                            {renderCellValue(rejection, col.id)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                totalItems={filteredLeads.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
              />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
