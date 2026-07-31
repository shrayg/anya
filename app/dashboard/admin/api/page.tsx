"use client";

import { AdminApiStatusPanel } from "@/components/dashboard/admin-api-status-panel";

export default function AdminApiPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">API</h2>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Provider health, gateways, endpoints, and latency.
        </p>
      </div>

      <div className="overflow-hidden rounded-[0.85rem] border border-white/[0.07] bg-[#0c0c0e] px-3 py-3">
        <AdminApiStatusPanel embedded />
      </div>
    </div>
  );
}
