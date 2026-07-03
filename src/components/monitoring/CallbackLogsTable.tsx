import { useState, useMemo } from "react";
import { useCallbackLogs, CallbackLog } from "@/hooks/useCallbackLogs";
import { DateFilterBar } from "@/components/filters/DateFilterBar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TablePagination } from "@/components/ui/table-pagination";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { usePageSizeState } from "@/hooks/usePageSizeState";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentUserPermissions } from "@/hooks/useUserPermissions";
import { format } from "date-fns";
import { Webhook, RefreshCw, Eye, CheckCircle2, XCircle, Clock, AlertTriangle, MoreHorizontal, Lock, Search } from "lucide-react";

export function CallbackLogsTable() {
  const { data: logs, isLoading, refetch } = useCallbackLogs(500);
  const { getStartOfMonth, getEndOfMonth, getNow, getStartOfDay, getEndOfDay } = useCRMSettings();
  const { isSuperAdmin } = useAuth();
  const { canViewCallbackLogs } = useCurrentUserPermissions();

  const [selectedLog, setSelectedLog] = useState<CallbackLog | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = usePageSizeState();
  const [showAllDates, setShowAllDates] = useState(false);
  const [fromDate, setFromDate] = useState<Date>(() => getStartOfMonth(getNow()));
  const [toDate, setToDate] = useState<Date>(() => getEndOfMonth(getNow()));
  const [search, setSearch] = useState("");

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (logs ?? []).filter((log) => {
      if (!showAllDates) {
        const d = new Date(log.created_at);
        if (d < getStartOfDay(fromDate) || d > getEndOfDay(toDate)) return false;
      }
      if (term) {
        const haystack = [log.advertiser_name, log.callback_type, log.processing_status, log.matched_by]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [logs, showAllDates, fromDate, toDate, search]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const allSelected = filteredLogs.length > 0 && filteredLogs.every(l => selectedIds.has(l.id));
  const someSelected = filteredLogs.some(l => selectedIds.has(l.id)) && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(filteredLogs.map(l => l.id)));
    else setSelectedIds(new Set());
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    checked ? next.add(id) : next.delete(id);
    setSelectedIds(next);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processed':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Processed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'no_match':
        return <Badge variant="outline"><AlertTriangle className="h-3 w-3 mr-1" />No Match</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'affiliate_autologin':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">Affiliate Autologin</Badge>;
      case 'ftd_update':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">FTD Update</Badge>;
      case 'status_update':
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30">Status Update</Badge>;
      case 'sale_status':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">Sale Status</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (!isSuperAdmin && !canViewCallbackLogs) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <Lock className="h-10 w-10" />
        <p className="text-lg font-medium">Access Denied</p>
        <p className="text-sm">You don't have permission to view Callback Logs.</p>
      </div>
    );
  }

  return (
    <>
      {/* Date Filter Bar */}
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
          totalItems={filteredLogs.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
          itemLabel="logs"
        />
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Callback Logs</CardTitle>
              <Badge variant="secondary">{filteredLogs.length}</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
          <CardDescription>
            Incoming webhook callbacks from advertisers (autologin URLs, status updates, FTD notifications)
          </CardDescription>
          <div className="relative mt-2 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search advertiser, type, status..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Webhook className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">No callback logs found</p>
              <p className="text-sm">Try adjusting the date range or check back later</p>
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
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Advertiser</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Matched By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLogs.map((log) => (
                    <TableRow key={log.id} className={selectedIds.has(log.id) ? "bg-muted/50" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(log.id)}
                          onCheckedChange={(c) => handleSelectOne(log.id, !!c)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                      </TableCell>
                      <TableCell>{getTypeBadge(log.callback_type)}</TableCell>
                      <TableCell>{log.advertiser_name || '-'}</TableCell>
                      <TableCell>{getStatusBadge(log.processing_status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.matched_by || '-'}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedLog(log)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
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
        {filteredLogs.length > 0 && (
          <CardFooter className="pt-0">
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filteredLogs.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
              itemLabel="logs"
            />
          </CardFooter>
        )}
      </Card>

      {/* Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Callback Details
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Callback Type</p>
                  <p>{getTypeBadge(selectedLog.callback_type)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Processing Status</p>
                  <p>{getStatusBadge(selectedLog.processing_status)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Received At</p>
                  <p className="font-mono text-sm">{format(new Date(selectedLog.created_at), 'yyyy-MM-dd HH:mm:ss')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Processed At</p>
                  <p className="font-mono text-sm">
                    {selectedLog.processed_at ? format(new Date(selectedLog.processed_at), 'yyyy-MM-dd HH:mm:ss') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Advertiser</p>
                  <p>{selectedLog.advertiser_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Matched By</p>
                  <p>{selectedLog.matched_by || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Lead ID</p>
                  <p className="font-mono text-xs">{selectedLog.lead_id || selectedLog.injection_lead_id || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">IP Address</p>
                  <p className="font-mono text-sm">{selectedLog.ip_address || '-'}</p>
                </div>
              </div>

              {selectedLog.processing_error && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Error</p>
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <p className="text-sm text-red-500">{selectedLog.processing_error}</p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Request URL</p>
                <p className="font-mono text-xs bg-muted p-2 rounded break-all">
                  {selectedLog.request_method} {selectedLog.request_url || '-'}
                </p>
              </div>

              {selectedLog.request_payload && Object.keys(selectedLog.request_payload).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Request Payload</p>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.request_payload, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.changes_applied && Object.keys(selectedLog.changes_applied).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Changes Applied</p>
                  <pre className="bg-green-500/10 border border-green-500/30 p-3 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.changes_applied, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.request_headers && Object.keys(selectedLog.request_headers).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Request Headers</p>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.request_headers, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
