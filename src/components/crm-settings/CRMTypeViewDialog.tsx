import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Lock, Pencil } from "lucide-react";

interface CRMTypeViewData {
  code: string;
  name: string;
  description?: string;
  default_url?: string;
  request_format: string;
  auth_type: string;
  auth_header_name?: string;
  required_fields: string[];
  use_forwarder?: boolean;
  is_active?: boolean;
  isSystem?: boolean;
}

interface CRMTypeViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CRMTypeViewData | null;
  onEdit?: () => void;
}

const FORMAT_LABELS: Record<string, string> = {
  json: "JSON",
  "form-urlencoded": "Form-urlencoded",
};

const AUTH_LABELS: Record<string, string> = {
  none: "None",
  header: "Header",
  query_param: "Query Parameter",
  body: "Body Field",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 items-start py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

export function CRMTypeViewDialog({
  open,
  onOpenChange,
  data,
  onEdit,
}: CRMTypeViewDialogProps) {
  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {data.name}
            {data.isSystem && (
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="divide-y">
          <Row label="Code">
            <Badge variant="secondary" className="font-mono text-xs">
              {data.code}
            </Badge>
          </Row>

          {data.description && (
            <Row label="Description">
              <span className="text-muted-foreground">{data.description}</span>
            </Row>
          )}

          {data.default_url && (
            <Row label="Default URL">
              <span className="font-mono text-xs break-all">{data.default_url}</span>
            </Row>
          )}

          <Row label="Request Format">
            <Badge variant="outline" className="text-xs font-mono">
              {FORMAT_LABELS[data.request_format] ?? data.request_format}
            </Badge>
          </Row>

          <Row label="Auth Type">
            <Badge variant="outline" className="text-xs">
              {AUTH_LABELS[data.auth_type] ?? data.auth_type}
            </Badge>
          </Row>

          {data.auth_type === "header" && data.auth_header_name && (
            <Row label="Auth Header">
              <span className="font-mono text-xs">{data.auth_header_name}</span>
            </Row>
          )}

          <Row label="Required Fields">
            {data.required_fields.length === 0 ? (
              <span className="text-muted-foreground text-xs">None</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {data.required_fields.map((f) => (
                  <Badge key={f} variant="outline" className="text-xs font-mono py-0">
                    {f}
                  </Badge>
                ))}
              </div>
            )}
          </Row>

          {!data.isSystem && (
            <>
              <Row label="VPS Forwarder">
                <Badge
                  className={`text-xs border-0 ${
                    data.use_forwarder
                      ? "bg-blue-500/10 text-blue-600"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {data.use_forwarder ? "Enabled" : "Disabled"}
                </Badge>
              </Row>

              <Row label="Status">
                <Badge
                  className={`text-xs border-0 ${
                    data.is_active
                      ? "bg-green-500/10 text-green-600"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {data.is_active ? "Active" : "Inactive"}
                </Badge>
              </Row>
            </>
          )}

          {data.isSystem && (
            <>
              <Separator />
              <div className="py-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                System type — built into the distribution engine, read-only.
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!data.isSystem && onEdit && (
            <Button onClick={() => { onOpenChange(false); onEdit(); }}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
