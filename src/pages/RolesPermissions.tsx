import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRoles, useCreateRole, useDeleteRole, getRoleColor, ROLE_COLORS, Role } from "@/hooks/useRoles";
import { useRolePermissions, useUpdateRolePermissions } from "@/hooks/useRolePermissions";
import { AVAILABLE_PERMISSIONS, UserPermission } from "@/hooks/useUserPermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  ShieldCheck,
  Plus,
  Trash2,
  Users,
  Lock,
  ChevronDown,
  ChevronRight,
  Save,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Group the AVAILABLE_PERMISSIONS by their group field — same groups as the plan spec
const PERMISSION_MODULES = Array.from(
  AVAILABLE_PERMISSIONS.reduce((acc, p) => {
    if (!acc.has(p.group)) acc.set(p.group, []);
    acc.get(p.group)!.push(p);
    return acc;
  }, new Map<string, typeof AVAILABLE_PERMISSIONS>())
);

function CreateRoleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("gray");
  const [slugEdited, setSlugEdited] = useState(false);
  const createRole = useCreateRole();

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugEdited) {
      setSlug(v.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    await createRole.mutateAsync({ name: name.trim(), slug: slug.trim(), description: description.trim(), color });
    setName(""); setSlug(""); setDescription(""); setColor("gray"); setSlugEdited(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Create Custom Role</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="role-name">Role Name *</Label>
            <Input id="role-name" placeholder="e.g. Senior Agent" value={name} onChange={e => handleNameChange(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-slug">Slug *</Label>
            <Input
              id="role-slug"
              placeholder="e.g. senior_agent"
              value={slug}
              onChange={e => { setSlug(e.target.value); setSlugEdited(true); }}
              required
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Unique identifier, lowercase with underscores</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-desc">Description</Label>
            <Textarea id="role-desc" placeholder="What can this role do?" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {ROLE_COLORS.filter(c => c.value !== "gray").concat(ROLE_COLORS.filter(c => c.value === "gray")).map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "w-7 h-7 rounded-full border-2 transition-all",
                    c.bg.replace("/10", ""),
                    color === c.value ? "border-foreground scale-110" : "border-transparent"
                  )}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createRole.isPending}>
              {createRole.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PermissionModule({
  group,
  perms,
  activePerms,
  locked,
  onToggle,
  forceOpen = false,
}: {
  group: string;
  perms: typeof AVAILABLE_PERMISSIONS;
  activePerms: Set<UserPermission>;
  locked: boolean;
  onToggle: (id: UserPermission) => void;
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const isOpen = forceOpen || open;
  const groupCount = perms.filter(p => activePerms.has(p.id)).length;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => !forceOpen && setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-sm font-medium"
      >
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          {group}
        </div>
        <span className="text-xs text-muted-foreground">{groupCount}/{perms.length}</span>
      </button>
      {isOpen && (
        <div className="divide-y">
          {perms.map(perm => {
            const active = activePerms.has(perm.id);
            return (
              <div
                key={perm.id}
                className={cn(
                  "flex items-center justify-between px-4 py-3 transition-colors",
                  locked ? "opacity-70" : "hover:bg-muted/30"
                )}
              >
                <div className="space-y-0.5 flex-1 mr-4">
                  <p className="text-sm font-medium flex items-center gap-2">
                    {perm.label}
                    {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </p>
                  <p className="text-xs text-muted-foreground">{perm.description}</p>
                </div>
                <Switch
                  checked={active}
                  disabled={locked}
                  onCheckedChange={() => !locked && onToggle(perm.id)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RoleCard({
  role,
  selected,
  onClick,
  onDelete,
}: {
  role: Role;
  selected: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const c = getRoleColor(role.color);
  return (
    <div
      onClick={onClick}
      className={cn(
        "p-4 rounded-lg border cursor-pointer transition-all",
        selected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40 hover:bg-muted/30"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="outline" className={cn("shrink-0 capitalize text-xs", c.bg, c.text, c.border)}>
            {role.name}
          </Badge>
        </div>
        {!role.is_system && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={e => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      {role.description && (
        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{role.description}</p>
      )}
      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
        <Users className="h-3 w-3" />
        <span>{role.user_count ?? 0} user{role.user_count !== 1 ? "s" : ""}</span>
        {role.is_system && (
          <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">System</Badge>
        )}
      </div>
    </div>
  );
}

export default function RolesPermissions() {
  const { data: roles, isLoading: rolesLoading } = useRoles();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const deleteRoleMutation = useDeleteRole();

  const { data: rolePerms, isLoading: permsLoading } = useRolePermissions(selectedRole?.slug);
  const updatePermissions = useUpdateRolePermissions();

  // Local editable permissions state (initialised from DB, tracks unsaved changes)
  const [localPerms, setLocalPerms] = useState<Set<UserPermission>>(new Set());
  const [dirty, setDirty] = useState(false);

  const handleSelectRole = (role: Role) => {
    setSelectedRole(role);
    setDirty(false);
  };

  // Sync local state when DB data loads for a new selected role
  const [lastLoadedSlug, setLastLoadedSlug] = useState<string | null>(null);
  if (selectedRole && rolePerms !== undefined && selectedRole.slug !== lastLoadedSlug) {
    setLocalPerms(new Set(rolePerms));
    setLastLoadedSlug(selectedRole.slug);
    setDirty(false);
  }

  const handleToggle = (id: UserPermission) => {
    setLocalPerms(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    await updatePermissions.mutateAsync({
      roleSlug: selectedRole.slug,
      permissions: Array.from(localPerms),
    });
    setDirty(false);
  };

  const [searchQuery, setSearchQuery] = useState("");

  const isSuperAdmin = selectedRole?.slug === "super_admin";
  const allPermissionIds = AVAILABLE_PERMISSIONS.map(p => p.id) as UserPermission[];
  const displayPerms: Set<UserPermission> = isSuperAdmin ? new Set(allPermissionIds) : localPerms;

  const trimmedSearch = searchQuery.trim().toLowerCase();
  const filteredModules = PERMISSION_MODULES
    .map(([group, perms]) => {
      if (!trimmedSearch) return [group, perms] as [string, typeof AVAILABLE_PERMISSIONS];
      const matched = perms.filter(p =>
        p.label.toLowerCase().includes(trimmedSearch) ||
        p.description.toLowerCase().includes(trimmedSearch) ||
        p.id.toLowerCase().includes(trimmedSearch) ||
        group.toLowerCase().includes(trimmedSearch)
      );
      return [group, matched] as [string, typeof AVAILABLE_PERMISSIONS];
    })
    .filter(([, perms]) => perms.length > 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-primary" />
              Roles & Permissions
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure what each role can access. Permissions are inherited automatically when a role is assigned to a user.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Role
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
          {/* Left panel — role list */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Roles</p>
            {rolesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                {roles?.map(role => (
                  <RoleCard
                    key={role.id}
                    role={role}
                    selected={selectedRole?.id === role.id}
                    onClick={() => handleSelectRole(role)}
                    onDelete={() => setDeleteRole(role)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right panel — permission editor */}
          {selectedRole ? (
            <div className="space-y-4">
              {/* Role header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={cn(
                      "capitalize text-sm px-3 py-1",
                      getRoleColor(selectedRole.color).bg,
                      getRoleColor(selectedRole.color).text,
                      getRoleColor(selectedRole.color).border
                    )}
                  >
                    {selectedRole.name}
                  </Badge>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {selectedRole.user_count ?? 0} user{selectedRole.user_count !== 1 ? "s" : ""}
                  </span>
                  {isSuperAdmin && (
                    <Badge variant="secondary" className="gap-1">
                      <Lock className="h-3 w-3" />
                      All permissions locked
                    </Badge>
                  )}
                </div>
                {!isSuperAdmin && (
                  <Button onClick={handleSave} disabled={!dirty || updatePermissions.isPending} className="gap-2">
                    {updatePermissions.isPending
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Save className="h-4 w-4" />
                    }
                    Save Changes
                  </Button>
                )}
              </div>

              {selectedRole.description && (
                <p className="text-sm text-muted-foreground">{selectedRole.description}</p>
              )}

              {permsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search permissions…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 pr-9"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {filteredModules.length === 0 ? (
                    <div className="text-center py-10 text-sm text-muted-foreground border rounded-lg">
                      No permissions match "{searchQuery}"
                    </div>
                  ) : (
                    filteredModules.map(([group, perms]) => (
                      <PermissionModule
                        key={group}
                        group={group}
                        perms={perms}
                        activePerms={displayPerms}
                        locked={isSuperAdmin}
                        onToggle={handleToggle}
                        forceOpen={!!trimmedSearch}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <Card className="flex items-center justify-center min-h-[300px]">
              <CardContent className="text-center py-12">
                <ShieldCheck className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <CardTitle className="text-lg text-muted-foreground">Select a role</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Click a role on the left to view and edit its permissions.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <CreateRoleDialog open={createOpen} onOpenChange={setCreateOpen} />

      <AlertDialog open={!!deleteRole} onOpenChange={v => !v && setDeleteRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteRole?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the role and remove it from any users it is assigned to. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteRole && deleteRoleMutation.mutate(deleteRole.id); setDeleteRole(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
