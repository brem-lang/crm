import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Loader2 } from "lucide-react";
import { type CRMType, type CreateCRMTypeData } from "@/hooks/useCRMTypes";

interface CRMTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTarget?: CRMType | null;
  onSave: (data: CreateCRMTypeData) => Promise<void>;
  isSaving: boolean;
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const REQUEST_FORMATS = [
  { value: "json", label: "JSON" },
  { value: "form-urlencoded", label: "Form-urlencoded" },
];

const AUTH_TYPES = [
  { value: "none", label: "None" },
  { value: "header", label: "Header" },
  { value: "query_param", label: "Query Parameter" },
  { value: "body", label: "Body Field" },
];

const defaultForm = (): CreateCRMTypeData => ({
  code: "",
  name: "",
  description: "",
  default_url: "",
  request_format: "json",
  auth_type: "header",
  auth_header_name: "",
  required_fields: ["url", "api_key"],
  use_forwarder: false,
  is_active: true,
});

export function CRMTypeDialog({
  open,
  onOpenChange,
  editTarget,
  onSave,
  isSaving,
}: CRMTypeDialogProps) {
  const isEdit = !!editTarget;
  const [form, setForm] = useState<CreateCRMTypeData>(defaultForm());
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [fieldInput, setFieldInput] = useState("");

  useEffect(() => {
    if (open) {
      if (editTarget) {
        setForm({
          code: editTarget.code,
          name: editTarget.name,
          description: editTarget.description ?? "",
          default_url: editTarget.default_url ?? "",
          request_format: editTarget.request_format,
          auth_type: editTarget.auth_type,
          auth_header_name: editTarget.auth_header_name ?? "",
          required_fields: editTarget.required_fields ?? [],
          use_forwarder: editTarget.use_forwarder,
          is_active: editTarget.is_active,
        });
        setCodeManuallyEdited(true);
      } else {
        setForm(defaultForm());
        setCodeManuallyEdited(false);
      }
      setFieldInput("");
    }
  }, [open, editTarget]);

  const handleNameChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      name: value,
      ...(!codeManuallyEdited ? { code: toSlug(value) } : {}),
    }));
  };

  const handleCodeChange = (value: string) => {
    setCodeManuallyEdited(true);
    setForm((prev) => ({ ...prev, code: toSlug(value) }));
  };

  const addField = () => {
    const trimmed = fieldInput.trim().toLowerCase().replace(/\s+/g, "_");
    if (!trimmed) return;
    const parts = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    setForm((prev) => ({
      ...prev,
      required_fields: [...new Set([...(prev.required_fields ?? []), ...parts])],
    }));
    setFieldInput("");
  };

  const removeField = (field: string) => {
    setForm((prev) => ({
      ...prev,
      required_fields: (prev.required_fields ?? []).filter((f) => f !== field),
    }));
  };

  const handleSubmit = async () => {
    await onSave(form);
  };

  const isValid = form.name.trim() && form.code.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit CRM Type" : "New CRM Type"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the configuration for this CRM integration"
              : "Define a new CRM integration that advertisers can use"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label>Name <span className="text-destructive">*</span></Label>
            <Input
              placeholder="e.g. My Custom CRM"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>

          {/* Code */}
          <div className="space-y-2">
            <Label>Code (slug) <span className="text-destructive">*</span></Label>
            <Input
              placeholder="e.g. my_custom_crm"
              value={form.code}
              onChange={(e) => handleCodeChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Unique identifier — lowercase letters, numbers, underscores only.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Brief description of this CRM integration..."
              value={form.description ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={2}
            />
          </div>

          {/* Default URL */}
          <div className="space-y-2">
            <Label>Default URL</Label>
            <Input
              placeholder="https://api.example.com/leads"
              value={form.default_url ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, default_url: e.target.value }))}
            />
          </div>

          {/* Request Format + Auth Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Request Format</Label>
              <Select
                value={form.request_format}
                onValueChange={(v) => setForm((prev) => ({ ...prev, request_format: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUEST_FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Auth Type</Label>
              <Select
                value={form.auth_type}
                onValueChange={(v) => setForm((prev) => ({ ...prev, auth_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUTH_TYPES.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Auth Header Name — shown only for header auth */}
          {form.auth_type === "header" && (
            <div className="space-y-2">
              <Label>Auth Header Name</Label>
              <Input
                placeholder="e.g. Api-Key or Authorization"
                value={form.auth_header_name ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, auth_header_name: e.target.value }))
                }
              />
            </div>
          )}

          {/* Required Config Fields */}
          <div className="space-y-2">
            <Label>Required Config Fields</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. url, api_key, sender"
                value={fieldInput}
                onChange={(e) => setFieldInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addField();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addField}>
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Press Enter or click Add. Separate multiple fields with commas.
            </p>
            {(form.required_fields ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {(form.required_fields ?? []).map((f) => (
                  <Badge key={f} variant="secondary" className="gap-1 pr-1">
                    {f}
                    <button
                      type="button"
                      onClick={() => removeField(f)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-1 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="use-forwarder">Use VPS Forwarder</Label>
                <p className="text-xs text-muted-foreground">
                  Route requests through the static-IP forwarder for IP whitelisting
                </p>
              </div>
              <Switch
                id="use-forwarder"
                checked={form.use_forwarder ?? false}
                onCheckedChange={(v) => setForm((prev) => ({ ...prev, use_forwarder: v }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is-active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive types are hidden from the advertiser form
                </p>
              </div>
              <Switch
                id="is-active"
                checked={form.is_active ?? true}
                onCheckedChange={(v) => setForm((prev) => ({ ...prev, is_active: v }))}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Create CRM Type"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
