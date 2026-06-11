import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useRoles, useSyncUserCustomRoles } from "@/hooks/useRoles";

const SYSTEM_ROLE_SLUGS = new Set(["super_admin", "manager", "agent", "affiliate"]);

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    fullName: "",
    roleSlug: "",
  });
  const queryClient = useQueryClient();
  const syncCustomRoles = useSyncUserCustomRoles();

  const { data: allRoles, isLoading: rolesLoading } = useRoles();

  const roleOptions = (allRoles ?? []).map(r => ({ value: r.slug, label: r.name }));

  const reset = () =>
    setFormData({ username: "", email: "", password: "", fullName: "", roleSlug: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username || !formData.email || !formData.password) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!formData.roleSlug) {
      toast.error("Please select a role");
      return;
    }

    const isSystem = SYSTEM_ROLE_SLUGS.has(formData.roleSlug);

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: formData.email,
          password: formData.password,
          username: formData.username,
          fullName: formData.fullName,
          // Pass the system role if applicable, otherwise empty array
          roles: isSystem ? [formData.roleSlug] : [],
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Assign custom role if one was selected
      if (!isSystem && data?.userId) {
        const customRole = (allRoles ?? []).find(r => r.slug === formData.roleSlug);
        if (customRole) {
          await syncCustomRoles.mutateAsync({ userId: data.userId, roleIds: [customRole.id] });
        }
      }

      toast.success("User created successfully");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      setOpen(false);
      reset();
    } catch (error: any) {
      toast.error(error.message || "Failed to create user");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <button type="button" className={cn(buttonVariants())}>
          <UserPlus className="h-4 w-4 mr-2" />
          Create User
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Add a new user with their credentials and assign a role.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  placeholder="e.g. 1001"
                  value={formData.username}
                  onChange={e => setFormData(p => ({ ...p, username: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={e => setFormData(p => ({ ...p, fullName: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <SearchableSelect
                value={formData.roleSlug}
                onValueChange={v => setFormData(p => ({ ...p, roleSlug: v === "all" ? "" : v }))}
                options={roleOptions}
                placeholder={rolesLoading ? "Loading roles…" : "Select a role…"}
                searchPlaceholder="Search roles…"
                emptyMessage="No roles found."
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setOpen(false); reset(); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
