import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DateFilterBar } from "@/components/filters/DateFilterBar";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TablePagination } from "@/components/ui/table-pagination";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuditLogs, useAuditLogActions, useAuditLogTables, useAuditLogsRealtime } from "@/hooks/useAuditLogs";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { usePageSizeState } from "@/hooks/usePageSizeState";
import { useCurrentUserPermissions } from "@/hooks/useUserPermissions";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { format } from "date-fns";
import { Search, FileText, User, Clock, Database, ArrowRight, Download, ShieldOff, MoreHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AuditLogs() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const { canViewAuditLogs, isLoading: permLoading } = useCurrentUserPermissions();
  const { getStartOfMonth, getEndOfMonth, getNow, getStartOfDay, getEndOfDay } = useCRMSettings();
  useAuditLogsRealtime();

  const [action, setAction] = useState<string>("");
  const [tableName, setTableName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [recordId, setRecordId] = useState<string>("");
  const [showAllDates, setShowAllDates] = useState(false);
  const [fromDate, setFromDate] = useState<Date>(() => getStartOfMonth(getNow()));
  const [toDate, setToDate] = useState<Date>(() => getEndOfMonth(getNow()));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSizeState();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailLogId, setDetailLogId] = useState<string | null>(null);

  const { data, isLoading } = useAuditLogs({
    action: action || undefined,
    tableName: tableName || undefined,
    userEmail: userEmail || undefined,
    recordId: recordId || undefined,
    dateFrom: showAllDates ? undefined : getStartOfDay(fromDate).toISOString(),
    dateTo: showAllDates ? undefined : getEndOfDay(toDate).toISOString(),
    page,
    pageSize,
  });

  const { data: actions } = useAuditLogActions();
  const { data: tables } = useAuditLogTables();

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

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

  const hasActiveFilter = !!(action || tableName || userEmail || recordId);

  const clearFilters = () => {
    setAction(""); setTableName(""); setUserEmail(""); setRecordId(""); setPage(1);
  };

  const exportCsv = () => {
    if (!logs.length) return;
    const headers = ["Timestamp", "User", "Action", "Table", "Record ID", "Summary", "IP Address"];
    const rows = logs.map((log) => [
      format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
      log.user_email || "System",
      log.action,
      log.table_name || "",
      log.record_id || "",
      log.changes_summary || "",
      log.ip_address || "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getActionColor = (action: string) => {
    if (action.includes("create") || action.includes("insert")) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
    if (action.includes("update") || action.includes("edit")) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    if (action.includes("delete") || action.includes("remove")) return "bg-destructive/20 text-destructive";
    if (action.includes("login") || action.includes("auth") || action.includes("impersonate")) return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    return "bg-muted text-muted-foreground";
  };

  const formatJson = (data: Record<string, unknown> | null) => {
    if (!data) return "N/A";
    return JSON.stringify(data, null, 2);
  };

  const getDiffFields = (oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null) => {
    if (!oldData || !newData) return [];
    const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    return [...keys].filter((k) => JSON.stringify(oldData[k]) !== JSON.stringify(newData[k]));
  };

  const uniqueUsers = new Set(logs.map(l => l.user_email || "system").filter(Boolean)).size;
  const detailLog = detailLogId ? logs.find(l => l.id === detailLogId) : null;

  const stillLoading = authLoading || permLoading;
  if (!stillLoading && !isSuperAdmin && !canViewAuditLogs) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
          <ShieldOff className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Access Restricted</h2>
          <p className="text-muted-foreground max-w-sm">You don't have permission to view audit logs. Contact your administrator.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Audit Logs</h1>
            <p className="text-muted-foreground">Track all user actions and system changes</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!logs.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Date Filter Bar with inline filters */}
        <Card className="p-4">
          <DateFilterBar
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={(d) => { setFromDate(d); setPage(1); }}
            onToDateChange={(d) => { setToDate(d); setPage(1); }}
            onShowAllChange={(v) => { setShowAllDates(v); setPage(1); }}
            currentPage={page}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={total}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            itemLabel="logs"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="User email..."
                value={userEmail}
                onChange={(e) => { setUserEmail(e.target.value); setPage(1); }}
                className="pl-8 h-8 w-44 text-sm"
              />
            </div>

            <Input
              placeholder="Record ID..."
              value={recordId}
              onChange={(e) => { setRecordId(e.target.value); setPage(1); }}
              className="h-8 w-36 text-sm"
            />

            <Select value={action} onValueChange={(v) => { setAction(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {actions?.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={tableName} onValueChange={(v) => { setTableName(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue placeholder="All Tables" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tables</SelectItem>
                {tables?.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>

            {hasActiveFilter && (
              <Button variant="ghost" size="sm" className="h-8" onClick={clearFilters}>Clear</Button>
            )}
          </DateFilterBar>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Logs</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{total}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Action Types</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{actions?.length || 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tables Tracked</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{tables?.length || 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Unique Users</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{uniqueUsers}</div></CardContent>
          </Card>
        </div>

        {/* Logs Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Activity Log</CardTitle>
            {total > 0 && (
              <span className="text-sm text-muted-foreground">{total.toLocaleString()} total entries</span>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
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
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No audit logs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((log) => (
                        <TableRow key={log.id} className={selectedIds.has(log.id) ? "bg-muted/50" : undefined}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(log.id)}
                              onCheckedChange={(c) => handleSelectOne(log.id, !!c)}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-sm truncate max-w-[150px]" title={log.user_email || undefined}>
                                {log.user_email || "System"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getActionColor(log.action)}>{log.action}</Badge>
                          </TableCell>
                          <TableCell>
                            {log.table_name ? (
                              <Badge variant="outline">{log.table_name}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={log.changes_summary || undefined}>
                            {log.changes_summary || "-"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.ip_address || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setDetailLogId(log.id)}>
                                  View Details
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
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
                itemLabel="logs"
              />
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailLogId} onOpenChange={() => setDetailLogId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Action:</span>
                  <Badge className={`ml-2 ${getActionColor(detailLog.action)}`}>{detailLog.action}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Table:</span>
                  <span className="ml-2">{detailLog.table_name || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">User:</span>
                  <span className="ml-2">{detailLog.user_email || "System"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Record ID:</span>
                  <span className="ml-2 font-mono text-xs">{detailLog.record_id || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">IP:</span>
                  <span className="ml-2">{detailLog.ip_address || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Time:</span>
                  <span className="ml-2">{format(new Date(detailLog.created_at), "PPpp")}</span>
                </div>
              </div>

              {detailLog.changes_summary && (
                <div>
                  <span className="text-sm text-muted-foreground">Summary:</span>
                  <p className="mt-1 text-sm">{detailLog.changes_summary}</p>
                </div>
              )}

              {detailLog.action === "update" && detailLog.old_data && detailLog.new_data ? (
                <div>
                  <span className="text-sm text-muted-foreground">Changed Fields:</span>
                  {(() => {
                    const changed = getDiffFields(detailLog.old_data, detailLog.new_data);
                    if (changed.length === 0)
                      return <p className="text-xs text-muted-foreground mt-1">No field changes detected.</p>;
                    return (
                      <div className="mt-2 border rounded overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-muted">
                            <tr>
                              <th className="text-left px-3 py-1.5 font-medium">Field</th>
                              <th className="text-left px-3 py-1.5 font-medium text-destructive">Before</th>
                              <th className="px-1 py-1.5 text-muted-foreground">
                                <ArrowRight className="h-3 w-3 mx-auto" />
                              </th>
                              <th className="text-left px-3 py-1.5 font-medium text-emerald-700 dark:text-emerald-400">After</th>
                            </tr>
                          </thead>
                          <tbody>
                            {changed.map((field) => (
                              <tr key={field} className="border-t">
                                <td className="px-3 py-1.5 font-mono font-medium">{field}</td>
                                <td className="px-3 py-1.5 font-mono text-destructive max-w-[120px] truncate" title={String(detailLog.old_data![field] ?? "")}>
                                  {detailLog.old_data![field] == null ? <span className="text-muted-foreground italic">null</span> : String(detailLog.old_data![field])}
                                </td>
                                <td className="px-1 py-1.5 text-center text-muted-foreground">→</td>
                                <td className="px-3 py-1.5 font-mono text-emerald-700 dark:text-emerald-400 max-w-[120px] truncate" title={String(detailLog.new_data![field] ?? "")}>
                                  {detailLog.new_data![field] == null ? <span className="text-muted-foreground italic">null</span> : String(detailLog.new_data![field])}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <>
                  {detailLog.old_data && (
                    <div>
                      <span className="text-sm text-muted-foreground">Previous Data:</span>
                      <ScrollArea className="h-32 mt-1">
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{formatJson(detailLog.old_data)}</pre>
                      </ScrollArea>
                    </div>
                  )}
                  {detailLog.new_data && (
                    <div>
                      <span className="text-sm text-muted-foreground">New Data:</span>
                      <ScrollArea className="h-32 mt-1">
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{formatJson(detailLog.new_data)}</pre>
                      </ScrollArea>
                    </div>
                  )}
                </>
              )}

              {detailLog.user_agent && (
                <div>
                  <span className="text-sm text-muted-foreground">User Agent:</span>
                  <p className="mt-1 text-xs text-muted-foreground truncate">{detailLog.user_agent}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
