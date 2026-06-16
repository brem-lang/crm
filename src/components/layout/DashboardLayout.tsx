import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { Navigate } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, loading, isSuperAdmin } = useAuth();
  const { isCollapsed } = useSidebarState();
  const { data: systemSettings } = useSystemSettings();
  const showMaintenanceBanner = !isSuperAdmin && systemSettings?.maintenance_mode === true;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      {showMaintenanceBanner && (
        <div className={cn(
          "fixed top-0 z-50 w-full bg-amber-500 text-amber-950 px-4 py-2 flex items-center gap-2 text-sm font-medium",
          isCollapsed ? "lg:pl-16" : "lg:pl-64"
        )}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{systemSettings?.maintenance_message || "System is under maintenance."}</span>
        </div>
      )}
      <main className={cn("transition-all duration-300", isCollapsed ? "lg:pl-16" : "lg:pl-64")}>
        <div className={cn("px-4 pb-6 sm:px-6 lg:px-8", showMaintenanceBanner ? "pt-24 lg:pt-16" : "pt-16 lg:pt-8")}>
          {children}
        </div>
      </main>
    </div>
  );
}