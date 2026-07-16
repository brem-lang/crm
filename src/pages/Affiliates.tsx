import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAffiliates, useCreateAffiliate, useUpdateAffiliate, useDeleteAffiliate } from "@/hooks/useAffiliates";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { usePageSizeState } from "@/hooks/usePageSizeState";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { TablePagination } from "@/components/ui/table-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import { MoreHorizontal, Plus, Copy, Pencil, Trash2, Power, PowerOff, FlaskConical, Shield } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentUserPermissions } from "@/hooks/useUserPermissions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { AffiliateCountrySelector, CountryBadges } from "@/components/affiliates/AffiliateCountrySelector";
import { IpWhitelistManager } from "@/components/affiliates/IpWhitelistManager";

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
  const [deleteAffiliateId, setDeleteAffiliateId] = useState<string | null>(null);
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
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = usePageSizeState();

  const filteredAffiliates = useMemo(() => {
    if (!affiliates) return [];
    if (!search.trim()) return affiliates;
    const q = search.toLowerCase();
    return affiliates.filter(a => a.name.toLowerCase().includes(q));
  }, [affiliates, search]);

  const totalPages = Math.max(1, Math.ceil(filteredAffiliates.length / pageSize));
  const paginatedAffiliates = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAffiliates.slice(start, start + pageSize);
  }, [filteredAffiliates, currentPage, pageSize]);

  const allSelected = paginatedAffiliates.length > 0 && paginatedAffiliates.every(a => selectedIds.has(a.id));
  const someSelected = paginatedAffiliates.some(a => selectedIds.has(a.id)) && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(paginatedAffiliates.map(a => a.id)));
    else setSelectedIds(new Set());
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    checked ? next.add(id) : next.delete(id);
    setSelectedIds(next);
  };

  const resetForm = () => {
    setFormData({ name: "", is_active: true, test_mode: false, allowed_countries: null, callback_url: "", ip_whitelist_required: false, allowed_ips: [] });
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
    setDeleteAffiliateId(id);
  };

  const confirmDelete = () => {
    if (deleteAffiliateId) deleteAffiliate.mutate(deleteAffiliateId);
    setDeleteAffiliateId(null);
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
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">
                {isLoading ? "Loading..." : `${filteredAffiliates.length} affiliate${filteredAffiliates.length !== 1 ? "s" : ""}`}
              </CardTitle>
              <Input
                placeholder="Search affiliates..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-56 h-8 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
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
            ) : filteredAffiliates.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {search ? "No affiliates match your search." : "No affiliates found. Create your first affiliate to get started."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={someSelected ? "indeterminate" : allSelected}
                          onCheckedChange={(c) => handleSelectAll(!!c)}
                        />
                      </TableHead>
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
                    {paginatedAffiliates.map((affiliate) => (
                      <TableRow key={affiliate.id} className={selectedIds.has(affiliate.id) ? "bg-muted/50" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(affiliate.id)}
                            onCheckedChange={(c) => handleSelectOne(affiliate.id, !!c)}
                          />
                        </TableCell>
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
          {filteredAffiliates.length > 0 && (
            <CardFooter className="pt-0">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredAffiliates.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                itemLabel="affiliates"
              />
            </CardFooter>
          )}
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
                      {formData.ip_whitelist_required && formData.allowed_ips.length > 0 && (
                        <Badge variant="secondary">{formData.allowed_ips.length}</Badge>
                      )}
                    </div>
                    <Switch
                      checked={formData.ip_whitelist_required}
                      onCheckedChange={(v) => setFormData({ ...formData, ip_whitelist_required: v })}
                    />
                  </div>
                  {formData.ip_whitelist_required && (
                    <IpWhitelistManager
                      ips={formData.allowed_ips}
                      onChange={(ips) => setFormData({ ...formData, allowed_ips: ips })}
                    />
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
          <DialogContent className="max-h-[90vh] overflow-y-auto">
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
                      {formData.ip_whitelist_required && formData.allowed_ips.length > 0 && (
                        <Badge variant="secondary">{formData.allowed_ips.length}</Badge>
                      )}
                    </div>
                    <Switch
                      checked={formData.ip_whitelist_required}
                      onCheckedChange={(v) => setFormData({ ...formData, ip_whitelist_required: v })}
                    />
                  </div>
                  {formData.ip_whitelist_required && (
                    <IpWhitelistManager
                      ips={formData.allowed_ips}
                      onChange={(ips) => setFormData({ ...formData, allowed_ips: ips })}
                    />
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

        {/* Delete Affiliate Confirmation */}
        <AlertDialog open={!!deleteAffiliateId} onOpenChange={(open) => !open && setDeleteAffiliateId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Affiliate</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this affiliate? All associated API keys and data will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}