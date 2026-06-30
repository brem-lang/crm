import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DateFilterBar } from "@/components/filters/DateFilterBar";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/ui/table-pagination";
import { useAffiliateApiLogs } from "@/hooks/useAffiliateApiLogs";
import { useAffiliates } from "@/hooks/useAffiliates";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { useCurrentUserPermissions } from "@/hooks/useUserPermissions";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { format } from "date-fns";
import { Shield, Lock } from "lucide-react";

export default function AffiliateApiLogs() {
  const { isSuperAdmin } = useAuth();
  const { canViewAffiliateApiLogs } = useCurrentUserPermissions();
  const { getStartOfMonth, getEndOfMonth, getNow } = useCRMSettings();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [affiliateId, setAffiliateId] = useState("");
  const [status, setStatus] = useState<'accepted' | 'rejected' | ''>("");
  const [showAllDates, setShowAllDates] = useState(false);
  const [fromDate, setFromDate] = useState<Date>(() => getStartOfMonth(getNow()));
  const [toDate, setToDate] = useState<Date>(() => getEndOfMonth(getNow()));
  const [ipSearch, setIpSearch] = useState("");
  const [ipInput, setIpInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: affiliates } = useAffiliates();
  const { data, isLoading } = useAffiliateApiLogs({
    page,
    affiliateId,
    status,
    dateFrom: showAllDates ? "" : format(fromDate, 'yyyy-MM-dd'),
    dateTo: showAllDates ? "" : format(toDate, 'yyyy-MM-dd'),
    ipSearch,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const allSelected = logs.length > 0 && logs.every(l => selectedIds.has(l.id));
  const someSelected = logs.some(l => selectedIds.has(l.id)) && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(logs.map(l => l.id)));
    else setSelectedIds(new Set());
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    checked ? next.add(id) : next.delete(id);
    setSelectedIds(next);
  };

  const applyIpSearch = () => { setIpSearch(ipInput); setPage(1); };

  const hasActiveFilters = !!(affiliateId || status || ipSearch);

  if (!isSuperAdmin && !canViewAffiliateApiLogs) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
          <Lock className="h-10 w-10" />
          <p className="text-lg font-medium">Access Denied</p>
          <p className="text-sm">You don't have permission to view Affiliate API Logs.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-7 w-7" />
            Affiliate API Logs
          </h1>
          <p className="text-muted-foreground">All inbound lead API requests — accepted and rejected</p>
        </div>

        {/* Date Filter Bar with inline filters as children */}
        <Card className="p-4">
          <DateFilterBar
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={(d) => { setFromDate(d); setPage(1); }}
            onToDateChange={(d) => { setToDate(d); setPage(1); }}
            onShowAllChange={(v) => { setShowAllDates(v); setPage(1); }}
          >
            <Select value={affiliateId || "all"} onValueChange={(v) => { setAffiliateId(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-44 h-8 text-sm">
                <SelectValue placeholder="All Affiliates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Affiliates</SelectItem>
                {affiliates?.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? "" : v as 'accepted' | 'rejected'); setPage(1); }}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Input
                placeholder="Search IP..."
                className="w-36 h-8 text-sm"
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyIpSearch()}
              />
              <Button variant="outline" size="sm" className="h-8" onClick={applyIpSearch}>Search</Button>
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-8" onClick={() => {
                setAffiliateId(""); setStatus("");
                setIpSearch(""); setIpInput(""); setPage(1);
              }}>Clear</Button>
            )}
          </DateFilterBar>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isLoading ? "Loading..." : `${total.toLocaleString()} request${total !== 1 ? "s" : ""}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : logs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No API log entries found.</p>
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
                      <TableHead>Request IP</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>API Key</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map(log => (
                      <TableRow key={log.id} className={selectedIds.has(log.id) ? "bg-muted/50" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(log.id)}
                            onCheckedChange={(c) => handleSelectOne(log.id, !!c)}
                          />
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {format(new Date(log.created_at), "MMM d, yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.affiliates?.name ?? <span className="text-muted-foreground italic">Unknown</span>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{log.request_ip ?? "—"}</TableCell>
                        <TableCell>
                          {log.status === 'accepted' ? (
                            <Badge className="bg-green-500 text-white">Accepted</Badge>
                          ) : (
                            <Badge variant="destructive">Rejected</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {log.reason ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.api_key_hint ? `****${log.api_key_hint}` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          {total > 0 && (
            <CardFooter className="pt-0">
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={total}
                onPageChange={setPage}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                itemLabel="requests"
              />
            </CardFooter>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
