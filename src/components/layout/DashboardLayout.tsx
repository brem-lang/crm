import { ReactNode, lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { Navigate } from "react-router-dom";
import { Loader2, AlertTriangle, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const Sidebar = lazy(() => import("./Sidebar").then(m => ({ default: m.Sidebar })));
const ChatWidget = lazy(() => import("@/components/chat/ChatWidget").then(m => ({ default: m.ChatWidget })));

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, loading, isSuperAdmin, isChatSupport, isImpersonating, endImpersonation, username } = useAuth();
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

  if (isChatSupport) {
    return <Navigate to="/agent/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      {isImpersonating && (
        <div className={cn(
          "fixed top-0 z-50 w-full bg-orange-500 text-white px-4 py-2 flex items-center justify-between gap-2 text-sm font-medium",
          isCollapsed ? "lg:pl-16" : "lg:pl-64"
        )}>
          <div className="flex items-center gap-2">
            <UserX className="h-4 w-4 shrink-0" />
            <span>You are viewing as <strong>{username || user?.email}</strong></span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs bg-white text-orange-600 hover:bg-orange-50 border-0"
            onClick={endImpersonation}
          >
            End Impersonation
          </Button>
        </div>
      )}
      {showMaintenanceBanner && (
        <div className={cn(
          "fixed z-40 w-full bg-amber-500 text-amber-950 px-4 py-2 flex items-center gap-2 text-sm font-medium",
          isImpersonating ? "top-10" : "top-0",
          isCollapsed ? "lg:pl-16" : "lg:pl-64"
        )}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{systemSettings?.maintenance_message || "System is under maintenance."}</span>
        </div>
      )}
      <main className={cn("transition-all duration-300", isCollapsed ? "lg:pl-16" : "lg:pl-64")}>
        <div className={cn(
          "px-4 pb-6 sm:px-6 lg:px-8",
          isImpersonating && showMaintenanceBanner ? "pt-32 lg:pt-24" :
          isImpersonating ? "pt-24 lg:pt-16" :
          showMaintenanceBanner ? "pt-24 lg:pt-16" : "pt-16 lg:pt-8"
        )}>
          {children}
        </div>
      </main>
      <Suspense fallback={null}>
        <ChatWidget />
      </Suspense>
    </div>
  );
}