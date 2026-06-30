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
  CardDescription,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { useAuth } from "@/hooks/useAuth";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import {
  useDeleteTestLeadLogs,
  useTestLeadLogs,
} from "@/hooks/useTestLeadLogs";
import { format } from "date-fns";
import { CheckCircle2, Copy, MoreHorizontal, TestTube2, Trash2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function TestLeadLogs() {
  const { data: logs, isLoading, error } = useTestLeadLogs();
  const deleteTestLogs = useDeleteTestLeadLogs();
  const { getStartOfMonth, getEndOfMonth, getNow, getStartOfDay, getEndOfDay } = useCRMSettings();
  const { isSuperAdmin } = useAuth();

  const [showAllDates, setShowAllDates] = useState(false);
  const [fromDate, setFromDate] = useState<Date>(() => getStartOfMonth(getNow()));
  const [toDate, setToDate] = useState<Date>(() => getEndOfMonth(getNow()));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Dialog state
  const [requestLogId, setRequestLogId] = useState<string | null>(null);
  const [responseLogId, setResponseLogId] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    return (
      logs?.filter((log) => {
        if (showAllDates) return true;
        const logDate = new Date(log.created_at);
        return logDate >= getStartOfDay(fromDate) && logDate <= getEndOfDay(toDate);
      }) || []
    );
  }, [logs, showAllDates, fromDate, toDate]);

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

  const handleBulkDelete = () => {
    deleteTestLogs.mutate(Array.from(selectedIds), {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  const requestLog = requestLogId ? logs?.find(l => l.id === requestLogId) : null;
  const responseLog = responseLogId ? logs?.find(l => l.id === responseLogId) : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Test Lead History</h1>
            <p className="text-muted-foreground">View all test leads sent to advertisers</p>
          </div>
          <div className="flex items-center gap-4">
            {selectedIds.size > 0 && isSuperAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete ({selectedIds.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Test Logs</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {selectedIds.size} test log{selectedIds.size > 1 ? "s" : ""}? This action cannot be undone.
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
            <div className="flex items-center gap-2 text-muted-foreground">
              <TestTube2 className="h-4 w-4" />
              <span className="text-sm">{filteredLogs.length} test attempts</span>
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
              <TestTube2 className="h-5 w-5 text-primary" />
              Test Lead Logs
            </CardTitle>
            <CardDescription>History of test leads sent to advertisers for integration testing</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : error ? (
              <p className="text-center text-muted-foreground py-8">Failed to load test logs. Please try again.</p>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <TestTube2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No test leads sent yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Send a test lead from the Advertisers page</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isSuperAdmin && (
                        <TableHead className="w-12">
                          <Checkbox
                            checked={someSelected ? "indeterminate" : allSelected}
                            onCheckedChange={(c) => handleSelectAll(!!c)}
                          />
                        </TableHead>
                      )}
                      <TableHead>Status</TableHead>
                      <TableHead>Advertiser</TableHead>
                      <TableHead>First Name</TableHead>
                      <TableHead>Last Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Offer</TableHead>
                      <TableHead>Sent At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLogs.map((log) => {
                      const advertiser = log.advertisers as any;
                      const testData = log.test_data as any;
                      return (
                        <TableRow key={log.id} className={selectedIds.has(log.id) ? "bg-muted/50" : undefined}>
                          {isSuperAdmin && (
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(log.id)}
                                onCheckedChange={(c) => handleSelectOne(log.id, !!c)}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            {log.success ? (
                              <Badge variant="default" className="bg-green-600">
                                <CheckCircle2 className="h-3 w-3 mr-1" />Success
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" />Failed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{advertiser?.name || "Unknown"}</TableCell>
                          <TableCell>{testData?.firstname || "-"}</TableCell>
                          <TableCell>{testData?.lastname || "-"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{testData?.email || "-"}</span>
                              {testData?.email && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    navigator.clipboard.writeText(testData.email);
                                    toast.success("Email copied");
                                  }}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{testData?.mobile || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{testData?.country_code || "-"}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{testData?.ip_address || "-"}</TableCell>
                          <TableCell>{testData?.offer_name || "-"}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(log.created_at), "MMM d, HH:mm")}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setRequestLogId(log.id)}>
                                  View Request
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setResponseLogId(log.id)}>
                                  View Response
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
      </div>

      {/* Request Dialog */}
      <Dialog open={!!requestLogId} onOpenChange={() => setRequestLogId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Full Request Details</DialogTitle>
            <DialogDescription>
              Complete request sent to {(requestLog?.advertisers as any)?.name}
            </DialogDescription>
          </DialogHeader>
          {requestLog && (
            <div className="relative">
              <Button
                variant="ghost" size="icon"
                className="absolute top-2 right-2 h-8 w-8 z-10"
                onClick={() => {
                  const testData = requestLog.test_data as any;
                  const fullRequest = {
                    url: requestLog.request_url,
                    headers: requestLog.request_headers,
                    payload: requestLog.request_payload ? (() => { try { return JSON.parse(requestLog.request_payload as string); } catch { return requestLog.request_payload; } })() : null,
                    lead_data: testData,
                  };
                  navigator.clipboard.writeText(JSON.stringify(fullRequest, null, 2));
                  toast.success("Full request copied to clipboard");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <ScrollArea className="max-h-[60vh] border rounded-lg bg-muted/50">
                <div className="p-4 space-y-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Target URL</p>
                    <code className="text-xs bg-background p-2 rounded block break-all">{requestLog.request_url || "Not recorded"}</code>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Headers</p>
                    <pre className="text-xs bg-background p-2 rounded whitespace-pre-wrap break-all">
                      {requestLog.request_headers ? JSON.stringify(requestLog.request_headers, null, 2) : "Not recorded"}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Request Payload</p>
                    <pre className="text-xs bg-background p-2 rounded whitespace-pre-wrap break-all">
                      {requestLog.request_payload ? (() => { try { return JSON.stringify(JSON.parse(requestLog.request_payload as string), null, 2); } catch { return requestLog.request_payload; } })() : "Not recorded"}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Lead Data</p>
                    <pre className="text-xs bg-background p-2 rounded whitespace-pre-wrap break-all">
                      {JSON.stringify(requestLog.test_data, null, 2)}
                    </pre>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Response Dialog */}
      <Dialog open={!!responseLogId} onOpenChange={() => setResponseLogId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Advertiser Response</DialogTitle>
            <DialogDescription>Response from {(responseLog?.advertisers as any)?.name}</DialogDescription>
          </DialogHeader>
          {responseLog && (
            <div className="relative">
              <Button
                variant="ghost" size="icon"
                className="absolute top-2 right-2 h-8 w-8 z-10"
                onClick={() => {
                  const content = responseLog.response ? (() => { try { return JSON.stringify(JSON.parse(responseLog.response as string), null, 2); } catch { return responseLog.response; } })() : "";
                  navigator.clipboard.writeText(content as string);
                  toast.success("Response copied to clipboard");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <ScrollArea className="max-h-[400px] border rounded-lg bg-muted/50">
                <pre className="p-4 text-xs whitespace-pre-wrap break-all">
                  {responseLog.response ? (() => { try { return JSON.stringify(JSON.parse(responseLog.response as string), null, 2); } catch { return responseLog.response; } })() : "No response"}
                </pre>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
