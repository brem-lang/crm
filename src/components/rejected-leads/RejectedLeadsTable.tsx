import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreHorizontal, Trash2, Copy, AlertCircle } from "lucide-react";
import { ColumnConfig } from "@/components/leads/LeadColumnSelector";
import { SortableHeader, SortConfig } from "@/components/leads/SortableHeader";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { cn, shortId, parseRequestPayload } from "@/lib/utils";
import { countryData } from "@/components/advertisers/countryData";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  new:       "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  qualified: "bg-purple-100 text-purple-800",
  converted: "bg-green-100 text-green-800",
  lost:      "bg-red-100 text-red-800",
  rejected:  "bg-red-100 text-red-800",
};

interface RejectedLeadsTableProps {
  rejections: any[];
  columns: ColumnConfig[];
  selectedIds: Set<string>;
  onSelectChange: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onDelete: (rejection: any) => void;
  canDeleteLeads?: boolean;
  sortConfig: SortConfig;
  onSort: (columnId: string) => void;
}

export function RejectedLeadsTable({
  rejections,
  columns,
  selectedIds,
  onSelectChange,
  onSelectAll,
  onDelete,
  canDeleteLeads = false,
  sortConfig,
  onSort,
}: RejectedLeadsTableProps) {
  const { formatDate, compactMode } = useCRMSettings();
  const [requestDialogId, setRequestDialogId] = useState<string | null>(null);
  const [responseDialogId, setResponseDialogId] = useState<string | null>(null);
  const visibleColumns = columns.filter((col) => col.visible);
  const allSelected = rejections.length > 0 && rejections.every((r) => selectedIds.has(r.id));
  const someSelected = rejections.some((r) => selectedIds.has(r.id)) && !allSelected;

  const renderCellValue = (rejection: any, columnId: string) => {
    const lead = rejection.leads as any;
    const advertiser = rejection.advertisers as any;

    switch (columnId) {
      case "request_id": {
        const rid = lead?.request_id || "-";
        return (
          <span className="font-mono text-xs bg-muted px-2 py-1 rounded" title={rid}>
            {rid !== "-" ? shortId(rid) : rid}
          </span>
        );
      }
      case "firstname":
        return lead?.firstname || "-";
      case "lastname":
        return lead?.lastname || "-";
      case "email":
        return (
          <span className="flex items-center gap-1.5 group">
            <span>{lead?.email || "-"}</span>
            {lead?.email && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  navigator.clipboard.writeText(lead.email);
                  toast.success("Email copied");
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            )}
          </span>
        );
      case "mobile":
        return lead?.mobile || "-";
      case "country_code":
        return lead?.country_code ? <Badge variant="secondary">{lead.country_code}</Badge> : "-";
      case "country": {
        const name = lead?.country || countryData[lead?.country_code?.toUpperCase()]?.name;
        return name || "-";
      }
      case "city":
        return lead?.city || "-";
      case "ip_address":
        return lead?.ip_address || "-";
      case "status":
        return lead?.status ? (
          <Badge className={`${statusColors[lead.status] || "bg-gray-100 text-gray-800"} pointer-events-none`}>
            {lead.status}
          </Badge>
        ) : "-";
      case "sale_status":
        return lead?.sale_status ? (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
            {lead.sale_status}
          </Badge>
        ) : <span className="text-muted-foreground">-</span>;
      case "advertiser":
        return <Badge variant="outline">{advertiser?.name || "Unknown"}</Badge>;
      case "advertiser_id":
        return lead?.advertiser_id ? (
          <span className="font-mono text-xs bg-muted px-2 py-1 rounded" title={lead.advertiser_id}>
            {shortId(lead.advertiser_id)}
          </span>
        ) : <span className="text-muted-foreground">-</span>;
      case "is_ftd":
        return lead?.is_ftd
          ? <Badge className="bg-green-100 text-green-800">Yes</Badge>
          : <Badge variant="secondary">No</Badge>;
      case "ftd_date":
        return lead?.ftd_date ? formatDate(lead.ftd_date) : "-";
      case "ftd_id":
        return lead?.ftd_id ? (
          <span className="font-mono text-xs bg-muted px-2 py-1 rounded" title={lead.ftd_id}>
            {shortId(lead.ftd_id)}
          </span>
        ) : <span className="text-muted-foreground">-</span>;
      case "injection_ftd":
        return lead?.injection_ftd
          ? <Badge className="bg-purple-100 text-purple-800">FTD</Badge>
          : <span className="text-muted-foreground">-</span>;
      case "affiliate":
        return lead?.affiliates?.name || "-";
      case "affiliate_id":
        return lead?.affiliate_id ? (
          <span className="font-mono text-xs bg-muted px-2 py-1 rounded" title={lead.affiliate_id}>
            {shortId(lead.affiliate_id)}
          </span>
        ) : <span className="text-muted-foreground">-</span>;
      case "offer_name":
        return lead?.offer_name || "-";
      case "autologin":
        return lead?.autologin || "-";
      case "user_agent":
        return <span className="text-xs max-w-[200px] truncate block" title={lead?.user_agent}>{lead?.user_agent || "-"}</span>;
      case "platform":
        return lead?.platform || "-";
      case "browser":
        return lead?.browser || "-";
      case "comment":
        return lead?.comment ? (
          <span className="max-w-32 truncate block" title={lead.comment}>{lead.comment}</span>
        ) : "-";
      case "custom1":
        return lead?.custom1 || "-";
      case "custom2":
        return lead?.custom2 || "-";
      case "custom3":
        return lead?.custom3 || "-";
      case "custom4":
        return lead?.custom4 || "-";
      case "custom5":
        return lead?.custom5 || "-";
      case "live_lead_status": {
        const statusMap: Record<string, { label: string; className: string }> = {
          green:       { label: "Live",        className: "bg-green-100 text-green-800" },
          orange:      { label: "Likely Live", className: "bg-amber-100 text-amber-800" },
          "light-red": { label: "Suspicious",  className: "bg-orange-100 text-orange-800" },
          red:         { label: "NO",          className: "bg-red-100 text-red-800" },
        };
        const s = lead?.live_lead_status;
        if (!s) return <span className="text-muted-foreground text-xs">—</span>;
        const entry = statusMap[s];
        return entry
          ? <Badge className={`${entry.className} text-xs font-medium`}>{entry.label}</Badge>
          : <Badge variant="secondary">{s}</Badge>;
      }
      case "live_lead_score":
        return lead?.live_lead_score != null ? String(lead.live_lead_score) : "-";
      case "created_at":
        return rejection.created_at ? formatDate(new Date(rejection.created_at)) : "-";
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
                <SortableHeader label={col.label} columnId={col.id} sortConfig={sortConfig} onSort={onSort} />
              </TableHead>
            ))}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rejections.map((rejection) => (
            <TableRow key={rejection.id} className={selectedIds.has(rejection.id) ? "bg-muted/50" : ""}>
              <TableCell>
                <Checkbox
                  checked={selectedIds.has(rejection.id)}
                  onCheckedChange={(checked) => onSelectChange(rejection.id, !!checked)}
                />
              </TableCell>
              {visibleColumns.map((col) => (
                <TableCell key={col.id}>{renderCellValue(rejection, col.id)}</TableCell>
              ))}
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <Dialog>
                      <DialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <AlertCircle className="h-4 w-4 mr-2" />
                          View Rejection Reason
                        </DropdownMenuItem>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Rejection Details</DialogTitle>
                          <DialogDescription>
                            Full error response from {rejection.advertisers?.name}
                          </DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="max-h-[400px] border rounded-lg bg-muted/50">
                          <pre className="p-4 text-xs whitespace-pre-wrap break-all">
                            {rejection.reason
                              ? (() => {
                                  try {
                                    return JSON.stringify(JSON.parse(rejection.reason), null, 2);
                                  } catch {
                                    return rejection.reason;
                                  }
                                })()
                              : "No details available"}
                          </pre>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                    <DropdownMenuItem onClick={() => setRequestDialogId(rejection.id)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Request
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setResponseDialogId(rejection.id)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Response
                    </DropdownMenuItem>
                    {canDeleteLeads && (
                      <DropdownMenuItem onClick={() => onDelete(rejection)} className="text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Full Request Details Dialog */}
      {(() => {
        const rejection = rejections.find(r => r.id === requestDialogId);
        const dist = rejection?.distribution;
        const advertiserName = rejection?.advertisers?.name || "Advertiser";
        return (
          <Dialog open={!!requestDialogId} onOpenChange={(open) => !open && setRequestDialogId(null)}>
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
                    const parsedPayload = dist?.request_payload ? parseRequestPayload(dist.request_payload) : null;
                    const payload = parsedPayload
                      ? parsedPayload.kind === "form"
                        ? Object.fromEntries(parsedPayload.value)
                        : parsedPayload.value
                      : null;
                    const fullRequest = { url: dist?.request_url, headers: dist?.request_headers, payload };
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
                      <p className="text-xs mt-1">This lead has no recorded request data.</p>
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
                        {!dist.request_payload ? (
                          <p className="text-xs text-muted-foreground bg-background p-2 rounded">Not recorded</p>
                        ) : (() => {
                          const parsed = parseRequestPayload(dist.request_payload);
                          if (parsed.kind === "form") {
                            return (
                              <div className="bg-background rounded border divide-y">
                                {parsed.value.map(([key, value], i) => (
                                  <div key={i} className="flex items-start gap-2 px-2 py-1.5 text-xs">
                                    <span className="font-mono font-medium text-muted-foreground shrink-0">{key}</span>
                                    <span className="font-mono break-all">{value}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          }
                          const text = parsed.kind === "json" ? JSON.stringify(parsed.value, null, 2) : parsed.value;
                          return <pre className="text-xs bg-background p-2 rounded whitespace-pre-wrap break-all">{text}</pre>;
                        })()}
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
        const rejection = rejections.find(r => r.id === responseDialogId);
        const dist = rejection?.distribution;
        const advertiserName = rejection?.advertisers?.name || "Advertiser";

        const buildResponseContent = () => {
          if (!dist?.response) return "No response recorded";
          try {
            return JSON.stringify(JSON.parse(dist.response), null, 2);
          } catch {
            return dist.response;
          }
        };

        return (
          <Dialog open={!!responseDialogId} onOpenChange={(open) => !open && setResponseDialogId(null)}>
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
                      <p className="text-xs mt-1">This lead has no recorded response data.</p>
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
