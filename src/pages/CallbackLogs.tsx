import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CallbackLogsTable } from "@/components/monitoring/CallbackLogsTable";

export default function CallbackLogs() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Callback Logs</h1>
          <p className="text-muted-foreground mt-1">Advertiser callback events and responses</p>
        </div>
        <CallbackLogsTable />
      </div>
    </DashboardLayout>
  );
}
