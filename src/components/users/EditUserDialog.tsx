import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoles, useUserCustomRoles, useSyncUserCustomRoles } from "@/hooks/useRoles";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  useUserAffiliateAssignments,
  useSetUserAffiliateAssignments,
} from "@/hooks/useUserAffiliateAssignments";
import {
  useUserAdvertiserAssignments,
  useSetUserAdvertiserAssignments,
} from "@/hooks/useUserAdvertiserAssignments";

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

  const isAffiliateManager = selectedSlug === "affiliate_manager";

  // Affiliate assignment state (only relevant for affiliate_manager role)
  const { data: currentAssignments } = useUserAffiliateAssignments(isAffiliateManager ? user.id : undefined);
  const setAffiliateAssignments = useSetUserAffiliateAssignments();
  const [selectedAffiliateIds, setSelectedAffiliateIds] = useState<string[]>([]);
  const [affiliatesSynced, setAffiliatesSynced] = useState(false);

  if (!affiliatesSynced && currentAssignments !== undefined) {
    setSelectedAffiliateIds(currentAssignments);
    setAffiliatesSynced(true);
  }

  const { data: allAffiliates } = useQuery({
    queryKey: ["affiliates-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliates")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: isAffiliateManager,
  });

  const toggleAffiliate = (id: string) => {
    setSelectedAffiliateIds(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const isAdvertiserManager = selectedSlug === "advertiser_manager";

  // Advertiser assignment state (only relevant for advertiser_manager role)
  const { data: currentAdvertiserAssignments } = useUserAdvertiserAssignments(isAdvertiserManager ? user.id : undefined);
  const setAdvertiserAssignments = useSetUserAdvertiserAssignments();
  const [selectedAdvertiserIds, setSelectedAdvertiserIds] = useState<string[]>([]);
  const [advertisersSynced, setAdvertisersSynced] = useState(false);

  if (!advertisersSynced && currentAdvertiserAssignments !== undefined) {
    setSelectedAdvertiserIds(currentAdvertiserAssignments);
    setAdvertisersSynced(true);
  }

  const { data: allAdvertisers } = useQuery({
    queryKey: ["advertisers-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advertisers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: isAdvertiserManager,
  });

  const toggleAdvertiser = (id: string) => {
    setSelectedAdvertiserIds(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

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

      // Save affiliate assignments if the role is affiliate_manager
      if (selectedSlug === "affiliate_manager") {
        await setAffiliateAssignments.mutateAsync({
          userId: user.id,
          affiliateIds: selectedAffiliateIds,
        });
      }

      // Save advertiser assignments if the role is advertiser_manager
      if (selectedSlug === "advertiser_manager") {
        await setAdvertiserAssignments.mutateAsync({
          userId: user.id,
          advertiserIds: selectedAdvertiserIds,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            onValueChange={v => {
              setSelectedSlug(v === "all" ? "" : v);
              setAffiliatesSynced(false);
              setAdvertisersSynced(false);
            }}
            options={roleOptions}
            placeholder={rolesLoading ? "Loading roles…" : "Select a role…"}
            searchPlaceholder="Search roles…"
            emptyMessage="No roles found."
            className="w-full"
          />
        </div>

        {isAffiliateManager && (
          <div className="space-y-2">
            <Label>Assigned Affiliates</Label>
            <p className="text-xs text-muted-foreground">
              This user will only see leads from the selected affiliates.
            </p>
            <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
              {!allAffiliates ? (
                <p className="text-sm text-muted-foreground">Loading affiliates…</p>
              ) : allAffiliates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active affiliates found.</p>
              ) : (
                allAffiliates.map(affiliate => (
                  <div key={affiliate.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`aff-${affiliate.id}`}
                      checked={selectedAffiliateIds.includes(affiliate.id)}
                      onCheckedChange={() => toggleAffiliate(affiliate.id)}
                    />
                    <label
                      htmlFor={`aff-${affiliate.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {affiliate.name}
                    </label>
                  </div>
                ))
              )}
            </div>
            {selectedAffiliateIds.length === 0 && (
              <p className="text-xs text-destructive">
                No affiliates assigned — this user will see no leads.
              </p>
            )}
          </div>
        )}

        {isAdvertiserManager && (
          <div className="space-y-2">
            <Label>Assigned Advertisers</Label>
            <p className="text-xs text-muted-foreground">
              This user will only see leads distributed to the selected advertisers.
            </p>
            <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
              {!allAdvertisers ? (
                <p className="text-sm text-muted-foreground">Loading advertisers…</p>
              ) : allAdvertisers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active advertisers found.</p>
              ) : (
                allAdvertisers.map(advertiser => (
                  <div key={advertiser.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`adv-${advertiser.id}`}
                      checked={selectedAdvertiserIds.includes(advertiser.id)}
                      onCheckedChange={() => toggleAdvertiser(advertiser.id)}
                    />
                    <label
                      htmlFor={`adv-${advertiser.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {advertiser.name}
                    </label>
                  </div>
                ))
              )}
            </div>
            {selectedAdvertiserIds.length === 0 && (
              <p className="text-xs text-destructive">
                No advertisers assigned — this user will see no leads.
              </p>
            )}
          </div>
        )}
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
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
