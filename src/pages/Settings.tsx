import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import {
  Tag, Table2, Bell, Palette, Users, Zap, Globe, Shield, AlertTriangle, ChevronRight, Ban,
} from "lucide-react";

const GENERAL_SECTIONS = [
  {
    key: "general",
    title: "General Settings",
    description: "Platform name, timezone, and basic configuration",
    icon: Tag,
    iconBg: "bg-blue-500",
  },
  {
    key: "table",
    title: "Table Settings",
    description: "Records per page, date format, and display options",
    icon: Table2,
    iconBg: "bg-indigo-500",
  },
  {
    key: "realtime",
    title: "Real-time",
    description: "Automatic data refresh behaviour",
    icon: Bell,
    iconBg: "bg-green-500",
  },
  {
    key: "display",
    title: "Display Preferences",
    description: "Theme and appearance (per-browser)",
    icon: Palette,
    iconBg: "bg-purple-500",
  },
];

const ADMIN_SECTIONS = [
  {
    key: "leads",
    title: "Lead Management",
    description: "Duplicate detection and lead intake rules",
    icon: Users,
    iconBg: "bg-orange-500",
  },
  {
    key: "distribution",
    title: "Distribution",
    description: "Global kill switch and distribution controls",
    icon: Zap,
    iconBg: "bg-yellow-500",
  },
  {
    key: "affiliates",
    title: "Affiliates",
    description: "Affiliate onboarding and default status",
    icon: Globe,
    iconBg: "bg-cyan-500",
  },
  {
    key: "security",
    title: "Users & Security",
    description: "Login policies and session timeout",
    icon: Shield,
    iconBg: "bg-red-500",
  },
  {
    key: "system",
    title: "System",
    description: "Maintenance mode and audit log retention",
    icon: AlertTriangle,
    iconBg: "bg-amber-500",
  },
  {
    key: "countries",
    title: "Restricted Countries",
    description: "Countries hidden from all dropdowns and selectors CRM-wide",
    icon: Ban,
    iconBg: "bg-rose-600",
  },
];

function SettingsCard({ section }: { section: typeof GENERAL_SECTIONS[0] }) {
  const Icon = section.icon;
  return (
    <Link to={`/settings/${section.key}`}>
      <Card className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group h-full">
        <CardContent className="p-6 h-full">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${section.iconBg} shrink-0`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-base leading-tight">{section.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-snug">{section.description}</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function Settings() {
  const { isSuperAdmin, isManager } = useAuth();

  if (!isSuperAdmin && !isManager) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <p className="text-muted-foreground">You don't have permission to access settings.</p>
        </div>
      </DashboardLayout>
    );
  }

  const sections = isSuperAdmin
    ? [...GENERAL_SECTIONS, ...ADMIN_SECTIONS]
    : GENERAL_SECTIONS;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage platform settings and preferences</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map(section => (
            <SettingsCard key={section.key} section={section} />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
