import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { FlaskConical, MoreHorizontal, Pencil, Trash2, Send, Copy, History } from "lucide-react";
import { ColumnConfig } from "./LeadColumnSelector";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { cn } from "@/lib/utils";
import { SortableHeader, SortConfig } from "./SortableHeader";
import { toast } from "sonner";
import { LeadActivityTimeline } from "./LeadActivityTimeline";

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

  const renderCellValue = (lead: any, columnId: string) => {
    switch (columnId) {
      case "request_id":
        const fullId = lead.request_id || lead.id;
        return (
          <span className="font-mono text-xs bg-muted px-2 py-1 rounded" title={fullId}>
            {fullId.slice(0, 8)}
          </span>
        );
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
      case "country":
        return lead.country || "-";
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
            {lead.affiliate_id.slice(0, 8)}
          </span>
        ) : <span className="text-muted-foreground">-</span>;
      case "advertiser_id":
        return lead.advertiser_id ? (
          <span className="font-mono text-xs bg-muted px-2 py-1 rounded" title={lead.advertiser_id}>
            {lead.advertiser_id.slice(0, 8)}
          </span>
        ) : <span className="text-muted-foreground">-</span>;
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
          green:      { label: "Green",     className: "bg-green-100 text-green-800" },
          orange:     { label: "Orange",    className: "bg-amber-100 text-amber-800" },
          "light-red":{ label: "Light Red", className: "bg-orange-100 text-orange-800" },
          red:        { label: "Red",       className: "bg-red-100 text-red-800" },
        };
        const s = (lead as any).live_lead_status;
        if (!s) return <span className="text-muted-foreground text-xs">—</span>;
        const cfg = statusMap[s] ?? { label: s, className: "bg-gray-100 text-gray-800" };
        return <Badge className={`${cfg.className} text-xs font-medium`}>{cfg.label}</Badge>;
      }
      case "live_lead_score": {
        const score = (lead as any).live_lead_score;
        if (score === null || score === undefined) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="text-xs font-medium tabular-nums">{score}<span className="text-muted-foreground font-normal">/100</span></span>;
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
        return lead.ftd_id || "-";
      case "autologin":
        return lead.autologin ? (
          <span className="max-w-32 truncate block font-mono text-xs" title={lead.autologin}>
            {lead.autologin}
          </span>
        ) : "-";
      case "is_live":
        return lead.is_live ? (
          <Badge className="bg-green-100 text-green-800">Live</Badge>
        ) : <span className="text-muted-foreground">-</span>;
      case "user_agent":
        return lead.user_agent ? (
          <span className="max-w-40 truncate block text-xs" title={lead.user_agent}>
            {lead.user_agent}
          </span>
        ) : "-";
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
            <TableHead className="w-12">
              <Checkbox 
                checked={someSelected ? "indeterminate" : allSelected}
                onCheckedChange={(checked) => onSelectAll(!!checked)}
              />
            </TableHead>
            {visibleColumns.map((col) => (
              <TableHead key={col.id}>
                <SortableHeader
                  label={col.label}
                  columnId={col.id}
                  sortConfig={sortConfig}
                  onSort={onSort}
                />
              </TableHead>
            ))}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id} className={selectedIds.has(lead.id) ? "bg-muted/50" : ""}>
              <TableCell>
                <Checkbox 
                  checked={selectedIds.has(lead.id)}
                  onCheckedChange={(checked) => onSelectChange(lead.id, !!checked)}
                />
              </TableCell>
              {visibleColumns.map((col) => (
                <TableCell key={col.id}>{renderCellValue(lead, col.id)}</TableCell>
              ))}
              <TableCell className="text-right">
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
                    const content = dist?.response ? (() => { try { return JSON.stringify(JSON.parse(dist.response), null, 2); } catch { return dist.response; } })() : "";
                    navigator.clipboard.writeText(content);
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
                    <pre className="p-4 text-xs whitespace-pre-wrap break-all">{dist.response ? (() => { try { return JSON.stringify(JSON.parse(dist.response), null, 2); } catch { return dist.response; } })() : "No response recorded"}</pre>
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
