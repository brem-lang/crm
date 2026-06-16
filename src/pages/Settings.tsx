import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useSystemSettings, useUpdateSystemSettings, SystemSettings } from "@/hooks/useSystemSettings";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import {
  Tag, Table, Bell, Palette, Globe, Zap, Users,
  Shield, AlertTriangle, Sun, Moon, Monitor, Lock,
} from "lucide-react";

const TIMEZONES = [
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
  { value: "Europe/Moscow", label: "Moscow (MSK)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
  { value: "Pacific/Auckland", label: "Auckland (NZST/NZDT)" },
  { value: "America/New_York", label: "New York (EST/EDT)" },
  { value: "America/Chicago", label: "Chicago (CST/CDT)" },
  { value: "America/Denver", label: "Denver (MST/MDT)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST/PDT)" },
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
];

type SettingsField = Partial<Omit<SystemSettings, "id" | "updated_at" | "updated_by">>;

function SwitchRow({ label, description, checked, onCheckedChange, disabled }: {
  label: string; description?: string; checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label>{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

export default function Settings() {
  const { isSuperAdmin, isManager } = useAuth();
  const { isCollapsed } = useSidebarState();
  const { data: dbSettings, isLoading } = useSystemSettings();
  const { mutate: updateSettings, isPending: isSaving } = useUpdateSystemSettings();
  const { theme, setTheme } = useTheme();

  const [draft, setDraft] = useState<SettingsField>({});

  useEffect(() => {
    if (dbSettings) setDraft({});
  }, [dbSettings]);

  if (!isSuperAdmin && !isManager) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <p className="text-muted-foreground">You don't have permission to access settings.</p>
        </div>
      </DashboardLayout>
    );
  }

  const get = <K extends keyof SettingsField>(key: K): SystemSettings[K] =>
    (key in draft ? (draft as SystemSettings)[key] : (dbSettings as SystemSettings)?.[key]);

  const set = <K extends keyof SettingsField>(key: K, value: SystemSettings[K]) =>
    setDraft(prev => ({ ...prev, [key]: value }));

  const hasChanges = Object.keys(draft).length > 0;

  const handleSave = () => {
    updateSettings(draft, { onSuccess: () => setDraft({}) });
  };

  const handleReset = () => {
    setDraft({});
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure CRM preferences and system behaviour</p>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground text-sm">Loading settings…</div>
        ) : (
          <>
            {/* ── Branding ───────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" />Branding</CardTitle>
                <CardDescription>Customize the CRM name shown in the sidebar and browser tab</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>CRM Name</Label>
                  <Input
                    value={get("crm_name") ?? ""}
                    onChange={e => set("crm_name", e.target.value)}
                    className="w-full sm:w-[300px]"
                    maxLength={30}
                    disabled={!isSuperAdmin}
                  />
                  <p className="text-xs text-muted-foreground">Appears in the sidebar and browser tab title</p>
                </div>
              </CardContent>
            </Card>

            {/* ── Table & Pagination ─────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Table className="h-5 w-5" />Table Settings</CardTitle>
                <CardDescription>Configure how data tables display across the CRM</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Default Records Per Page</Label>
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      value={get("default_page_size") ?? 25}
                      onChange={e => set("default_page_size", Math.min(1000, Math.max(1, parseInt(e.target.value) || 25)))}
                      className="w-full sm:w-[150px]"
                      disabled={!isSuperAdmin}
                    />
                    <p className="text-xs text-muted-foreground">Enter any number from 1 to 1000</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Date Format</Label>
                    <Select value={get("date_format") ?? "yyyy-MM-dd HH:mm:ss"} onValueChange={v => set("date_format", v)} disabled={!isSuperAdmin}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yyyy-MM-dd HH:mm:ss">2026-01-29 14:30:45</SelectItem>
                        <SelectItem value="yyyy-MM-dd HH:mm">2026-01-29 14:30</SelectItem>
                        <SelectItem value="MMM d, yyyy HH:mm">Jan 29, 2026 14:30</SelectItem>
                        <SelectItem value="dd/MM/yyyy HH:mm:ss">29/01/2026 14:30:45</SelectItem>
                        <SelectItem value="MM/dd/yyyy HH:mm:ss">01/29/2026 14:30:45</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">How dates are displayed throughout the CRM</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Globe className="h-4 w-4" />Global Timezone</Label>
                  <Select value={get("timezone") ?? "UTC"} onValueChange={v => set("timezone", v)} disabled={!isSuperAdmin}>
                    <SelectTrigger className="w-full sm:w-[300px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map(tz => (
                        <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">All lead timestamps and reports will use this timezone</p>
                </div>

                <div className="space-y-4">
                  <SwitchRow
                    label="Show Lead ID Column"
                    description="Display the Lead ID column in tables by default"
                    checked={get("show_lead_id") ?? true}
                    onCheckedChange={v => set("show_lead_id", v)}
                    disabled={!isSuperAdmin}
                  />
                  <SwitchRow
                    label="Compact Mode"
                    description="Reduce spacing in tables to show more data"
                    checked={get("compact_mode") ?? false}
                    onCheckedChange={v => set("compact_mode", v)}
                    disabled={!isSuperAdmin}
                  />
                </div>
              </CardContent>
            </Card>

            {/* ── Real-time ──────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Real-time Settings</CardTitle>
                <CardDescription>Configure automatic data refresh behaviour</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Auto-Refresh Interval</Label>
                  <Select value={String(get("auto_refresh_interval") ?? 0)} onValueChange={v => set("auto_refresh_interval", Number(v))} disabled={!isSuperAdmin}>
                    <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Disabled (Manual only)</SelectItem>
                      <SelectItem value="30">Every 30 seconds</SelectItem>
                      <SelectItem value="60">Every 1 minute</SelectItem>
                      <SelectItem value="300">Every 5 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">How often to automatically refresh data.</p>
                </div>
              </CardContent>
            </Card>

            {/* ── Display ────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" />Display Preferences</CardTitle>
                <CardDescription>Customize the appearance of the CRM (per-browser, not system-wide)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button variant={theme === "light" ? "default" : "outline"} size="sm" onClick={() => setTheme("light")}>
                    <Sun className="h-4 w-4 mr-1" />Light
                  </Button>
                  <Button variant={theme === "dark" ? "default" : "outline"} size="sm" onClick={() => setTheme("dark")}>
                    <Moon className="h-4 w-4 mr-1" />Dark
                  </Button>
                  <Button variant={theme === "system" ? "default" : "outline"} size="sm" onClick={() => setTheme("system")}>
                    <Monitor className="h-4 w-4 mr-1" />System
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ── Super admin only below ─────────────────────────── */}
            {isSuperAdmin && (
              <>
                {/* ── Lead Management ──────────────────────────────── */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" />Lead Management</CardTitle>
                    <CardDescription>Control duplicate detection and lead intake rules</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <SwitchRow
                      label="Enable Duplicate Detection"
                      description="Reject leads that match an existing lead within the configured window"
                      checked={get("duplicate_detection_enabled") ?? false}
                      onCheckedChange={v => set("duplicate_detection_enabled", v)}
                    />
                    {get("duplicate_detection_enabled") && (
                      <div className="grid gap-4 sm:grid-cols-2 pl-4 border-l-2 border-muted">
                        <div className="space-y-2">
                          <Label>Detection Window (days)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={365}
                            value={get("duplicate_window_days") ?? 30}
                            onChange={e => set("duplicate_window_days", Math.min(365, Math.max(1, parseInt(e.target.value) || 30)))}
                            className="w-[120px]"
                          />
                          <p className="text-xs text-muted-foreground">Look back this many days for duplicates</p>
                        </div>
                        <div className="space-y-2">
                          <Label>Match By</Label>
                          <Select value={get("duplicate_match_field") ?? "email"} onValueChange={v => set("duplicate_match_field", v)}>
                            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="email">Email only</SelectItem>
                              <SelectItem value="phone">Phone only</SelectItem>
                              <SelectItem value="both">Email OR Phone</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* ── Distribution ─────────────────────────────────── */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" />Distribution</CardTitle>
                    <CardDescription>Global controls for lead distribution across all advertisers</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-sm">Global Distribution Kill Switch</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            When OFF, all distribution is paused system-wide. Leads are still stored but not sent to any advertiser.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={get("distribution_enabled") ?? true ? "default" : "destructive"}>
                            {get("distribution_enabled") ?? true ? "ON" : "OFF"}
                          </Badge>
                          <Switch
                            checked={get("distribution_enabled") ?? true}
                            onCheckedChange={v => set("distribution_enabled", v)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Default Daily Cap Fallback</Label>
                      <Input
                        type="number"
                        min={0}
                        value={get("default_daily_cap") ?? 0}
                        onChange={e => set("default_daily_cap", Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-[150px]"
                      />
                      <p className="text-xs text-muted-foreground">
                        Used when an advertiser has no daily cap configured. 0 = unlimited.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* ── Affiliates ───────────────────────────────────── */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />Affiliates</CardTitle>
                    <CardDescription>Control how affiliates are onboarded and behave by default</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <SwitchRow
                      label="Allow Affiliate Self-Registration"
                      description="Affiliates can sign up themselves via the registration page"
                      checked={get("affiliate_self_registration") ?? false}
                      onCheckedChange={v => set("affiliate_self_registration", v)}
                    />
                    <div className="space-y-2 pt-2 border-t">
                      <Label>Default Affiliate Status on Creation</Label>
                      <Select value={get("affiliate_default_status") ?? "active"} onValueChange={v => set("affiliate_default_status", v)}>
                        <SelectTrigger className="w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active — can submit leads immediately</SelectItem>
                          <SelectItem value="inactive">Inactive — must be manually activated</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Status applied when a new affiliate account is created</p>
                    </div>
                  </CardContent>
                </Card>

                {/* ── Users & Security ─────────────────────────────── */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Users & Security</CardTitle>
                    <CardDescription>Login policies and session controls</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <SwitchRow
                      label="Allow User Self-Registration"
                      description="Users can create their own accounts via the registration page"
                      checked={get("user_self_registration") ?? false}
                      onCheckedChange={v => set("user_self_registration", v)}
                    />
                    <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t">
                      <div className="space-y-2">
                        <Label>Max Failed Login Attempts</Label>
                        <Input
                          type="number"
                          min={0}
                          value={get("max_login_attempts") ?? 0}
                          onChange={e => set("max_login_attempts", Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-[120px]"
                        />
                        <p className="text-xs text-muted-foreground">0 = unlimited (no lockout)</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Session Idle Timeout (minutes)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={get("session_timeout_minutes") ?? 0}
                          onChange={e => set("session_timeout_minutes", Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-[120px]"
                        />
                        <p className="text-xs text-muted-foreground">0 = never expires</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* ── System ───────────────────────────────────────── */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      System
                    </CardTitle>
                    <CardDescription>Maintenance mode and audit log retention</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-sm">Maintenance Mode</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            When ON, a banner is shown to all non-admin users. Super admins are unaffected.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={get("maintenance_mode") ? "destructive" : "outline"}>
                            {get("maintenance_mode") ? "ACTIVE" : "OFF"}
                          </Badge>
                          <Switch
                            checked={get("maintenance_mode") ?? false}
                            onCheckedChange={v => set("maintenance_mode", v)}
                          />
                        </div>
                      </div>
                      {get("maintenance_mode") && (
                        <div className="space-y-2">
                          <Label>Banner Message</Label>
                          <Textarea
                            value={get("maintenance_message") ?? ""}
                            onChange={e => set("maintenance_message", e.target.value)}
                            rows={2}
                            maxLength={500}
                            placeholder="System is under maintenance. Please check back later."
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Audit Log Retention (days)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={get("audit_log_retention_days") ?? 0}
                        onChange={e => set("audit_log_retention_days", Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-[150px]"
                      />
                      <p className="text-xs text-muted-foreground">0 = keep forever. Purging requires a scheduled job.</p>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

          </>
        )}
      </div>

      {/* Fixed save bar */}
      {isSuperAdmin && (
        <div className={`fixed bottom-0 right-0 z-50 border-t bg-background px-4 py-3 flex items-center justify-end gap-2 shadow-md transition-all duration-300 ${isCollapsed ? "lg:left-16" : "lg:left-64"} left-0`}>
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges || isSaving}>
            Discard Changes
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      )}
    </DashboardLayout>
  );
}
