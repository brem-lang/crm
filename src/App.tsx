import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { SidebarStateProvider } from "@/hooks/useSidebarState";
import { useCRMSettings } from "@/hooks/useCRMSettings";

const TitleManager = () => {
  const { crmName } = useCRMSettings();
  useEffect(() => {
    document.title = crmName;
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', crmName);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', `${crmName} - Lead Management System`);
    document.querySelector('meta[name="description"]')?.setAttribute('content', `${crmName} - Lead Management System`);
    document.querySelector('meta[name="author"]')?.setAttribute('content', crmName);
  }, [crmName]);
  return null;
};
import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Leads = lazy(() => import("./pages/Leads"));
const Affiliates = lazy(() => import("./pages/Affiliates"));
const AffiliatePerformance = lazy(() => import("./pages/AffiliatePerformance"));
const AffiliateApiLogs = lazy(() => import("./pages/AffiliateApiLogs"));
const Advertisers = lazy(() => import("./pages/Advertisers"));
const AdvertiserPerformance = lazy(() => import("./pages/AdvertiserPerformance"));
const Distributions = lazy(() => import("./pages/Distributions"));
const AdvertiserConfig = lazy(() => import("./pages/AdvertiserConfig"));
const DistributionRules = lazy(() => import("./pages/DistributionRules"));
const RejectedLeads = lazy(() => import("./pages/RejectedLeads"));
const TestLeadLogs = lazy(() => import("./pages/TestLeadLogs"));
const Reports = lazy(() => import("./pages/Reports"));
const Conversions = lazy(() => import("./pages/Conversions"));
const CountryPerformance = lazy(() => import("./pages/CountryPerformance"));
const Monitoring = lazy(() => import("./pages/Monitoring"));
const Settings = lazy(() => import("./pages/Settings"));
const SettingsSection = lazy(() => import("./pages/SettingsSection"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
const Users = lazy(() => import("./pages/Users"));
const LeadPools = lazy(() => import("./pages/LeadPools"));
const LeadPoolDetail = lazy(() => import("./pages/LeadPoolDetail"));
const InjectionDashboard = lazy(() => import("./pages/InjectionDashboard"));
const InjectionJobs = lazy(() => import("./pages/InjectionJobs"));
const InjectionDetail = lazy(() => import("./pages/InjectionDetail"));
const InjectionLeads = lazy(() => import("./pages/InjectionLeads"));
const InjectionFailedLeads = lazy(() => import("./pages/InjectionFailedLeads"));
const SendHistory = lazy(() => import("./pages/SendHistory"));
const AffiliateRejectedLeads = lazy(() => import("./pages/AffiliateRejectedLeads"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const CallbackLogs = lazy(() => import("./pages/CallbackLogs"));
const RolesPermissions = lazy(() => import("./pages/RolesPermissions"));
const CRMSettings = lazy(() => import("./pages/CRMSettings"));
const HelpDesk = lazy(() => import("./pages/HelpDesk"));
const AgentLogin = lazy(() => import("./pages/AgentLogin"));
const AgentDashboard = lazy(() => import("./pages/AgentDashboard"));
const ChatSessions = lazy(() => import("./pages/ChatSessions"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PageLoader = () => (
  <div className="p-8 space-y-4">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-3/4" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TitleManager />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <SidebarStateProvider>
              <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/affiliates" element={<Affiliates />} />
                <Route path="/affiliate-performance" element={<AffiliatePerformance />} />
                <Route path="/affiliate-api-logs" element={<AffiliateApiLogs />} />
                <Route path="/advertisers" element={<Advertisers />} />
                <Route path="/advertiser-performance" element={<AdvertiserPerformance />} />
                <Route path="/distributions" element={<Distributions />} />
                <Route path="/advertiser-config" element={<AdvertiserConfig />} />
                <Route path="/distribution-rules" element={<DistributionRules />} />
                <Route path="/rejected-leads" element={<RejectedLeads />} />
                <Route path="/test-logs" element={<TestLeadLogs />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/conversions" element={<Conversions />} />
                <Route path="/country-performance" element={<CountryPerformance />} />
                <Route path="/monitoring" element={<Monitoring />} />
                <Route path="/users" element={<Users />} />
                <Route path="/lead-pools" element={<LeadPools />} />
                <Route path="/lead-pools/:id" element={<LeadPoolDetail />} />
                <Route path="/injections" element={<InjectionDashboard />} />
                <Route path="/injections/jobs" element={<InjectionJobs />} />
                <Route path="/injections/leads" element={<InjectionLeads />} />
                <Route path="/injections/failed" element={<InjectionFailedLeads />} />
                <Route path="/injections/send-history" element={<SendHistory />} />
                <Route path="/injections/:id" element={<InjectionDetail />} />
                <Route path="/affiliate-rejected" element={<AffiliateRejectedLeads />} />
                
                <Route path="/audit-logs" element={<AuditLogs />} />
                <Route path="/logs/callback-logs" element={<CallbackLogs />} />
                <Route path="/roles" element={<RolesPermissions />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/settings/:section" element={<SettingsSection />} />
                <Route path="/crm-settings" element={<CRMSettings />} />
                <Route path="/api-docs" element={<ApiDocs />} />
                <Route path="/help" element={<HelpDesk />} />
                <Route path="/agent/login" element={<AgentLogin />} />
                <Route path="/agent/dashboard" element={<AgentDashboard />} />
                <Route path="/chat-sessions" element={<ChatSessions />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </SidebarStateProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;