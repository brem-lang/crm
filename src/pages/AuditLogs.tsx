import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuditLogs, useAuditLogActions, useAuditLogTables } from "@/hooks/useAuditLogs";
import { useCurrentUserPermissions } from "@/hooks/useUserPermissions";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { format, startOfDay, subDays } from "date-fns";
import { ChevronLeft, ChevronRight, Search, FileText, User, Clock, Database, ArrowRight, Download, ShieldOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AuditLogs() {
  const { isSuperAdmin } = useAuth();
  const { canViewAuditLogs } = useCurrentUserPermissions();

  const [action, setAction] = useState<string>("");
  const [tableName, setTableName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [recordId, setRecordId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAuditLogs({
    action: action || undefined,
    tableName: tableName || undefined,
    userEmail: userEmail || undefined,
    recordId: recordId || undefined,
    dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
    dateTo: dateTo ? new Date(dateTo + "T23:59:59").toISOString() : undefined,
    page,
    pageSize: 50,
  });

  const { data: actions } = useAuditLogActions();
  const { data: tables } = useAuditLogTables();

  const hasActiveFilter = !!(action || tableName || userEmail || recordId || dateFrom || dateTo);

  const clearFilters = () => {
    setAction("");
    setTableName("");
    setUserEmail("");
    setRecordId("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const setQuickFilter = (days: number) => {
    const now = new Date();
    const from = startOfDay(subDays(now, days - 1));
    setDateFrom(format(from, "yyyy-MM-dd"));
    setDateTo(format(now, "yyyy-MM-dd"));
    setPage(1);
  };

  const exportCsv = () => {
    if (!data?.logs.length) return;
    const headers = ["Timestamp", "User", "Action", "Table", "Record ID", "Summary", "IP Address"];
    const rows = data.logs.map((log) => [
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

  const getDiffFields = (
    oldData: Record<string, unknown> | null,
    newData: Record<string, unknown> | null
  ) => {
    if (!oldData || !newData) return [];
    const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    return [...keys].filter((k) => JSON.stringify(oldData[k]) !== JSON.stringify(newData[k]));
  };

  const uniqueUsers = data
    ? new Set(data.logs.map((l) => l.user_email || "system").filter(Boolean)).size
    : 0;

  if (!isSuperAdmin && !canViewAuditLogs) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
          <ShieldOff className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Access Restricted</h2>
          <p className="text-muted-foreground max-w-sm">
            You don't have permission to view audit logs. Contact your administrator.
          </p>
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
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data?.logs.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex flex-wrap gap-3">
              {/* User email */}
              <div className="flex-1 min-w-[180px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by user email..."
                    value={userEmail}
                    onChange={(e) => { setUserEmail(e.target.value); setPage(1); }}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Record ID */}
              <div className="flex-1 min-w-[160px]">
                <Input
                  placeholder="Record ID..."
                  value={recordId}
                  onChange={(e) => { setRecordId(e.target.value); setPage(1); }}
                />
              </div>

              {/* Action */}
              <Select
                value={action}
                onValueChange={(v) => { setAction(v === "all" ? "" : v); setPage(1); }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {actions?.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Table */}
              <Select
                value={tableName}
                onValueChange={(v) => { setTableName(v === "all" ? "" : v); setPage(1); }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Tables" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tables</SelectItem>
                  {tables?.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="w-[145px]"
                  title="From date"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="w-[145px]"
                  title="To date"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => setQuickFilter(1)}>Today</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickFilter(7)}>Last 7 Days</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickFilter(30)}>Last 30 Days</Button>
              {hasActiveFilter && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Logs</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Action Types</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{actions?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tables Tracked</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tables?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Unique Users</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniqueUsers}</div>
            </CardContent>
          </Card>
        </div>

        {/* Logs Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Activity Log</CardTitle>
            {data && data.total > 0 && (
              <span className="text-sm text-muted-foreground">
                {data.total.toLocaleString()} total entries
              </span>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Table</TableHead>
                        <TableHead>Summary</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.logs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No audit logs found
                          </TableCell>
                        </TableRow>
                      ) : (
                        data?.logs.map((log) => (
                          <TableRow key={log.id}>
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
                              <Badge className={getActionColor(log.action)}>
                                {log.action}
                              </Badge>
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
                            <TableCell>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm">View Details</Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Audit Log Details</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <span className="text-muted-foreground">Action:</span>
                                        <Badge className={`ml-2 ${getActionColor(log.action)}`}>{log.action}</Badge>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Table:</span>
                                        <span className="ml-2">{log.table_name || "N/A"}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">User:</span>
                                        <span className="ml-2">{log.user_email || "System"}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Record ID:</span>
                                        <span className="ml-2 font-mono text-xs">{log.record_id || "N/A"}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">IP:</span>
                                        <span className="ml-2">{log.ip_address || "N/A"}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Time:</span>
                                        <span className="ml-2">{format(new Date(log.created_at), "PPpp")}</span>
                                      </div>
                                    </div>

                                    {log.changes_summary && (
                                      <div>
                                        <span className="text-sm text-muted-foreground">Summary:</span>
                                        <p className="mt-1 text-sm">{log.changes_summary}</p>
                                      </div>
                                    )}

                                    {log.action === "update" && log.old_data && log.new_data ? (
                                      <div>
                                        <span className="text-sm text-muted-foreground">Changed Fields:</span>
                                        {(() => {
                                          const changed = getDiffFields(log.old_data, log.new_data);
                                          if (changed.length === 0)
                                            return (
                                              <p className="text-xs text-muted-foreground mt-1">No field changes detected.</p>
                                            );
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
                                                      <td
                                                        className="px-3 py-1.5 font-mono text-destructive max-w-[120px] truncate"
                                                        title={String(log.old_data![field] ?? "")}
                                                      >
                                                        {log.old_data![field] === null || log.old_data![field] === undefined ? (
                                                          <span className="text-muted-foreground italic">null</span>
                                                        ) : (
                                                          String(log.old_data![field])
                                                        )}
                                                      </td>
                                                      <td className="px-1 py-1.5 text-center text-muted-foreground">→</td>
                                                      <td
                                                        className="px-3 py-1.5 font-mono text-emerald-700 dark:text-emerald-400 max-w-[120px] truncate"
                                                        title={String(log.new_data![field] ?? "")}
                                                      >
                                                        {log.new_data![field] === null || log.new_data![field] === undefined ? (
                                                          <span className="text-muted-foreground italic">null</span>
                                                        ) : (
                                                          String(log.new_data![field])
                                                        )}
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
                                        {log.old_data && (
                                          <div>
                                            <span className="text-sm text-muted-foreground">Previous Data:</span>
                                            <ScrollArea className="h-32 mt-1">
                                              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                                {formatJson(log.old_data)}
                                              </pre>
                                            </ScrollArea>
                                          </div>
                                        )}
                                        {log.new_data && (
                                          <div>
                                            <span className="text-sm text-muted-foreground">New Data:</span>
                                            <ScrollArea className="h-32 mt-1">
                                              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                                {formatJson(log.new_data)}
                                              </pre>
                                            </ScrollArea>
                                          </div>
                                        )}
                                      </>
                                    )}

                                    {log.user_agent && (
                                      <div>
                                        <span className="text-sm text-muted-foreground">User Agent:</span>
                                        <p className="mt-1 text-xs text-muted-foreground truncate">{log.user_agent}</p>
                                      </div>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {data && data.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, data.total)} of {data.total.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {page} / {data.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                        disabled={page >= data.totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
