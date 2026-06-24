import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useAffiliateApiLogs } from "@/hooks/useAffiliateApiLogs";
import { useAffiliates } from "@/hooks/useAffiliates";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { useCurrentUserPermissions } from "@/hooks/useUserPermissions";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Shield, Lock } from "lucide-react";

export default function AffiliateApiLogs() {
  const { isSuperAdmin } = useAuth();
  const { canViewAffiliateApiLogs } = useCurrentUserPermissions();

  const [page, setPage] = useState(1);
  const [affiliateId, setAffiliateId] = useState("");
  const [status, setStatus] = useState<'accepted' | 'rejected' | ''>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [ipSearch, setIpSearch] = useState("");
  const [ipInput, setIpInput] = useState("");

  const { timezone } = useCRMSettings();
  const { data: affiliates } = useAffiliates();
  const { data, isLoading } = useAffiliateApiLogs({ page, affiliateId, status, dateFrom, dateTo, ipSearch });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 25;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const applyIpSearch = () => {
    setIpSearch(ipInput);
    setPage(1);
  };

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

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3">
              <Select value={affiliateId || "all"} onValueChange={(v) => { setAffiliateId(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-48">
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
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="date"
                className="w-40"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                placeholder="From"
              />
              <Input
                type="date"
                className="w-40"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                placeholder="To"
              />

              <div className="flex gap-2">
                <Input
                  placeholder="Search IP..."
                  className="w-40"
                  value={ipInput}
                  onChange={(e) => setIpInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyIpSearch()}
                />
                <Button variant="outline" size="sm" onClick={applyIpSearch}>Search</Button>
                {(affiliateId || status || dateFrom || dateTo || ipSearch) && (
                  <Button variant="ghost" size="sm" onClick={() => {
                    setAffiliateId(""); setStatus(""); setDateFrom(""); setDateTo("");
                    setIpSearch(""); setIpInput(""); setPage(1);
                  }}>Clear</Button>
                )}
              </div>
            </div>
          </CardContent>
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
                      <TableRow key={log.id}>
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
