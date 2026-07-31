"use client";

import { AdminCollapsible } from "@/components/dashboard/admin-collapsible";
import { AdminEventLogsPanel } from "@/components/dashboard/admin-event-logs-panel";
import { AdminWorkspaceDashboard } from "@/components/dashboard/admin-workspace-dashboard";

export default function AdminOverviewPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">Dashboard</h2>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Searches, signups, visits, growth, and recent platform activity.
        </p>
      </div>

      <AdminWorkspaceDashboard />

      <AdminCollapsible
        defaultOpen={false}
        id="event-logs"
        subtitle="Searches, failures, rate limits"
        title="Event logs"
      >
        <AdminEventLogsPanel embedded />
      </AdminCollapsible>
    </div>
  );
}
