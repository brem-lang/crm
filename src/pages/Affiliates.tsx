import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAffiliates, useCreateAffiliate, useUpdateAffiliate, useDeleteAffiliate } from "@/hooks/useAffiliates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { MoreHorizontal, Plus, Copy, Pencil, Trash2, Power, PowerOff, FlaskConical, Shield, X } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentUserPermissions } from "@/hooks/useUserPermissions";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { AffiliateCountrySelector, CountryBadges } from "@/components/affiliates/AffiliateCountrySelector";

export default function Affiliates() {
  const { data: affiliates, isLoading, error } = useAffiliates();
  const createAffiliate = useCreateAffiliate();
  const updateAffiliate = useUpdateAffiliate();
  const deleteAffiliate = useDeleteAffiliate();
  const { isSuperAdmin } = useAuth();
  const {
    canCreateAffiliates,
    canEditAffiliates,
    canDeleteAffiliates,
    canManageAffiliateIpWhitelist,
  } = useCurrentUserPermissions();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    is_active: true,
    test_mode: false,
    allowed_countries: null as string[] | null,
    callback_url: "",
    ip_whitelist_required: false,
    allowed_ips: [] as string[],
  });
  const [ipInput, setIpInput] = useState("");

  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;

  const handleAddIp = () => {
    const ip = ipInput.trim();
    if (!ip) return;
    if (!ipRegex.test(ip)) { toast.error("Invalid IPv4 address"); return; }
    if (formData.allowed_ips.includes(ip)) { toast.error("IP already added"); return; }
    setFormData({ ...formData, allowed_ips: [...formData.allowed_ips, ip] });
    setIpInput("");
  };

  const handleRemoveIp = (ip: string) => {
    setFormData({ ...formData, allowed_ips: formData.allowed_ips.filter(i => i !== ip) });
  };

  const resetForm = () => {
    setFormData({ name: "", is_active: true, test_mode: false, allowed_countries: null, callback_url: "", ip_whitelist_required: false, allowed_ips: [] });
    setIpInput("");
  };

  const handleCreate = () => {
    createAffiliate.mutate({
      name: formData.name,
      is_active: formData.is_active,
      test_mode: formData.test_mode,
      allowed_countries: formData.allowed_countries,
      callback_url: formData.callback_url || null,
      ip_whitelist_required: formData.ip_whitelist_required,
      allowed_ips: formData.allowed_ips,
    });
    setIsCreateOpen(false);
    resetForm();
  };

  const handleEdit = (affiliate: any) => {
    setSelectedAffiliate(affiliate);
    setFormData({
      name: affiliate.name,
      is_active: affiliate.is_active,
      test_mode: affiliate.test_mode || false,
      allowed_countries: affiliate.allowed_countries,
      callback_url: affiliate.callback_url || "",
      ip_whitelist_required: affiliate.ip_whitelist_required || false,
      allowed_ips: affiliate.allowed_ips || [],
    });
    setIpInput("");
    setIsEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (selectedAffiliate) {
      updateAffiliate.mutate({
        id: selectedAffiliate.id,
        name: formData.name,
        is_active: formData.is_active,
        test_mode: formData.test_mode,
        allowed_countries: formData.allowed_countries,
        callback_url: formData.callback_url || null,
        ip_whitelist_required: formData.ip_whitelist_required,
        allowed_ips: formData.allowed_ips,
      });
      setIsEditOpen(false);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this affiliate?")) {
      deleteAffiliate.mutate(id);
    }
  };

  const handleToggleStatus = (affiliate: any) => {
    const newStatus = !affiliate.is_active;
    updateAffiliate.mutate({
      id: affiliate.id,
      is_active: newStatus,
    });
    toast.success(`Affiliate ${newStatus ? 'activated' : 'deactivated'}`);
  };

  const copyApiKey = async (apiKey: string, e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(apiKey);
      toast.success("API key copied to clipboard");
    } catch {
      // Fallback for browsers that block clipboard API
      const el = document.createElement("textarea");
      el.value = apiKey;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      toast.success("API key copied to clipboard");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Affiliates</h1>
            <p className="text-muted-foreground">
              Manage affiliate partners and their API keys
            </p>
          </div>
          {isSuperAdmin && (
            <Button onClick={() => setIsCreateOpen(true)} className="self-start sm:self-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Affiliate
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <p className="text-center text-muted-foreground py-8">
                Failed to load affiliates. Please try again.
              </p>
            ) : affiliates?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No affiliates found. Create your first affiliate to get started.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>API Key</TableHead>
                      <TableHead>Callback URL</TableHead>
                      <TableHead>Allowed Countries</TableHead>
                      <TableHead>Test Mode</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {affiliates?.map((affiliate) => (
                      <TableRow key={affiliate.id}>
                        <TableCell className="font-medium">
                          {affiliate.name}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {affiliate.api_key.substring(0, 8)}...
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => copyApiKey(affiliate.api_key, e)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {affiliate.callback_url ? (
                            <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate block" title={affiliate.callback_url}>
                              {affiliate.callback_url.length > 30 
                                ? affiliate.callback_url.substring(0, 30) + '...' 
                                : affiliate.callback_url}
                            </code>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not configured</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <CountryBadges countries={affiliate.allowed_countries} />
                        </TableCell>
                        <TableCell>
                          {affiliate.test_mode ? (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                              <FlaskConical className="h-3 w-3 mr-1" />
                              Test Mode
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={affiliate.is_active}
                              onCheckedChange={() => handleToggleStatus(affiliate)}
                              disabled={!isSuperAdmin}
                            />
                            <span className={`text-sm ${affiliate.is_active ? 'text-green-600' : 'text-muted-foreground'}`}>
                              {affiliate.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(affiliate.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          {isSuperAdmin && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleToggleStatus(affiliate)}>
                                  {affiliate.is_active ? (
                                    <>
                                      <PowerOff className="h-4 w-4 mr-2" />
                                      Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <Power className="h-4 w-4 mr-2" />
                                      Activate
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(affiliate)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(affiliate.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Affiliate</DialogTitle>
              <DialogDescription>
                Create a new affiliate partner. An API key will be generated automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="Affiliate name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Allowed Countries</Label>
                <AffiliateCountrySelector
                  selected={formData.allowed_countries}
                  onChange={(countries) => setFormData({ ...formData, allowed_countries: countries })}
                />
                <p className="text-xs text-muted-foreground">
                  Which countries this affiliate can send leads from
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
                <Label>Active</Label>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.test_mode}
                    onCheckedChange={(v) => setFormData({ ...formData, test_mode: v })}
                  />
                  <Label>Test Mode</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Routes all leads to Mock Advertiser for integration testing
                </p>
              </div>
              <div className="space-y-2">
                <Label>Callback URL</Label>
                <Input
                  placeholder="https://your-endpoint.com/callback"
                  value={formData.callback_url}
                  onChange={(e) => setFormData({ ...formData, callback_url: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Autologin URLs will be sent here after successful distribution
                </p>
              </div>
              {canManageAffiliateIpWhitelist && (
                <div className="space-y-3 border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <Label>IP Whitelist Required</Label>
                    </div>
                    <Switch
                      checked={formData.ip_whitelist_required}
                      onCheckedChange={(v) => setFormData({ ...formData, ip_whitelist_required: v })}
                    />
                  </div>
                  {formData.ip_whitelist_required && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Only listed IPs can submit leads for this affiliate.</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g. 192.168.1.1"
                          value={ipInput}
                          onChange={(e) => setIpInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddIp())}
                          className="text-xs"
                        />
                        <Button type="button" variant="outline" size="sm" onClick={handleAddIp}>Add</Button>
                      </div>
                      {formData.allowed_ips.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {formData.allowed_ips.map(ip => (
                            <Badge key={ip} variant="secondary" className="gap-1 text-xs">
                              {ip}
                              <button onClick={() => handleRemoveIp(ip)} className="hover:text-destructive">
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!formData.name || createAffiliate.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Affiliate</DialogTitle>
              <DialogDescription>
                Update affiliate information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="Affiliate name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Allowed Countries</Label>
                <AffiliateCountrySelector
                  selected={formData.allowed_countries}
                  onChange={(countries) => setFormData({ ...formData, allowed_countries: countries })}
                />
                <p className="text-xs text-muted-foreground">
                  Which countries this affiliate can send leads from
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
                <Label>Active</Label>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.test_mode}
                    onCheckedChange={(v) => setFormData({ ...formData, test_mode: v })}
                  />
                  <Label>Test Mode</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Routes all leads to Mock Advertiser for integration testing
                </p>
              </div>
              <div className="space-y-2">
                <Label>Callback URL</Label>
                <Input
                  placeholder="https://your-endpoint.com/callback"
                  value={formData.callback_url}
                  onChange={(e) => setFormData({ ...formData, callback_url: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Autologin URLs will be sent here after successful distribution
                </p>
              </div>
              {canManageAffiliateIpWhitelist && (
                <div className="space-y-3 border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <Label>IP Whitelist Required</Label>
                    </div>
                    <Switch
                      checked={formData.ip_whitelist_required}
                      onCheckedChange={(v) => setFormData({ ...formData, ip_whitelist_required: v })}
                    />
                  </div>
                  {formData.ip_whitelist_required && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Only listed IPs can submit leads for this affiliate.</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g. 192.168.1.1"
                          value={ipInput}
                          onChange={(e) => setIpInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddIp())}
                          className="text-xs"
                        />
                        <Button type="button" variant="outline" size="sm" onClick={handleAddIp}>Add</Button>
                      </div>
                      {formData.allowed_ips.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {formData.allowed_ips.map(ip => (
                            <Badge key={ip} variant="secondary" className="gap-1 text-xs">
                              {ip}
                              <button onClick={() => handleRemoveIp(ip)} className="hover:text-destructive">
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={!formData.name || updateAffiliate.isPending}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}