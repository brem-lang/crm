import { Link, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { useRejectedLeadsUnseenCount } from "@/hooks/useRejectedLeads";
import { Badge } from "@/components/ui/badge";
import { getTimezoneLabel, getTimezoneAbbreviation } from "@/lib/timezones";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Building2,
  Send,
  Sliders,
  XCircle,
  TestTube2,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  FileText,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Globe,
  UsersRound,
  PanelLeftClose,
  PanelLeft,
  Activity,
  Syringe,
  Box,
  Clock,
  ScrollText,
  GitMerge,
  Sun,
  Moon,
  Network,
  ShieldCheck,
  MessageCircle,
  Plug,
  Layers,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
  customRoles?: string[];
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Leads", href: "/leads", icon: Users },
  {
    title: "Affiliates",
    href: "/affiliates",
    icon: UserPlus,
    roles: ["super_admin", "manager"],
    customRoles: ["Admin"],
    children: [
      { title: "Performance", href: "/affiliate-performance", icon: TrendingUp, roles: ["super_admin", "manager"], customRoles: ["Admin"] },
    ]
  },
  {
    title: "Advertisers",
    href: "/advertisers",
    icon: Building2,
    roles: ["super_admin", "manager"],
    customRoles: ["Admin"],
    children: [
      { title: "Performance", href: "/advertiser-performance", icon: TrendingUp, roles: ["super_admin", "manager"], customRoles: ["Admin"] },
    ]
  },
  {
    title: "Distribution",
    href: "/advertiser-config",
    icon: Network,
    roles: ["super_admin", "manager"],
    customRoles: ["Admin"],
    children: [
      { title: "Advertiser Config", href: "/advertiser-config", icon: Sliders, roles: ["super_admin", "manager"], customRoles: ["Admin"] },
      { title: "Distribution Rules", href: "/distribution-rules", icon: GitMerge, roles: ["super_admin", "manager"], customRoles: ["Admin"] },
      { title: "History", href: "/distributions", icon: Send, roles: ["super_admin", "manager"], customRoles: ["Admin"] },
    ],
  },
  {
    title: "Rejected Leads",
    href: "/rejected-leads",
    icon: XCircle,
    roles: ["super_admin", "manager"],
    customRoles: ["Admin"],
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
    roles: ["super_admin", "manager"],
    customRoles: ["Admin"],
    children: [
      { title: "Conversions", href: "/conversions", icon: DollarSign, roles: ["super_admin", "manager"], customRoles: ["Admin"] },
      { title: "Country Performance", href: "/country-performance", icon: Globe, roles: ["super_admin", "manager"], customRoles: ["Admin"] },

    ]
  },
  { title: "API Docs", href: "/api-docs", icon: FileText },
  {
    title: "Support Chat",
    href: "/agent/dashboard",
    icon: MessageCircle,
    roles: ["manager", "agent"],
    customRoles: ["Chat Support"],
    children: [
      { title: "Chat Sessions", href: "/chat-sessions", icon: MessageCircle, roles: ["super_admin", "manager"], customRoles: ["Admin"] },
    ],
  },
  {
    title: "Injections",
    href: "/injections",
    icon: Syringe,
    roles: ["super_admin", "manager"],
    customRoles: ["Admin"],
    children: [
      { title: "Injection Jobs", href: "/injections/jobs", icon: Syringe, roles: ["super_admin", "manager"], customRoles: ["Admin"] },
      { title: "Lead Pools", href: "/lead-pools", icon: Box, roles: ["super_admin", "manager"], customRoles: ["Admin"] },
      { title: "All Injection Leads", href: "/injections/leads", icon: Users, roles: ["super_admin", "manager"], customRoles: ["Admin"] },
      { title: "Send History", href: "/injections/send-history", icon: Clock, roles: ["super_admin", "manager"], customRoles: ["Admin"] },
      { title: "Failed Leads", href: "/injections/failed", icon: XCircle, roles: ["super_admin", "manager"], customRoles: ["Admin"] },
    ]
  },
  { title: "Monitoring", href: "/monitoring", icon: Activity, roles: ["super_admin"], customRoles: ["Admin"] },
  {
    title: "Logs",
    href: "/affiliate-api-logs",
    icon: Layers,
    roles: ["super_admin", "manager"],
    customRoles: ["Admin"],
    children: [
      { title: "Affiliate API Logs", href: "/affiliate-api-logs", icon: ShieldCheck, roles: ["super_admin", "manager"], customRoles: ["Admin"] },
      { title: "Test Logs", href: "/test-logs", icon: TestTube2, roles: ["super_admin", "manager"], customRoles: ["Admin"] },
      // Hidden for now — every logged callback fails due to a misconfigured
      // affiliate callback_url pointing at our own API instead of a real
      // webhook. Route/page still work directly; just not linked in the nav.
      // { title: "Callback Logs", href: "/logs/callback-logs", icon: Radio, roles: ["super_admin", "manager"], customRoles: ["Admin"] },
      { title: "Audit Logs", href: "/audit-logs", icon: ScrollText, roles: ["super_admin"], customRoles: ["Admin"] },
    ]
  },
  { title: "Users", href: "/users", icon: UsersRound, roles: ["super_admin"], customRoles: ["Admin"] },
  { title: "Roles & Permissions", href: "/roles", icon: ShieldCheck, roles: ["super_admin"], customRoles: ["Admin"] },
  { title: "CRM Integrations", href: "/crm-settings", icon: Plug, roles: ["super_admin"] },
  { title: "Settings", href: "/settings", icon: Settings, roles: ["super_admin"], customRoles: ["Admin"] },
];

export function Sidebar() {
  const location = useLocation();
  const { signOut, roles, customRoleNames, user, username, isChatSupport } = useAuth();
  const { isCollapsed, toggleCollapsed } = useSidebarState();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { formatDate, crmName, timezone } = useCRMSettings();
  const timezoneLabel = getTimezoneLabel(timezone);
  const crmInitials = crmName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const timezoneAbbr = getTimezoneAbbreviation(timezone, currentTime);
  const { data: rejectedLeadsUnseenCount = 0 } = useRejectedLeadsUnseenCount();

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hasAccess = (item: NavItem) => {
    // chat_support users only see items that explicitly list them
    if (isChatSupport && roles.length === 0) {
      return item.customRoles?.some((name) => customRoleNames.includes(name)) ?? false;
    }
    const noRestrictions = !item.roles && !item.customRoles;
    if (noRestrictions) return true;
    const systemMatch = item.roles?.some((role) => roles.includes(role as any)) ?? false;
    const customMatch = item.customRoles?.some((name) => customRoleNames.includes(name)) ?? false;
    return systemMatch || customMatch;
  };

  const filteredNavItems = navItems.filter(hasAccess);

  const isChildActive = (item: NavItem) => {
    if (!item.children) return false;
    return item.children.some(child => location.pathname === child.href);
  };

  // Auto-expand menu when child is active
  useEffect(() => {
    navItems.forEach(item => {
      if (item.children && isChildActive(item) && !openMenus.includes(item.href)) {
        setOpenMenus(prev => [...prev, item.href]);
      }
    });
  }, [location.pathname]);

  const toggleMenu = (href: string) => {
    setOpenMenus(prev => 
      prev.includes(href) 
        ? prev.filter(h => h !== href)
        : [...prev, href]
    );
  };

  const navContent = (
    <>
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-bold text-sm">{crmInitials}</span>
            </div>
            {!isCollapsed && <span className="font-semibold text-lg">{crmName}</span>}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={toggleCollapsed}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
        {!isCollapsed && (
          <div className="mt-2 text-xs text-muted-foreground font-mono">
            <div>{formatDate(currentTime)}</div>
            <div className="truncate" title={timezoneLabel}>{timezoneAbbr}</div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const hasChildren = item.children && item.children.length > 0;
          const isActive = !hasChildren && location.pathname === item.href;
          const isOpen = openMenus.includes(item.href);

          if (hasChildren && !isCollapsed) {
            return (
              <div key={item.href} className="space-y-1">
                <div className="flex items-center">
                  <Link
                    to={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      "flex-1 flex items-center gap-3 rounded-l-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {item.title}
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMenu(item.href)}
                    className={cn(
                      "h-9 w-9 p-0 rounded-l-none",
                      isActive ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground"
                    )}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {isOpen && (
                  <div className="pl-4 space-y-1">
                    {item.children?.filter(hasAccess).map((child) => {
                      const isChildActiveNow = location.pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          to={child.href}
                          onClick={() => setIsMobileOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            isChildActiveNow
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <child.icon className="h-4 w-4 flex-shrink-0" />
                          {child.title}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const isRejectedLeadsItem = item.href === "/rejected-leads";

          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setIsMobileOpen(false)}
              title={isCollapsed ? item.title : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                isCollapsed && "justify-center px-2"
              )}
            >
              <span className="relative flex-shrink-0">
                <item.icon className="h-4 w-4" />
                {isRejectedLeadsItem && isCollapsed && rejectedLeadsUnseenCount > 0 && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </span>
              {!isCollapsed && (
                <span className="flex flex-1 items-center justify-between gap-2">
                  {item.title}
                  {isRejectedLeadsItem && (
                    <Badge
                      variant={rejectedLeadsUnseenCount > 0 ? "destructive" : "secondary"}
                      className="h-5 min-w-5 justify-center px-1 text-xs"
                    >
                      {rejectedLeadsUnseenCount > 99 ? "99+" : rejectedLeadsUnseenCount}
                    </Badge>
                  )}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-2">
        {!isCollapsed && (
          <div className="mb-4 px-3">
            <p className="text-sm font-medium truncate">{username || user?.email}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {[
                ...roles.map(r => r.replace(/_/g, ' ')),
                ...customRoleNames,
              ].join(", ") || "No role assigned"}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          className={cn("w-full gap-3", isCollapsed ? "justify-center px-2" : "justify-start")}
          onClick={() => setTheme(isDark ? "light" : "dark")}
          title={isCollapsed ? (isDark ? "Switch to Light Mode" : "Switch to Dark Mode") : undefined}
        >
          {isDark ? <Sun className="h-4 w-4 flex-shrink-0" /> : <Moon className="h-4 w-4 flex-shrink-0" />}
          {!isCollapsed && (isDark ? "Light Mode" : "Dark Mode")}
        </Button>
        <Button
          variant="ghost"
          className={cn("w-full gap-3", isCollapsed ? "justify-center px-2" : "justify-start")}
          onClick={signOut}
          title={isCollapsed ? "Sign Out" : undefined}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!isCollapsed && "Sign Out"}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="outline"
        size="icon"
        className={cn("fixed top-3 left-3 z-50 lg:hidden bg-background shadow-sm", isMobileOpen && "hidden")}
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-card transition-all duration-300 lg:translate-x-0",
          isCollapsed ? "w-16" : "w-64",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
