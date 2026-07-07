import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { FlaskConical, MoreHorizontal, Pencil, Trash2, Send, Copy, History, Link, ExternalLink, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { ColumnConfig } from "./LeadColumnSelector";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { cn, shortId } from "@/lib/utils";
import { SortableHeader, SortConfig } from "./SortableHeader";
import { toast } from "sonner";
import { LeadActivityTimeline } from "./LeadActivityTimeline";
import { countryData } from "@/components/advertisers/countryData";
import { getScoreBreakdown, SCORE_THRESHOLDS, type ScoreFactor } from "@/lib/liveLeadScoring";

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  qualified: "bg-purple-100 text-purple-800",
  converted: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
};

interface LeadsTableProps {
  leads: any[];
  columns: ColumnConfig[];
  isSuperAdmin: boolean;
  onEdit: (lead: any) => void;
  onDelete: (id: string) => void;
  onReleaseFtd: (id: string) => void;
  onAddToTest: (id: string) => void;
  selectedIds: Set<string>;
  onSelectChange: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  canViewPhone?: boolean;
  canViewEmail?: boolean;
  canEditLeads?: boolean;
  canDeleteLeads?: boolean;
  sortConfig: SortConfig;
  onSort: (columnId: string) => void;
}

export function LeadsTable({
  leads,
  columns,
  isSuperAdmin,
  onEdit,
  onDelete,
  onReleaseFtd,
  onAddToTest,
  selectedIds,
  onSelectChange,
  onSelectAll,
  canViewPhone = false,
  canViewEmail = false,
  canEditLeads = false,
  canDeleteLeads = false,
  sortConfig,
  onSort,
}: LeadsTableProps) {
  const { formatDate, compactMode } = useCRMSettings();
  const [timelineLeadId, setTimelineLeadId] = useState<string | null>(null);
  const [requestDialogLeadId, setRequestDialogLeadId] = useState<string | null>(null);
  const [responseDialogLeadId, setResponseDialogLeadId] = useState<string | null>(null);
  const visibleColumns = columns.filter((col) => col.visible);
  const allSelected = leads.length > 0 && leads.every(lead => selectedIds.has(lead.id));
  const someSelected = leads.some(lead => selectedIds.has(lead.id)) && !allSelected;

  const maskValue = (value: string) => {
    if (!value) return "-";
    if (value.length <= 4) return "****";
    return value.slice(0, 2) + "****" + value.slice(-2);
  };

  const renderLiveLeadReasonPopover = (lead: any, trigger: React.ReactNode, headerLabel: string) => {
    const hasClickData = !!lead.click_ip || !!lead.click_ua || lead.time_to_click != null;
    const hasUnclickedAutologin = lead.lead_distributions?.some(
      (d: any) => d.status === "sent" && d.autologin_url
    ) && lead.time_to_click == null;

    return (
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent className="w-80 p-3" align="start">
          <p className="text-xs font-medium mb-2 text-muted-foreground">{headerLabel}</p>
          {!hasClickData ? (
            <p className="text-xs text-muted-foreground">
              {hasUnclickedAutologin
                ? "Autologin link was sent but has not been clicked yet — no click-side data to compare against the submission."
                : "No click-side data recorded yet for this lead."}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {getScoreBreakdown({
                submissionIp: lead.ip_address ?? null,
                clickIp: lead.click_ip ?? null,
                submissionCountry: lead.submission_country ?? null,
                clickCountry: lead.click_country ?? null,
                submissionAsn: lead.submission_asn ?? null,
                clickAsn: lead.click_asn ?? null,
                isProxy: !!lead.is_proxy,
                timeToClick: lead.time_to_click ?? null,
                submissionUa: lead.user_agent ?? null,
                clickUa: lead.click_ua ?? null,
              }).map((f: ScoreFactor) => (
                <li key={f.key} className="flex items-start gap-2">
                  {f.passed === true ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                  ) : f.passed === false ? (
                    <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                  ) : (
                    <MinusCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">{f.label}</span>
                      <span className="text-xs tabular-nums text-muted-foreground shrink-0">+{f.points}/{f.maxPoints}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{f.reason}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    );
  };

  const renderCellValue = (lead: any, columnId: string) => {
    switch (columnId) {
      case "request_id": {
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs font-mono font-normal max-w-[120px]">
                <span className="truncate">{shortId(lead.id)}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="start">
              <p className="text-xs font-medium mb-2 text-muted-foreground">Lead ID</p>
              <div className="flex items-start gap-2">
                <p className="text-xs font-mono flex-1" title={lead.id}>{shortId(lead.id, 8)}</p>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                  onClick={() => { navigator.clipboard.writeText(shortId(lead.id, 8)); toast.success("Lead ID copied"); }}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        );
      }
      case "api_request_id": {
        if (!lead.request_id) return "-";
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs font-mono font-normal max-w-[120px]">
                <span className="truncate">{shortId(lead.request_id)}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="start">
              <p className="text-xs font-medium mb-2 text-muted-foreground">API Request ID</p>
              <div className="flex items-start gap-2">
                <p className="text-xs font-mono flex-1" title={lead.request_id}>{shortId(lead.request_id, 12)}</p>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                  onClick={() => { navigator.clipboard.writeText(lead.request_id!); toast.success("Request ID copied"); }}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        );
      }
      case "firstname":
        return lead.firstname;
      case "lastname":
        return lead.lastname;
      case "email":
        const handleCopyEmail = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (canViewEmail && lead.email) {
            navigator.clipboard.writeText(lead.email);
            toast.success("Email copied to clipboard");
          }
        };
        return canViewEmail ? (
          <span className="flex items-center gap-1.5 group">
            <span>{lead.email}</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleCopyEmail}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </span>
        ) : maskValue(lead.email);
      case "mobile":
        return canViewPhone ? lead.mobile : maskValue(lead.mobile);
      case "country_code":
        return lead.country_code;
      case "country": {
        const name = lead.country || countryData[lead.country_code?.toUpperCase()]?.name;
        return name || "-";
      }
      case "city":
        return lead.city || "-";
      case "ip_address":
        return lead.ip_address || "-";
      case "status":
        // If lead is FTD (pending or released), display as converted
        const displayStatus = lead.is_ftd ? "converted" : lead.status;
        return (
          <Badge className={`${statusColors[displayStatus] || ""} pointer-events-none`}>
            {displayStatus}
          </Badge>
        );
      case "sale_status":
        return lead.sale_status ? (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
            {lead.sale_status}
          </Badge>
        ) : <span className="text-muted-foreground">-</span>;
      case "is_ftd":
        if (!lead.is_ftd) {
          return <span className="text-muted-foreground">-</span>;
        }
        return lead.ftd_released ? (
          <Badge className="bg-green-100 text-green-800">Released</Badge>
        ) : (
          <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
        );
      case "affiliate":
        return (lead as any).affiliates?.name || "-";
      case "affiliate_id":
        return lead.affiliate_id ? (
          <span className="font-mono text-xs bg-muted px-2 py-1 rounded" title={lead.affiliate_id}>
            {shortId(lead.affiliate_id)}
          </span>
        ) : <span className="text-muted-foreground">-</span>;
      case "advertiser_id": {
        // leads.advertiser_id is never populated (a lead can have multiple distribution
        // attempts) — derive the sent distribution's advertiser_id instead, same source
        // as the "advertiser" (name) column below.
        const dists = (lead as any).lead_distributions;
        const sentAdvertiserId = dists?.find((d: any) => d.status === 'sent')?.advertiser_id;
        return sentAdvertiserId ? (
          <span className="font-mono text-xs bg-muted px-2 py-1 rounded" title={sentAdvertiserId}>
            {shortId(sentAdvertiserId)}
          </span>
        ) : <span className="text-muted-foreground">-</span>;
      }
      case "advertiser":
        // Get the first successful distribution's advertiser name
        const distributions = (lead as any).lead_distributions;
        if (distributions && distributions.length > 0) {
          const sentDist = distributions.find((d: any) => d.status === 'sent');
          if (sentDist?.advertisers?.name) {
            return (
              <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                {sentDist.advertisers.name}
              </Badge>
            );
          }
          // Show pending if no sent distribution
          const pendingDist = distributions.find((d: any) => d.status === 'pending');
          if (pendingDist) {
            return <Badge variant="secondary">Pending</Badge>;
          }
        }
        return <span className="text-muted-foreground">-</span>;
      case "offer_name":
        return lead.offer_name || "-";
      case "custom1":
        return lead.custom1 || "-";
      case "custom2":
        return lead.custom2 || "-";
      case "custom3":
        return lead.custom3 || "-";
      case "custom4":
        return lead.custom4 || "-";
      case "custom5":
        return lead.custom5 || "-";
      case "live_lead_status": {
        const statusMap: Record<string, { label: string; className: string }> = {
          green:      { label: "Live",        className: "bg-green-100 text-green-800" },
          orange:     { label: "Likely Live", className: "bg-amber-100 text-amber-800" },
          "light-red":{ label: "Suspicious",  className: "bg-orange-100 text-orange-800" },
          red:        { label: "NO",          className: "bg-red-100 text-red-800" },
        };
        const s = (lead as any).live_lead_status;
        if (!s) {
          const hasUnclickedAutologin = (lead as any).lead_distributions?.some(
            (d: any) => d.status === 'sent' && d.autologin_url
          ) && lead.time_to_click == null;
          const trigger = hasUnclickedAutologin ? (
            <Badge className="bg-red-100 text-red-800 text-xs font-medium cursor-pointer hover:opacity-80">NO</Badge>
          ) : (
            <span className="text-muted-foreground text-xs cursor-pointer hover:opacity-80">—</span>
          );
          return renderLiveLeadReasonPopover(lead, trigger, hasUnclickedAutologin ? "NO" : "No data yet");
        }
        const cfg = statusMap[s] ?? { label: s, className: "bg-gray-100 text-gray-800" };
        const trigger = <Badge className={`${cfg.className} text-xs font-medium cursor-pointer hover:opacity-80`}>{cfg.label}</Badge>;
        return renderLiveLeadReasonPopover(lead, trigger, cfg.label);
      }
      case "live_lead_score": {
        const score = (lead as any).live_lead_score;
        if (score === null || score === undefined) return <span className="text-muted-foreground text-xs">—</span>;
        const scoreClass =
          score >= SCORE_THRESHOLDS.GREEN ? "bg-green-100 text-green-800" :
          score >= SCORE_THRESHOLDS.ORANGE ? "bg-amber-100 text-amber-800" :
          score >= SCORE_THRESHOLDS.LIGHT_RED ? "bg-orange-100 text-orange-800" :
                        "bg-red-100 text-red-800";
        const trigger = (
          <Badge className={`${scoreClass} text-xs font-medium tabular-nums cursor-pointer hover:opacity-80`}>
            {score}<span className="opacity-60 font-normal">/100</span>
          </Badge>
        );
        return renderLiveLeadReasonPopover(lead, trigger, `Score: ${score}/100`);
      }
      case "comment":
        return lead.comment ? (
          <span className="max-w-32 truncate block" title={lead.comment}>
            {lead.comment}
          </span>
        ) : "-";
      case "created_at":
        return formatDate(lead.created_at);
      case "ftd_date":
        return lead.ftd_date ? formatDate(lead.ftd_date) : "-";
      case "ftd_id":
        return lead.ftd_id ? (
          <span className="font-mono text-xs bg-muted px-2 py-1 rounded" title={lead.ftd_id}>
            {shortId(lead.ftd_id)}
          </span>
        ) : <span className="text-muted-foreground">-</span>;
      case "autologin": {
        if (!lead.autologin) return "-";
        const trackerUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-autologin?lead_id=${lead.id}`;
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs font-normal max-w-[120px]">
                <Link className="h-3 w-3 shrink-0" />
                <span className="truncate">AutoLogin</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="start">
              <p className="text-xs font-medium mb-2 text-muted-foreground">AutoLogin Tracker URL</p>
              <div className="flex items-start gap-2 mb-3">
                <p className="text-xs font-mono break-all flex-1">{trackerUrl}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => { navigator.clipboard.writeText(trackerUrl); toast.success("Tracker URL copied"); }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <a href={trackerUrl} target="_blank" rel="noopener noreferrer" className="block">
                <Button size="sm" className="w-full gap-2">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open AutoLogin
                </Button>
              </a>
              <p className="text-[10px] text-muted-foreground mt-2 break-all">
                Destination: {lead.autologin}
              </p>
            </PopoverContent>
          </Popover>
        );
      }
      case "user_agent": {
        if (!lead.user_agent) return "-";
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs font-normal max-w-[120px]">
                <span className="truncate">View UA</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="start">
              <p className="text-xs font-medium mb-2 text-muted-foreground">User Agent</p>
              <div className="flex items-start gap-2">
                <p className="text-xs break-all flex-1">{lead.user_agent}</p>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                  onClick={() => { navigator.clipboard.writeText(lead.user_agent!); toast.success("User agent copied"); }}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        );
      }
      case "submission_ua": {
        const sua = (lead as any).submission_ua as string | null;
        if (!sua) return "-";
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs font-normal max-w-[120px]">
                <span className="truncate">View UA</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="start">
              <p className="text-xs font-medium mb-2 text-muted-foreground">Submission User Agent</p>
              <div className="flex items-start gap-2">
                <p className="text-xs break-all flex-1">{sua}</p>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                  onClick={() => { navigator.clipboard.writeText(sua); toast.success("User agent copied"); }}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        );
      }
      case "locale":
        return (lead as any).locale || "-";
      case "click_id": {
        const cid = (lead as any).click_id as string | null;
        if (!cid) return "-";
        return (
          <div className="flex items-center gap-1 max-w-[140px]">
            <span className="text-xs font-mono truncate">{cid}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0"
              onClick={() => { navigator.clipboard.writeText(cid); toast.success("Click ID copied"); }}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        );
      }
      case "platform":
        return lead.platform || "-";
      case "browser":
        return lead.browser || "-";
      case "injection_ftd":
        return (lead as any).injection_ftd ? (
          <Badge className="bg-purple-100 text-purple-800">FTD</Badge>
        ) : <span className="text-muted-foreground">-</span>;
      default:
        return "-";
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table className={cn(compactMode && "[&_td]:py-1 [&_th]:py-1")}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 whitespace-nowrap">
              <Checkbox
                checked={someSelected ? "indeterminate" : allSelected}
                onCheckedChange={(checked) => onSelectAll(!!checked)}
              />
            </TableHead>
            {visibleColumns.map((col) => (
              <TableHead key={col.id} className="whitespace-nowrap">
                <SortableHeader
                  label={col.label}
                  columnId={col.id}
                  sortConfig={sortConfig}
                  onSort={onSort}
                />
              </TableHead>
            ))}
            <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id} className={selectedIds.has(lead.id) ? "bg-muted/50" : ""}>
              <TableCell className="whitespace-nowrap">
                <Checkbox
                  checked={selectedIds.has(lead.id)}
                  onCheckedChange={(checked) => onSelectChange(lead.id, !!checked)}
                />
              </TableCell>
              {visibleColumns.map((col) => (
                <TableCell key={col.id} className="whitespace-nowrap">{renderCellValue(lead, col.id)}</TableCell>
              ))}
              <TableCell className="text-right whitespace-nowrap">
                {(() => {
                  const dist = (lead as any).lead_distributions?.find((d: any) => d.status === 'sent') || (lead as any).lead_distributions?.[0];
                  const advertiserName = dist?.advertisers?.name || "Advertiser";
                  return (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setTimelineLeadId(lead.id)}>
                          <History className="h-4 w-4 mr-2" />
                          View Timeline
                        </DropdownMenuItem>
                        {canEditLeads && (
                          <DropdownMenuItem onClick={() => onEdit(lead)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setRequestDialogLeadId(lead.id)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Request
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setResponseDialogLeadId(lead.id)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Response
                        </DropdownMenuItem>
                        {lead.is_ftd && !lead.ftd_released && canEditLeads && (
                          <DropdownMenuItem onClick={() => onReleaseFtd(lead.id)} className="text-green-600">
                            <Send className="h-4 w-4 mr-2" />
                            Release FTD
                          </DropdownMenuItem>
                        )}
                        {canEditLeads && (
                          <DropdownMenuItem onClick={() => onAddToTest(lead.id)}>
                            <FlaskConical className="h-4 w-4 mr-2" />
                            Add to Test
                          </DropdownMenuItem>
                        )}
                        {canDeleteLeads && (
                          <DropdownMenuItem onClick={() => onDelete(lead.id)} className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Lead Activity Timeline Dialog */}
      <LeadActivityTimeline
        leadId={timelineLeadId}
        open={!!timelineLeadId}
        onOpenChange={(open) => !open && setTimelineLeadId(null)}
      />

      {/* Full Request Details Dialog */}
      {(() => {
        const lead = leads.find(l => l.id === requestDialogLeadId);
        const dist = lead?.lead_distributions?.find((d: any) => d.status === 'sent') || lead?.lead_distributions?.[0];
        const advertiserName = dist?.advertisers?.name || "Advertiser";
        return (
          <Dialog open={!!requestDialogLeadId} onOpenChange={(open) => !open && setRequestDialogLeadId(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Full Request Details</DialogTitle>
                <DialogDescription>Complete request sent to {advertiserName}</DialogDescription>
              </DialogHeader>
              <div className="relative">
                <Button
                  variant="ghost" size="icon"
                  className="absolute top-2 right-2 h-8 w-8 z-10"
                  onClick={() => {
                    const fullRequest = { url: dist?.request_url, headers: dist?.request_headers, payload: dist?.request_payload ? (() => { try { return JSON.parse(dist.request_payload); } catch { return dist.request_payload; } })() : null };
                    navigator.clipboard.writeText(JSON.stringify(fullRequest, null, 2));
                    toast.success("Full request copied to clipboard");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <ScrollArea className="max-h-[60vh] border rounded-lg bg-muted/50">
                  {!dist ? (
                    <div className="p-4 text-sm text-muted-foreground text-center py-8">
                      <p className="font-medium">No distribution record found</p>
                      <p className="text-xs mt-1">This lead has not been sent to an advertiser yet.</p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">Target URL</p>
                        <code className="text-xs bg-background p-2 rounded block break-all">{dist.request_url || "Not recorded"}</code>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">Headers</p>
                        <pre className="text-xs bg-background p-2 rounded whitespace-pre-wrap break-all">{dist.request_headers ? JSON.stringify(dist.request_headers, null, 2) : "Not recorded"}</pre>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">Request Payload</p>
                        <pre className="text-xs bg-background p-2 rounded whitespace-pre-wrap break-all">{dist.request_payload ? (() => { try { return JSON.stringify(JSON.parse(dist.request_payload), null, 2); } catch { return dist.request_payload; } })() : "Not recorded"}</pre>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Advertiser Response Dialog */}
      {(() => {
        const lead = leads.find(l => l.id === responseDialogLeadId);
        const dist = lead?.lead_distributions?.find((d: any) => d.status === 'sent') || lead?.lead_distributions?.[0];
        const advertiserName = dist?.advertisers?.name || "Advertiser";
        const trackerUrl = lead?.id
          ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-autologin?lead_id=${lead.id}`
          : null;

        const buildResponseContent = () => {
          const parsed = dist?.response ? (() => { try { return JSON.parse(dist.response); } catch { return null; } })() : null;
          if (parsed && trackerUrl) {
            const replaced = { ...parsed };
            const autologinFields = ['autologin_url', 'autologinUrl', 'autoLoginUrl', 'redirect_url', 'login_url', 'loginUrl'];
            for (const field of autologinFields) {
              if (field in replaced && typeof replaced[field] === 'string' && replaced[field].startsWith('http')) {
                replaced[field] = trackerUrl;
              }
            }
            return JSON.stringify(replaced, null, 2);
          }
          return parsed ? JSON.stringify(parsed, null, 2) : (dist?.response || "No response recorded");
        };

        return (
          <Dialog open={!!responseDialogLeadId} onOpenChange={(open) => !open && setResponseDialogLeadId(null)}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Advertiser Response</DialogTitle>
                <DialogDescription>Response from {advertiserName}</DialogDescription>
              </DialogHeader>
              <div className="relative">
                <Button
                  variant="ghost" size="icon"
                  className="absolute top-2 right-2 h-8 w-8 z-10"
                  onClick={() => {
                    navigator.clipboard.writeText(buildResponseContent());
                    toast.success("Response copied to clipboard");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <ScrollArea className="max-h-[400px] border rounded-lg bg-muted/50">
                  {!dist ? (
                    <div className="p-4 text-sm text-muted-foreground text-center py-8">
                      <p className="font-medium">No distribution record found</p>
                      <p className="text-xs mt-1">This lead has not been sent to an advertiser yet.</p>
                    </div>
                  ) : (
                    <pre className="p-4 text-xs whitespace-pre-wrap break-all">
                      {buildResponseContent()}
                    </pre>
                  )}
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
