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
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { cn } from "@/lib/utils";

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

export default function RolesPermissions() {
  const { data: roles, isLoading: rolesLoading } = useRoles();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const deleteRoleMutation = useDeleteRole();

  const { data: rolePerms, isLoading: permsLoading } = useRolePermissions(selectedRole?.slug);
  const updatePermissions = useUpdateRolePermissions();

  const [localPerms, setLocalPerms] = useState<Set<UserPermission>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [permSearch, setPermSearch] = useState("");

  const handleSelectRole = (role: Role) => {
    setSelectedRole(role);
    setDirty(false);
    setPermSearch("");
  };

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

  const isSuperAdmin = selectedRole?.slug === "super_admin";
  const allPermissionIds = AVAILABLE_PERMISSIONS.map(p => p.id) as UserPermission[];
  const displayPerms: Set<UserPermission> = isSuperAdmin ? new Set(allPermissionIds) : localPerms;

  const trimmedPermSearch = permSearch.trim().toLowerCase();
  const filteredModules = PERMISSION_MODULES
    .map(([group, perms]) => {
      if (!trimmedPermSearch) return [group, perms] as [string, typeof AVAILABLE_PERMISSIONS];
      const matched = perms.filter(p =>
        p.label.toLowerCase().includes(trimmedPermSearch) ||
        p.description.toLowerCase().includes(trimmedPermSearch) ||
        p.id.toLowerCase().includes(trimmedPermSearch) ||
        group.toLowerCase().includes(trimmedPermSearch)
      );
      return [group, matched] as [string, typeof AVAILABLE_PERMISSIONS];
    })
    .filter(([, perms]) => perms.length > 0);

  const trimmedSidebarSearch = sidebarSearch.trim().toLowerCase();
  const systemRoles = (roles || []).filter(r => r.is_system);
  const customRoles = (roles || []).filter(r => !r.is_system);

  const filterRole = (r: Role) =>
    !trimmedSidebarSearch || r.name.toLowerCase().includes(trimmedSidebarSearch) || r.slug.toLowerCase().includes(trimmedSidebarSearch);

  const filteredSystem = systemRoles.filter(filterRole);
  const filteredCustom = customRoles.filter(filterRole);

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b shrink-0 gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <h1 className="text-xl font-bold">Roles & Permissions</h1>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Role
          </Button>
        </div>

        {/* Two-pane content */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left sidebar */}
          <div className="w-72 border-r shrink-0 flex flex-col">
            {/* Sidebar search */}
            <div className="p-3 border-b shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search roles…"
                  value={sidebarSearch}
                  onChange={e => setSidebarSearch(e.target.value)}
                  className="pl-8 pr-8 h-8 text-sm"
                />
                {sidebarSearch && (
                  <button
                    type="button"
                    onClick={() => setSidebarSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2">
                {rolesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {filteredSystem.length > 0 && (
                      <div className="mb-1">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">
                          System Roles
                        </p>
                        {filteredSystem.map(role => (
                          <RoleSidebarItem
                            key={role.id}
                            role={role}
                            selected={selectedRole?.id === role.id}
                            onClick={() => handleSelectRole(role)}
                            onDelete={() => setDeleteRole(role)}
                          />
                        ))}
                      </div>
                    )}
                    {filteredCustom.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">
                          Custom Roles
                        </p>
                        {filteredCustom.map(role => (
                          <RoleSidebarItem
                            key={role.id}
                            role={role}
                            selected={selectedRole?.id === role.id}
                            onClick={() => handleSelectRole(role)}
                            onDelete={() => setDeleteRole(role)}
                          />
                        ))}
                      </div>
                    )}
                    {filteredSystem.length === 0 && filteredCustom.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-8">No roles found</p>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right panel */}
          {selectedRole ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between px-6 py-3 border-b shrink-0 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "w-2.5 h-2.5 rounded-full shrink-0",
                      getRoleColor(selectedRole.color).bg.replace("/10", "")
                    )}
                  />
                  <Badge
                    variant="outline"
                    className={cn(
                      "capitalize text-sm px-3 py-1 shrink-0",
                      getRoleColor(selectedRole.color).bg,
                      getRoleColor(selectedRole.color).text,
                      getRoleColor(selectedRole.color).border
                    )}
                  >
                    {selectedRole.name}
                  </Badge>
                  <span className="text-sm text-muted-foreground flex items-center gap-1 shrink-0">
                    <Users className="h-3.5 w-3.5" />
                    {selectedRole.user_count ?? 0} user{selectedRole.user_count !== 1 ? "s" : ""}
                  </span>
                  {selectedRole.description && (
                    <span className="text-sm text-muted-foreground truncate hidden md:block">
                      — {selectedRole.description}
                    </span>
                  )}
                  {isSuperAdmin && (
                    <Badge variant="secondary" className="gap-1 shrink-0">
                      <Lock className="h-3 w-3" />
                      All permissions locked
                    </Badge>
                  )}
                </div>
                {!isSuperAdmin && (
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!dirty || updatePermissions.isPending}
                    className="gap-2 shrink-0"
                  >
                    {updatePermissions.isPending
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Save className="h-4 w-4" />
                    }
                    Save Changes
                  </Button>
                )}
              </div>

              {/* Permissions content */}
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-3">
                  {permsLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      {/* Permission search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          placeholder="Search permissions…"
                          value={permSearch}
                          onChange={e => setPermSearch(e.target.value)}
                          className="pl-9 pr-9"
                        />
                        {permSearch && (
                          <button
                            type="button"
                            onClick={() => setPermSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {filteredModules.length === 0 ? (
                        <div className="text-center py-10 text-sm text-muted-foreground border rounded-lg">
                          No permissions match "{permSearch}"
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
                            forceOpen={!!trimmedPermSearch}
                          />
                        ))
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <ShieldCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-base font-medium text-muted-foreground">Select a role</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Click a role on the left to view and edit its permissions.
                </p>
              </div>
            </div>
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

function RoleSidebarItem({
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
        "flex items-center gap-2.5 px-2 py-2 rounded-md cursor-pointer transition-colors group",
        selected
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted/60 text-foreground"
      )}
    >
      <div className={cn("w-2 h-2 rounded-full shrink-0", c.bg.replace("/10", ""))} />
      <span className="text-sm font-medium truncate flex-1">{role.name}</span>
      <span className="text-xs text-muted-foreground flex items-center gap-0.5 shrink-0">
        <Users className="h-3 w-3" />
        {role.user_count ?? 0}
      </span>
      {role.is_system && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
          Sys
        </Badge>
      )}
      {!role.is_system && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5 shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
