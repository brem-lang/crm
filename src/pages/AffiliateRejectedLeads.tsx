import { DateFilterBar } from "@/components/filters/DateFilterBar";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  useAffiliateSubmissionFailures,
  useDeleteAffiliateSubmissionFailures,
  type AffiliateSubmissionFailure,
} from "@/hooks/useAffiliateSubmissionFailures";
import { useAffiliates } from "@/hooks/useAffiliates";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { usePageSizeState } from "@/hooks/usePageSizeState";
import { format } from "date-fns";
import { MoreHorizontal, Trash2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

const HIDDEN_KEYS = [
  "addonData", "ai", "ci", "gi", "api_key", "apiKey",
  "password", "username", "box", "advertiser_id", "advertiser_name",
];

const sanitizePayload = (obj: unknown): unknown => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizePayload);
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (HIDDEN_KEYS.includes(key)) continue;
    if (/key|secret|token|password/i.test(key)) continue;
    sanitized[key] = typeof value === "object" ? sanitizePayload(value) : value;
  }
  return sanitized;
};

const safeStringify = (obj: unknown): string => {
  try {
    return JSON.stringify(sanitizePayload(obj), null, 2);
  } catch {
    return "Unable to display payload";
  }
};

export default function AffiliateRejectedLeads() {
  const { getStartOfMonth, getEndOfMonth, getNow, getStartOfDay, getEndOfDay } =
    useCRMSettings();

  const [showAllDates, setShowAllDates] = useState(false);
  const [fromDate, setFromDate] = useState<Date>(() => getStartOfMonth(getNow()));
  const [toDate, setToDate] = useState<Date>(() => getEndOfMonth(getNow()));
  const [search, setSearch] = useState("");
  const [affiliateFilter, setAffiliateFilter] = useState("all");
  const [rejectionCodeFilter, setRejectionCodeFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = usePageSizeState();
  const [detailFailure, setDetailFailure] = useState<AffiliateSubmissionFailure | null>(null);

  const filters = {
    affiliateId: affiliateFilter !== "all" ? affiliateFilter : undefined,
    rejectionCode: rejectionCodeFilter !== "all" ? rejectionCodeFilter : undefined,
    search: search || undefined,
  };

  const { data: failures = [], isLoading } = useAffiliateSubmissionFailures(filters);
  const { data: affiliates = [] } = useAffiliates();
  const deleteMutation = useDeleteAffiliateSubmissionFailures();

  const rejectionCodes = useMemo(
    () => [...new Set(failures.map((f) => f.rejection_code))].filter(Boolean),
    [failures]
  );

  const filteredFailures = useMemo(() => {
    if (showAllDates) return failures;
    return failures.filter((f) => {
      const d = new Date(f.created_at);
      return d >= getStartOfDay(fromDate) && d <= getEndOfDay(toDate);
    });
  }, [failures, showAllDates, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filteredFailures.length / pageSize));
  const paginatedFailures = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredFailures.slice(start, start + pageSize);
  }, [filteredFailures, currentPage, pageSize]);

  const allSelected =
    paginatedFailures.length > 0 &&
    paginatedFailures.every((f) => selectedIds.has(f.id));
  const someSelected =
    paginatedFailures.some((f) => selectedIds.has(f.id)) && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(paginatedFailures.map((f) => f.id)));
    else setSelectedIds(new Set());
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    checked ? next.add(id) : next.delete(id);
    setSelectedIds(next);
  };

  const handleBulkDelete = () => {
    deleteMutation.mutate(Array.from(selectedIds), {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  const getAffiliateName = (affiliateId: string | null) => {
    if (!affiliateId) return "Unknown";
    return affiliates.find((a) => a.id === affiliateId)?.name ?? affiliateId.slice(0, 8);
  };

  const hasActiveFilters = affiliateFilter !== "all" || rejectionCodeFilter !== "all" || !!search;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <XCircle className="h-7 w-7 text-destructive" />
              Affiliate Rejected Leads
            </h1>
            <p className="text-muted-foreground">
              Leads rejected during affiliate submission
            </p>
          </div>
          {selectedIds.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete ({selectedIds.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Records</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {selectedIds.size} record
                    {selectedIds.size > 1 ? "s" : ""}? This action cannot be undone.
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
        </div>

        <Card className="p-4">
          <DateFilterBar
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={(d) => { setFromDate(d); setCurrentPage(1); }}
            onToDateChange={(d) => { setToDate(d); setCurrentPage(1); }}
            onShowAllChange={(v) => { setShowAllDates(v); setCurrentPage(1); }}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredFailures.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
            itemLabel="records"
          >
            <Select
              value={affiliateFilter}
              onValueChange={(v) => { setAffiliateFilter(v); setCurrentPage(1); }}
            >
              <SelectTrigger className="w-44 h-8 text-sm">
                <SelectValue placeholder="All Affiliates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Affiliates</SelectItem>
                {affiliates.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={rejectionCodeFilter}
              onValueChange={(v) => { setRejectionCodeFilter(v); setCurrentPage(1); }}
            >
              <SelectTrigger className="w-44 h-8 text-sm">
                <SelectValue placeholder="All Rejection Codes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rejection Codes</SelectItem>
                {rejectionCodes.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Search email, name, phone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-52 h-8 text-sm"
            />

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => {
                  setAffiliateFilter("all");
                  setRejectionCodeFilter("all");
                  setSearch("");
                  setCurrentPage(1);
                }}
              >
                Clear
              </Button>
            )}
          </DateFilterBar>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isLoading
                ? "Loading..."
                : `${filteredFailures.length.toLocaleString()} rejection${filteredFailures.length !== 1 ? "s" : ""}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : filteredFailures.length === 0 ? (
              <div className="text-center py-12">
                <XCircle className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">
                  No rejected submissions found
                </p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Try adjusting the date range or filters
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={someSelected ? "indeterminate" : allSelected}
                          onCheckedChange={(c) => handleSelectAll(!!c)}
                        />
                      </TableHead>
                      <TableHead>Date / Time</TableHead>
                      <TableHead>Affiliate</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Rejection Code</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedFailures.map((failure) => (
                      <TableRow
                        key={failure.id}
                        className={selectedIds.has(failure.id) ? "bg-muted/50" : undefined}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(failure.id)}
                            onCheckedChange={(c) => handleSelectOne(failure.id, !!c)}
                          />
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {format(new Date(failure.created_at), "MMM d, yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell className="text-sm">
                          {getAffiliateName(failure.affiliate_id)}
                        </TableCell>
                        <TableCell className="text-sm max-w-[180px] truncate">
                          {failure.email || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {[failure.firstname, failure.lastname].filter(Boolean).join(" ") || "—"}
                        </TableCell>
                        <TableCell className="text-sm">{failure.mobile || "—"}</TableCell>
                        <TableCell>
                          {failure.country_code ? (
                            <Badge variant="secondary">{failure.country_code}</Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive">{failure.rejection_code}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {failure.rejection_message || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setDetailFailure(failure)}>
                                View Details
                              </DropdownMenuItem>
                              {failure.raw_payload && (
                                <DropdownMenuItem onClick={() => setDetailFailure(failure)}>
                                  View Payload
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteMutation.mutate([failure.id])}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          {filteredFailures.length > 0 && (
            <CardFooter className="pt-0">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredFailures.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                itemLabel="records"
              />
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Details Dialog */}
      <Dialog open={!!detailFailure} onOpenChange={() => setDetailFailure(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rejection Details</DialogTitle>
            <DialogDescription>
              Submission failure from {getAffiliateName(detailFailure?.affiliate_id ?? null)}
            </DialogDescription>
          </DialogHeader>
          {detailFailure && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span>{format(new Date(detailFailure.created_at), "MMM d, yyyy HH:mm:ss")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{detailFailure.email || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rejection Code</span>
                  <Badge variant="destructive">{detailFailure.rejection_code}</Badge>
                </div>
                {detailFailure.rejection_message && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">Message</span>
                    <span className="text-right text-xs">{detailFailure.rejection_message}</span>
                  </div>
                )}
              </div>
              {detailFailure.raw_payload && (
                <>
                  <p className="text-xs text-muted-foreground font-medium">Raw Payload</p>
                  <ScrollArea className="max-h-[300px] border rounded-lg bg-muted/50">
                    <pre className="p-4 text-xs whitespace-pre-wrap break-all">
                      {safeStringify(detailFailure.raw_payload)}
                    </pre>
                  </ScrollArea>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
