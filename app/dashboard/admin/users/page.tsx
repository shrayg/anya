"use client";

import { AdminCollapsible } from "@/components/dashboard/admin-collapsible";
import { AdminUsersPanel } from "@/components/dashboard/admin-users-panel";
import { SafetyFlagsPanel } from "@/components/dashboard/safety-flags-panel";

export default function AdminUsersPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">Users</h2>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Members, credits, roles, freeze / ban, and investigation flags.
        </p>
      </div>

      <AdminCollapsible
        defaultOpen
        id="members"
        subtitle="Plans, passwords, freeze / ban / flag"
        title="Members"
      >
        <AdminUsersPanel embedded />
      </AdminCollapsible>

      <AdminCollapsible
        defaultOpen={false}
        id="safety"
        subtitle="Investigate flags and underage-risk cases"
        title="Safety"
      >
        <SafetyFlagsPanel embedded mode="admin" />
      </AdminCollapsible>
    </div>
  );
}
