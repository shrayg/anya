"use client";

import { Suspense } from "react";
import { Clock } from "lucide-react";

import SupportTicketsClient from "./support-tickets-client";

export default function SupportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
          <Clock className="mr-2 size-4 animate-spin text-anya-accent" />
          Loading support…
        </div>
      }
    >
      <SupportTicketsClient />
    </Suspense>
  );
}
