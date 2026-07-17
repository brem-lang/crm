import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useCRMTypes,
  useCreateCRMType,
  useUpdateCRMType,
  useDeleteCRMType,
  useToggleCRMType,
  type CRMType,
  type CreateCRMTypeData,
} from "@/hooks/useCRMTypes";
import { CRMTypeDialog } from "@/components/crm-settings/CRMTypeDialog";
import { CRMTypeViewDialog } from "@/components/crm-settings/CRMTypeViewDialog";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentUserPermissions } from "@/hooks/useUserPermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Lock, Plug, Eye } from "lucide-react";
import { toast } from "sonner";

// Hardcoded system CRM types (read-only reference)
const SYSTEM_TYPES = [
  { code: "trackbox",    name: "TrackBox",        description: "Requires AI/CI/GI params and separate POST/GET API keys", request_format: "json",             auth_type: "header",      required_fields: ["url", "api_key_post", "api_key_get", "username", "password", "ai", "ci", "gi"] },
  { code: "enigma",      name: "Getlinked",        description: "Form-urlencoded with Api-Key header",                     request_format: "form-urlencoded",  auth_type: "header",      required_fields: ["url", "api_key"] },
  { code: "drmailer",    name: "Dr Tracker",       description: "Form-urlencoded API with password and campaign ID",        request_format: "form-urlencoded",  auth_type: "body",        required_fields: ["url", "api_key", "pass", "campaign_id"] },
  { code: "timelocal",   name: "Timelocal",        description: "JSON API with Api-Key header auth",                       request_format: "json",             auth_type: "header",      required_fields: ["url", "api_key"] },
  { code: "elitecrm",    name: "EliteCRM",         description: "JSON API with Api-Key header, requires sender param",     request_format: "json",             auth_type: "header",      required_fields: ["url", "api_key", "sender"] },
  { code: "gsi",         name: "GSI Markets",      description: "PHP API with ID/hash URL parameter authentication",       request_format: "form-urlencoded",  auth_type: "query_param", required_fields: ["url", "gsi_id", "gsi_hash"] },
  { code: "elnopy",      name: "ELNOPY",           description: "Mpower Traffic — API token in query string, E.164 phone", request_format: "json",             auth_type: "query_param", required_fields: ["url", "api_token", "link_id", "source"] },
  { code: "reacto",      name: "Reacto Trading",   description: "Internal mTLS-secured trading platform integration",      request_format: "json",             auth_type: "header",      required_fields: ["url", "api_key"] },
  { code: "streamline11",name: "Streamline11",     description: "Form-urlencoded, auth via affid + funnel slug in body",   request_format: "form-urlencoded",  auth_type: "body",        required_fields: ["url", "affid", "funnel", "token"] },
  { code: "saxo",        name: "SAXO LTD",         description: "SAXO provider API — JSON POST, x-api-key header, camelCase field names", request_format: "json", auth_type: "header", required_fields: ["url", "api_key"] },
  { code: "noxwealth",  name: "NoxWealth",        description: "NoxWealth Forex CRM — Bearer token, affiliate_id required, JSON POST to /leads/add", request_format: "json", auth_type: "header", required_fields: ["url", "api_key", "affiliate_id"] },
  { code: "affilio",    name: "Affilio",          description: "JSON POST with username/password/apiKey header auth, lid + funnelName routing",          request_format: "json", auth_type: "header", required_fields: ["url", "api_key", "username", "auth_password", "lid"] },
  { code: "capitaltrading", name: "Capital Trading", description: "Capital Trading API — JSON POST with single authorization header, custom_fields for Source_ID/investment amount/case notes", request_format: "json", auth_type: "header", required_fields: ["url", "api_key"] },
  { code: "webullup",    name: "We Bull Up",       description: "We Bull Up provider API — JSON POST, x-api-key header, dedup by phone/email, paginated status polling", request_format: "json", auth_type: "header", required_fields: ["url", "api_key"] },
  { code: "notion",      name: "Notion",           description: "Notion (Jetpack API) — Clients endpoint, JSON POST with token+source+password+currency fields, GET get-clients for status/FTD polling, returns an autologin url", request_format: "json", auth_type: "body", required_fields: ["url", "api_key", "source", "password", "currency"] },
  { code: "custom",      name: "Custom",           description: "User-defined fields and auth",                            request_format: "json",             auth_type: "none",        required_fields: [] },
];

function formatLabel(value: string) {
  const map: Record<string, string> = {
    "json": "JSON",
    "form-urlencoded": "Form-urlencoded",
    "none": "No Auth",
    "header": "Header",
    "query_param": "Query Param",
    "body": "Body Field",
  };
  return map[value] ?? value;
}

function RequestBadge({ format }: { format: string }) {
  return (
    <Badge variant="outline" className="text-xs font-mono">
      {formatLabel(format)}
    </Badge>
  );
}

function AuthBadge({ authType }: { authType: string }) {
  const colors: Record<string, string> = {
    "none":        "bg-muted text-muted-foreground",
    "header":      "bg-blue-500/10 text-blue-600",
    "query_param": "bg-purple-500/10 text-purple-600",
    "body":        "bg-orange-500/10 text-orange-600",
  };
  return (
    <Badge className={`text-xs border-0 ${colors[authType] ?? "bg-muted"}`}>
      {formatLabel(authType)}
    </Badge>
  );
}

export default function CRMSettings() {
  const { isSuperAdmin, isManager } = useAuth();
  const {
    canViewCRMTypes,
    canCreateCRMTypes,
    canEditCRMTypes,
    canDeleteCRMTypes,
  } = useCurrentUserPermissions();

  const canView = isSuperAdmin || isManager || canViewCRMTypes;
  const canCreate = isSuperAdmin || isManager || canCreateCRMTypes;
  const canEdit = isSuperAdmin || isManager || canEditCRMTypes;
  const canDelete = isSuperAdmin || isManager || canDeleteCRMTypes;

  const { data: customTypes = [], isLoading } = useCRMTypes();
  const createType = useCreateCRMType();
  const updateType = useUpdateCRMType();
  const deleteType = useDeleteCRMType();
  const toggleType = useToggleCRMType();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CRMType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CRMType | null>(null);
  const [viewTarget, setViewTarget] = useState<(typeof SYSTEM_TYPES)[0] | CRMType | null>(null);
  const [viewIsSystem, setViewIsSystem] = useState(false);

  const openCreate = () => {
    setEditTarget(null);
    setDialogOpen(true);
  };

  const openEdit = (type: CRMType) => {
    setEditTarget(type);
    setDialogOpen(true);
  };

  const openViewSystem = (type: typeof SYSTEM_TYPES[0]) => {
    setViewTarget(type);
    setViewIsSystem(true);
  };

  const openViewCustom = (type: CRMType) => {
    setViewTarget(type);
    setViewIsSystem(false);
  };

  const handleSave = async (data: CreateCRMTypeData) => {
    if (editTarget) {
      await updateType.mutateAsync({ id: editTarget.id, ...data });
    } else {
      await createType.mutateAsync(data);
    }
    setDialogOpen(false);
    setEditTarget(null);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteType.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const handleToggle = (type: CRMType) => {
    toggleType.mutate(
      { id: type.id, is_active: !type.is_active },
      {
        onSuccess: () =>
          toast.success(`${type.name} ${!type.is_active ? "activated" : "deactivated"}`),
      }
    );
  };

  const isSaving = createType.isPending || updateType.isPending;

  if (!canView) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <Lock className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-lg font-medium">Access Restricted</p>
          <p className="text-muted-foreground text-sm max-w-xs">
            You don't have permission to view CRM Integrations. Contact your administrator.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Plug className="h-6 w-6 text-muted-foreground" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">CRM Integrations</h1>
              <p className="text-muted-foreground text-sm">
                Manage the CRM types available for advertisers
              </p>
            </div>
          </div>
        </div>

        {/* System Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4 text-muted-foreground" />
              System CRM Types
            </CardTitle>
            <CardDescription>
              Built-in integrations — read-only. These are implemented in the distribution engine and cannot be modified.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {SYSTEM_TYPES.map((t) => (
                <div
                  key={t.code}
                  className="flex items-start justify-between py-3 gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{t.name}</span>
                      <Badge variant="secondary" className="text-xs font-mono">
                        {t.code}
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-0">
                        active
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">
                      {t.description}
                    </p>
                    {t.required_fields.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {t.required_fields.map((f) => (
                          <Badge key={f} variant="outline" className="text-xs font-mono py-0">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <RequestBadge format={t.request_format} />
                    <AuthBadge authType={t.auth_type} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openViewSystem(t)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Lock className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Custom Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>Custom CRM Types</span>
              {customTypes.length > 0 && (
                <Badge variant="secondary">{customTypes.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Your custom integrations — fully editable and deletable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-4 py-3">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48 flex-1" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : customTypes.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Plug className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No custom CRM types yet</p>
                <p className="text-sm mt-1">
                  Click <strong>New CRM Type</strong> to create your first custom integration.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {customTypes.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-start justify-between py-3 gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{t.name}</span>
                        <Badge variant="secondary" className="text-xs font-mono">
                          {t.code}
                        </Badge>
                        <Badge
                          className={`text-xs border-0 ${
                            t.is_active
                              ? "bg-green-500/10 text-green-600"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {t.is_active ? "active" : "inactive"}
                        </Badge>
                      </div>
                      {t.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">
                          {t.description}
                        </p>
                      )}
                      {t.default_url && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5 truncate font-mono">
                          {t.default_url}
                        </p>
                      )}
                      {t.required_fields.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {t.required_fields.map((f) => (
                            <Badge key={f} variant="outline" className="text-xs font-mono py-0">
                              {f}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      <RequestBadge format={t.request_format} />
                      <AuthBadge authType={t.auth_type} />
                      {canEdit && (
                        <Switch
                          checked={t.is_active}
                          onCheckedChange={() => handleToggle(t)}
                          disabled={toggleType.isPending}
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openViewCustom(t)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(t)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(t)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Dialog */}
      <CRMTypeViewDialog
        open={!!viewTarget}
        onOpenChange={(v) => { if (!v) setViewTarget(null); }}
        data={
          viewTarget
            ? {
                code: viewTarget.code,
                name: viewTarget.name,
                description: viewTarget.description ?? "",
                default_url: (viewTarget as CRMType).default_url ?? "",
                request_format: viewTarget.request_format,
                auth_type: viewTarget.auth_type,
                auth_header_name: (viewTarget as CRMType).auth_header_name ?? "",
                required_fields: viewTarget.required_fields,
                use_forwarder: (viewTarget as CRMType).use_forwarder,
                is_active: (viewTarget as CRMType).is_active,
                isSystem: viewIsSystem,
              }
            : null
        }
        onEdit={
          !viewIsSystem && viewTarget && canEdit
            ? () => openEdit(viewTarget as CRMType)
            : undefined
        }
      />

      {/* Create / Edit Dialog */}
      <CRMTypeDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditTarget(null);
        }}
        editTarget={editTarget}
        onSave={handleSave}
        isSaving={isSaving}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete CRM Type?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> (
              <code>{deleteTarget?.code}</code>). Any advertisers currently using this
              type will need to be updated manually.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
