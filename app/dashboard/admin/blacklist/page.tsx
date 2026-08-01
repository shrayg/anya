"use client";

import { AdminBlacklistPanel } from "@/components/dashboard/admin-blacklist-panel";
import { AdminCollapsible } from "@/components/dashboard/admin-collapsible";

export default function AdminBlacklistPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">Blacklist</h2>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Block specific emails, phones, usernames, domains, IPs, passwords, and
          other values from appearing in search results.
        </p>
      </div>

      <AdminCollapsible
        defaultOpen
        id="data-blacklist"
        subtitle="Exact normalized match · server-side filter"
        title="Data blacklist"
      >
        <AdminBlacklistPanel embedded />
      </AdminCollapsible>
    </div>
  );
}
