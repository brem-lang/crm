import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useRoles, useUserCustomRoles, useSyncUserCustomRoles } from "@/hooks/useRoles";
import { SearchableSelect } from "@/components/ui/searchable-select";

const SYSTEM_ROLE_SLUGS = new Set(["super_admin", "manager", "agent", "affiliate"]);

interface UserData {
  id: string;
  username: string | null;
  email: string | null;
  full_name: string | null;
  roles?: string[];
}

interface EditUserDialogProps {
  user: UserData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EditUserForm({ user, onClose }: { user: UserData; onClose: () => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState(user.username || "");
  const [fullName, setFullName] = useState(user.full_name || "");
  const queryClient = useQueryClient();

  const { data: allRoles, isLoading: rolesLoading } = useRoles();
  const { data: existingCustomRoleIds } = useUserCustomRoles(user.id);
  const syncCustomRoles = useSyncUserCustomRoles();

  // Determine the currently active role slug (system role takes priority, else first custom role)
  const currentSystemRole = user.roles?.[0] ?? "";
  const currentCustomRoleSlug =
    existingCustomRoleIds?.[0] !== undefined
      ? (allRoles?.find(r => r.id === existingCustomRoleIds[0])?.slug ?? "")
      : "";
  const derivedSlug = currentSystemRole || currentCustomRoleSlug;

  const [selectedSlug, setSelectedSlug] = useState(derivedSlug);
  const [synced, setSynced] = useState(false);

  // Once both async sources arrive, resolve the true current role (once only)
  if (!synced && allRoles !== undefined && existingCustomRoleIds !== undefined) {
    const customSlug = existingCustomRoleIds[0]
      ? (allRoles.find(r => r.id === existingCustomRoleIds[0])?.slug ?? "")
      : "";
    setSelectedSlug(currentSystemRole || customSlug);
    setSynced(true);
  }

  const roleOptions = (allRoles ?? []).map(r => ({ value: r.slug, label: r.name }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSlug) {
      toast.error("Please select a role");
      return;
    }

    const isSystem = SYSTEM_ROLE_SLUGS.has(selectedSlug);

    setIsLoading(true);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ username: username || null, full_name: fullName || null })
        .eq("id", user.id);
      if (profileError) throw profileError;

      if (isSystem) {
        // Set the selected system role and clear any custom roles
        const { error: rolesError } = await supabase.rpc("set_user_roles", {
          _target_user_id: user.id,
          _roles: [selectedSlug] as any,
        });
        if (rolesError) throw rolesError;
        await syncCustomRoles.mutateAsync({ userId: user.id, roleIds: [] });
      } else {
        // Clear system roles and set the custom role
        const { error: rolesError } = await supabase.rpc("set_user_roles", {
          _target_user_id: user.id,
          _roles: [] as any,
        });
        if (rolesError) throw rolesError;
        const customRole = allRoles?.find(r => r.slug === selectedSlug);
        await syncCustomRoles.mutateAsync({
          userId: user.id,
          roleIds: customRole ? [customRole.id] : [],
        });
      }

      toast.success("User updated successfully");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to update user");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="edit-username">Username</Label>
            <Input
              id="edit-username"
              placeholder="e.g. 1001"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-fullName">Full Name</Label>
            <Input
              id="edit-fullName"
              placeholder="John Doe"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-email">Email</Label>
          <Input
            id="edit-email"
            type="email"
            value={user.email || ""}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">Email cannot be changed</p>
        </div>
        <div className="space-y-2">
          <Label>Role *</Label>
          <SearchableSelect
            value={selectedSlug}
            onValueChange={v => setSelectedSlug(v === "all" ? "" : v)}
            options={roleOptions}
            placeholder={rolesLoading ? "Loading roles…" : "Select a role…"}
            searchPlaceholder="Search roles…"
            emptyMessage="No roles found."
            className="w-full"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>Update user details and role.</DialogDescription>
        </DialogHeader>
        {user && (
          <EditUserForm key={user.id} user={user} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
