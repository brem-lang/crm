import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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
import {
  Tag, Table2, Bell, Palette, Users, Zap, Globe, Shield, AlertTriangle,
  ChevronLeft, Sun, Moon, Monitor, Ban,
} from "lucide-react";
import { MultiSelect } from "@/components/ui/multi-select";
import { getCountryList } from "@/components/advertisers/countryData";

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

const SECTION_META: Record<string, { title: string; description: string; icon: React.ElementType; iconBg: string; adminOnly?: boolean }> = {
  general:      { title: "General Settings",    description: "Platform name, timezone, and basic configuration",       icon: Tag,           iconBg: "bg-blue-500"   },
  table:        { title: "Table Settings",       description: "Records per page, date format, and display options",     icon: Table2,        iconBg: "bg-indigo-500" },
  realtime:     { title: "Real-time",            description: "Automatic data refresh behaviour",                       icon: Bell,          iconBg: "bg-green-500"  },
  display:      { title: "Display Preferences",  description: "Theme and appearance (per-browser)",                     icon: Palette,       iconBg: "bg-purple-500" },
  leads:        { title: "Lead Management",      description: "Duplicate detection and lead intake rules",              icon: Users,         iconBg: "bg-orange-500", adminOnly: true },
  distribution: { title: "Distribution",         description: "Global kill switch and distribution controls",           icon: Zap,           iconBg: "bg-yellow-500", adminOnly: true },
  affiliates:   { title: "Affiliates",           description: "Affiliate onboarding and default status",                icon: Globe,         iconBg: "bg-cyan-500",   adminOnly: true },
  security:     { title: "Users & Security",     description: "Login policies and session timeout",                     icon: Shield,        iconBg: "bg-red-500",    adminOnly: true },
  system:       { title: "System",               description: "Maintenance mode and audit log retention",               icon: AlertTriangle, iconBg: "bg-amber-500",  adminOnly: true },
  countries:    { title: "Restricted Countries",  description: "Countries hidden from all dropdowns CRM-wide",           icon: Ban,           iconBg: "bg-rose-600",   adminOnly: true },
};

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

const COUNTRY_OPTIONS = getCountryList().map(c => ({
  value: c.code,
  label: `${c.code} – ${c.name}`,
  badgeLabel: c.code,
}));

function RestrictedCountriesForm({
  current,
  onChange,
}: {
  current: string[];
  onChange: (codes: string[]) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Restricted Countries</Label>
        <p className="text-xs text-muted-foreground mt-1">
          These countries are hidden from all country pickers CRM-wide. Existing lead data is unaffected.
        </p>
      </div>
      <MultiSelect
        options={COUNTRY_OPTIONS}
        selected={current}
        onChange={onChange}
        placeholder="Select countries to restrict…"
        searchPlaceholder="Search country or code…"
        emptyMessage="No countries found."
        showBadges
        className="w-full"
      />
      {current.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {current.length} {current.length === 1 ? "country" : "countries"} restricted
        </p>
      )}
    </div>
  );
}

export default function SettingsSection() {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();
  const { isSuperAdmin, isManager } = useAuth();
  const { isCollapsed } = useSidebarState();
  const { data: dbSettings, isLoading } = useSystemSettings();
  const { mutate: updateSettings, isPending: isSaving } = useUpdateSystemSettings();
  const { theme, setTheme } = useTheme();

  const [draft, setDraft] = useState<SettingsField>({});

  useEffect(() => {
    if (dbSettings) setDraft({});
  }, [dbSettings]);

  const meta = section ? SECTION_META[section] : null;

  // Redirect unknown sections or unauthorized access
  if (!isSuperAdmin && !isManager) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <p className="text-muted-foreground">You don't have permission to access settings.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!meta || (meta.adminOnly && !isSuperAdmin)) {
    navigate("/settings", { replace: true });
    return null;
  }

  const get = <K extends keyof SettingsField>(key: K): SystemSettings[K] =>
    (key in draft ? (draft as SystemSettings)[key] : (dbSettings as SystemSettings)?.[key]);

  const set = <K extends keyof SettingsField>(key: K, value: SystemSettings[K]) =>
    setDraft(prev => ({ ...prev, [key]: value }));

  const hasChanges = Object.keys(draft).length > 0;

  const handleSave = () => {
    updateSettings(draft, { onSuccess: () => setDraft({}) });
  };

  const handleReset = () => setDraft({});

  const Icon = meta.icon;

  const renderSection = () => {
    if (isLoading) {
      return <div className="text-muted-foreground text-sm py-8">Loading settings…</div>;
    }

    switch (section) {
      case "general":
        return (
          <div className="space-y-2">
            <Label>CRM Name</Label>
            <Input
              value={get("crm_name") ?? ""}
              onChange={e => set("crm_name", e.target.value)}
              className="w-full max-w-sm"
              maxLength={30}
              disabled={!isSuperAdmin}
            />
            <p className="text-xs text-muted-foreground">Appears in the sidebar and browser tab title</p>
          </div>
        );

      case "table":
        return (
          <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Default Records Per Page</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={get("default_page_size") ?? 25}
                  onChange={e => set("default_page_size", Math.min(1000, Math.max(1, parseInt(e.target.value) || 25)))}
                  className="w-full max-w-[180px]"
                  disabled={!isSuperAdmin}
                />
                <p className="text-xs text-muted-foreground">Enter any number from 1 to 1000</p>
              </div>
              <div className="space-y-2">
                <Label>Date Format</Label>
                <Select value={get("date_format") ?? "yyyy-MM-dd HH:mm:ss"} onValueChange={v => set("date_format", v)} disabled={!isSuperAdmin}>
                  <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
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
              <Label>Global Timezone</Label>
              <Select value={get("timezone") ?? "UTC"} onValueChange={v => set("timezone", v)} disabled={!isSuperAdmin}>
                <SelectTrigger className="w-full max-w-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">All lead timestamps and reports will use this timezone</p>
            </div>

            <div className="space-y-4 pt-2 border-t">
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
          </div>
        );

      case "realtime":
        return (
          <div className="space-y-2">
            <Label>Auto-Refresh Interval</Label>
            <Select value={String(get("auto_refresh_interval") ?? 0)} onValueChange={v => set("auto_refresh_interval", Number(v))} disabled={!isSuperAdmin}>
              <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Disabled (Manual only)</SelectItem>
                <SelectItem value="30">Every 30 seconds</SelectItem>
                <SelectItem value="60">Every 1 minute</SelectItem>
                <SelectItem value="300">Every 5 minutes</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">How often to automatically refresh data.</p>
          </div>
        );

      case "display":
        return (
          <div className="space-y-3">
            <Label>Theme</Label>
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
            <p className="text-xs text-muted-foreground">Theme is applied immediately and stored in your browser.</p>
          </div>
        );

      case "leads":
        return (
          <div className="space-y-4">
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
          </div>
        );

      case "distribution":
        return (
          <div className="space-y-6">
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
          </div>
        );

      case "affiliates":
        return (
          <div className="space-y-4">
            <SwitchRow
              label="Allow Affiliate Self-Registration"
              description="Affiliates can sign up themselves via the registration page"
              checked={get("affiliate_self_registration") ?? false}
              onCheckedChange={v => set("affiliate_self_registration", v)}
            />
            <div className="space-y-2 pt-2 border-t">
              <Label>Default Affiliate Status on Creation</Label>
              <Select value={get("affiliate_default_status") ?? "active"} onValueChange={v => set("affiliate_default_status", v)}>
                <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active — can submit leads immediately</SelectItem>
                  <SelectItem value="inactive">Inactive — must be manually activated</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Status applied when a new affiliate account is created</p>
            </div>
          </div>
        );

      case "security":
        return (
          <div className="space-y-6">
            <SwitchRow
              label="Allow User Self-Registration"
              description="Users can create their own accounts via the registration page"
              checked={get("user_self_registration") ?? false}
              onCheckedChange={v => set("user_self_registration", v)}
            />
            <div className="grid gap-6 sm:grid-cols-2 pt-2 border-t">
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
          </div>
        );

      case "system":
        return (
          <div className="space-y-6">
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
          </div>
        );

      case "countries":
        return <RestrictedCountriesForm current={get("restricted_countries") ?? []} onChange={v => set("restricted_countries", v)} />;

      default:
        return null;
    }
  };

  const isDisplaySection = section === "display";

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        {/* Back + header */}
        <div className="space-y-4">
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Settings
          </Link>

          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${meta.iconBg}`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{meta.title}</h1>
              <p className="text-muted-foreground text-sm">{meta.description}</p>
            </div>
          </div>
        </div>

        {/* Form card */}
        <Card className="max-w-2xl">
          <CardContent className="pt-6">
            {renderSection()}
          </CardContent>
        </Card>
      </div>

      {/* Fixed save bar — hidden for display section (theme is immediate) */}
      {!isDisplaySection && (
        <div className={`fixed bottom-0 right-0 z-50 border-t bg-background pl-4 pr-20 py-3 flex items-center justify-end gap-2 shadow-md transition-all duration-300 ${isCollapsed ? "lg:left-16" : "lg:left-64"} left-0`}>
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
