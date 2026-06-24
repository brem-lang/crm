import { useState } from "react";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useChatSessionsList,
  useChatSessionStats,
  useChatSessionsRealtime,
} from "@/hooks/useChatSessionsAdmin";
import { format, formatDistanceStrict } from "date-fns";
import {
  MessageCircle,
  Users,
  CheckCircle2,
  Clock,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Headphones,
  Bot,
} from "lucide-react";

function statusBadge(status: string) {
  const map: Record<string, string> = {
    bot:     "bg-muted text-muted-foreground",
    waiting: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    active:  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    closed:  "bg-secondary text-secondary-foreground",
  };
  return (
    <Badge className={map[status] ?? "bg-muted text-muted-foreground"}>
      {status}
    </Badge>
  );
}

function duration(created: string, closed: string | null) {
  if (!closed) return "—";
  return formatDistanceStrict(new Date(closed), new Date(created));
}

export default function ChatSessions() {
  useChatSessionsRealtime();
  const { defaultPageSize } = useCRMSettings();

  const [statusFilter, setStatusFilter] = useState("all");
  const [visitorSearch, setVisitorSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useChatSessionsList({
    status: statusFilter,
    visitorSearch: visitorSearch || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize: defaultPageSize,
  });

  const { data: stats } = useChatSessionStats();

  function resetFilters() {
    setStatusFilter("all");
    setVisitorSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  const hasFilters = statusFilter !== "all" || visitorSearch || dateFrom || dateTo;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Chat Sessions</h1>
          <p className="text-muted-foreground">
            Monitor all support chat sessions, review transcripts, and track resolution rates
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Sessions</CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total ?? "—"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Waiting Now</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{stats?.waiting ?? "—"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Now</CardTitle>
              <Headphones className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">{stats?.active ?? "—"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Resolved Today</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.closedToday ?? "—"}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email…"
                    value={visitorSearch}
                    onChange={e => { setVisitorSearch(e.target.value); setPage(1); }}
                    className="pl-9"
                  />
                </div>
              </div>

              <Select
                value={statusFilter}
                onValueChange={v => { setStatusFilter(v); setPage(1); }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="bot">Bot</SelectItem>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                  className="w-[150px]"
                  title="From date"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setPage(1); }}
                  className="w-[150px]"
                  title="To date"
                />
              </div>

              {hasFilters && (
                <Button variant="outline" onClick={resetFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Visitor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.sessions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                            No chat sessions found
                          </TableCell>
                        </TableRow>
                      ) : (
                        data?.sessions.map(session => (
                          <TableRow key={session.id}>
                            {/* Visitor */}
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate max-w-[140px]">
                                    {session.visitor_name ?? "Anonymous"}
                                  </p>
                                  {session.visitor_email && (
                                    <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                                      {session.visitor_email}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>

                            {/* Status */}
                            <TableCell>{statusBadge(session.status)}</TableCell>

                            {/* Started */}
                            <TableCell className="whitespace-nowrap text-sm">
                              {format(new Date(session.created_at), "MMM d, HH:mm")}
                            </TableCell>

                            {/* Duration */}
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {duration(session.created_at, session.closed_at)}
                            </TableCell>

                            {/* Agent */}
                            <TableCell>
                              {session.agent_id ? (
                                <div className="flex items-center gap-1.5">
                                  <Headphones className="h-3.5 w-3.5 text-emerald-500" />
                                  <span className="text-xs text-muted-foreground">Assigned</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">Bot only</span>
                                </div>
                              )}
                            </TableCell>

                            {/* Actions */}
                            <TableCell>
                              <TranscriptDialog session={session} />
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
                      Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, data.total)} of {data.total}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
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

// ── Transcript Dialog ──────────────────────────────────────────────────────────
function TranscriptDialog({ session }: { session: import("@/hooks/useChatSessionsAdmin").ChatSessionRow }) {
  const hasTranscript = !!session.transcript_text;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          {hasTranscript ? "Transcript" : "Details"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Session Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Visitor</p>
              <p className="font-medium">{session.visitor_name ?? "Anonymous"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Email</p>
              <p>{session.visitor_email ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Status</p>
              {statusBadge(session.status)}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Started</p>
              <p>{format(new Date(session.created_at), "PPp")}</p>
            </div>
            {session.closed_at && (
              <>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Closed</p>
                  <p>{format(new Date(session.closed_at), "PPp")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Duration</p>
                  <p>{duration(session.created_at, session.closed_at)}</p>
                </div>
              </>
            )}
          </div>

          {/* Transcript */}
          {hasTranscript ? (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Transcript
              </p>
              <ScrollArea className="h-64 rounded-md border">
                <pre className="p-3 text-xs leading-relaxed whitespace-pre-wrap font-mono text-foreground">
                  {session.transcript_text}
                </pre>
              </ScrollArea>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {session.status === "closed"
                ? "No transcript was saved for this session."
                : "Transcript is generated when the session is closed."}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
