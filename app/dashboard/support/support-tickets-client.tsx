"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageCircle, RefreshCw, Send, Ticket } from "lucide-react";
import { GiCoffeeCup } from "react-icons/gi";

import {
  DashButton,
  DashInput,
  DashPanel,
  DashSelect,
  DashTextarea,
  PageHeader,
} from "@/components/dashboard/dashboard-ui";
import { siteConfig } from "@/config/site";
import {
  categoryLabel,
  statusLabel,
  TICKET_CATEGORIES,
  type TicketCategory,
} from "@/lib/support-tickets";

type TicketListItem = {
  id: string;
  subject: string;
  category: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  username: string;
  lastMessage: { body: string; createdAt: string; isStaff: boolean } | null;
};

type TicketMessage = {
  id: number;
  body: string;
  isStaff: boolean;
  createdAt: string;
  author: string;
};

type TicketDetail = {
  id: string;
  subject: string;
  category: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  username: string;
  messages: TicketMessage[];
};

export default function SupportTicketsClient() {
  const searchParams = useSearchParams();
  const initialTicket = searchParams.get("ticket");

  const [canManageSupport, setCanManageSupport] = useState(false);
  const [scopeAll, setScopeAll] = useState(false);
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialTicket);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<TicketCategory>("general");
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = scopeAll ? "?scope=all" : "";
      const response = await fetch(`/api/support/tickets${query}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not load tickets.");
        return;
      }
      setTickets(data.tickets ?? []);
      setCanManageSupport(Boolean(data.canManageSupport));
    } catch {
      setError("Could not load tickets.");
    } finally {
      setLoading(false);
    }
  }, [scopeAll]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/support/tickets/${encodeURIComponent(id)}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not open ticket.");
        setDetail(null);
        return;
      }
      setDetail(data.ticket);
      setCanManageSupport(Boolean(data.canManageSupport));
    } catch {
      setError("Could not open ticket.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    } else {
      setDetail(null);
    }
  }, [selectedId, loadDetail]);

  const openTickets = useMemo(
    () =>
      tickets.filter((ticket) =>
        ["open", "awaiting_user", "awaiting_staff"].includes(ticket.status),
      ).length,
    [tickets],
  );

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, category }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not create ticket.");
        return;
      }
      setSubject("");
      setMessage("");
      setCategory("general");
      await loadTickets();
      setSelectedId(data.ticket.id);
    } catch {
      setError("Could not create ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId || !reply.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/support/tickets/${encodeURIComponent(selectedId)}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not send reply.");
        return;
      }
      setReply("");
      await loadDetail(selectedId);
      await loadTickets();
    } catch {
      setError("Could not send reply.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatus = async (status: string) => {
    if (!selectedId) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/support/tickets/${encodeURIComponent(selectedId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not update status.");
        return;
      }
      await loadDetail(selectedId);
      await loadTickets();
    } catch {
      setError("Could not update status.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-6 py-6 md:px-8 md:py-8">
      <PageHeader
        badge="Support desk"
        subtitle={`Open a ticket and the ${siteConfig.name} team will follow up. Staff replies also notify Discord.`}
        title="Support Tickets"
      />

      <section className="dash-coffee-hero mb-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-amber-300/90">
              <Ticket className="size-5 text-amber-200" />
              <span className="text-sm font-medium">
                {openTickets} open · secured account tickets
              </span>
            </div>
            <h2 className="text-2xl font-semibold text-white">Need a hand?</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
              Tickets are private to your account. Staff can reply here, and updates are sent to
              our Discord webhook.
            </p>
          </div>
          <a href={siteConfig.links.telegram} rel="noreferrer" target="_blank">
            <DashButton className="dash-btn-coffee" variant="coffee">
              <MessageCircle className="size-4" />
              Telegram
            </DashButton>
          </a>
        </div>
      </section>

      {error && (
        <p className="mb-4 rounded-xl border border-red-400/20 bg-red-400/8 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <DashPanel glow="amber">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-semibold text-white">Your tickets</h3>
              <DashButton
                onClick={() => void loadTickets()}
                className="!px-2 !py-1"
                type="button"
                variant="secondary"
              >
                <RefreshCw className="size-3.5" />
              </DashButton>
            </div>

            {canManageSupport && (
              <label className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
                <input
                  checked={scopeAll}
                  className="rounded border-zinc-600"
                  onChange={(event) => setScopeAll(event.target.checked)}
                  type="checkbox"
                />
                Show all tickets (staff)
              </label>
            )}

            {loading ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-zinc-500">No tickets yet.</p>
            ) : (
              <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <button
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        selectedId === ticket.id
                          ? "border-amber-400/30 bg-amber-500/10"
                          : "border-white/5 bg-black/20 hover:border-white/10"
                      }`}
                      onClick={() => setSelectedId(ticket.id)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-white">{ticket.subject}</p>
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-500">
                          {statusLabel(ticket.status)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-500">
                        {categoryLabel(ticket.category)}
                        {canManageSupport && scopeAll ? ` · ${ticket.username}` : ""}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </DashPanel>

          <DashPanel glow="amber">
            <h3 className="mb-4 text-lg font-semibold text-white">New ticket</h3>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div>
                <label className="dash-field-label" htmlFor="ticket-category">
                  Category
                </label>
                <DashSelect
                  id="ticket-category"
                  onChange={(event) => setCategory(event.target.value as TicketCategory)}
                  value={category}
                >
                  {TICKET_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {categoryLabel(value)}
                    </option>
                  ))}
                </DashSelect>
              </div>
              <div>
                <label className="dash-field-label" htmlFor="ticket-subject">
                  Subject
                </label>
                <DashInput
                  id="ticket-subject"
                  maxLength={120}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="What's this about?"
                  required
                  value={subject}
                />
              </div>
              <div>
                <label className="dash-field-label" htmlFor="ticket-message">
                  Message
                </label>
                <DashTextarea
                  id="ticket-message"
                  maxLength={4000}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Tell us what you need help with..."
                  required
                  rows={5}
                  value={message}
                />
              </div>
              <DashButton
                className="dash-btn-coffee"
                disabled={submitting || !subject.trim() || message.trim().length < 10}
                type="submit"
                variant="coffee"
              >
                <GiCoffeeCup aria-hidden size={18} />
                {submitting ? "Sending…" : "Open ticket"}
              </DashButton>
            </form>
          </DashPanel>
        </div>

        <DashPanel className="min-h-[32rem]" glow="amber">
          {!selectedId ? (
            <div className="flex h-full min-h-[24rem] items-center justify-center text-sm text-zinc-500">
              Select a ticket or open a new one.
            </div>
          ) : detailLoading || !detail ? (
            <p className="text-sm text-zinc-500">Loading ticket…</p>
          ) : (
            <div className="flex h-full flex-col">
              <div className="mb-4 border-b border-white/5 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{detail.subject}</h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      {categoryLabel(detail.category)} · {statusLabel(detail.status)} · #
                      {detail.id.slice(0, 8)}
                      {canManageSupport ? ` · ${detail.username}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canManageSupport && (
                      <>
                        <DashButton
                          disabled={submitting}
                          onClick={() => void handleStatus("awaiting_user")}
className="text-xs"
                          type="button"
                          variant="secondary"
                        >
                          Mark awaiting user
                        </DashButton>
                        <DashButton
                          disabled={submitting}
                          onClick={() => void handleStatus("resolved")}
                          className="text-xs"
                          type="button"
                          variant="secondary"
                        >
                          Resolve
                        </DashButton>
                      </>
                    )}
                    <DashButton
                      disabled={submitting || detail.status === "closed"}
                      onClick={() => void handleStatus("closed")}
                      className="text-xs"
                      type="button"
                      variant="secondary"
                    >
                      Close
                    </DashButton>
                  </div>
                </div>
              </div>

              <div className="mb-4 flex-1 space-y-3 overflow-y-auto pr-1">
                {detail.messages.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-xl border px-3 py-3 ${
                      item.isStaff
                        ? "border-sky-400/20 bg-sky-500/10"
                        : "border-white/5 bg-black/20"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
                      <span>
                        {item.author}
                        {item.isStaff ? " · staff" : ""}
                      </span>
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-zinc-200">{item.body}</p>
                  </div>
                ))}
              </div>

              {detail.status !== "closed" ? (
                <form className="space-y-3 border-t border-white/5 pt-4" onSubmit={handleReply}>
                  <DashTextarea
                    maxLength={4000}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="Write a reply…"
                    rows={3}
                    value={reply}
                  />
                  <DashButton
                    className="dash-btn-coffee"
                    disabled={submitting || reply.trim().length < 2}
                    type="submit"
                    variant="coffee"
                  >
                    <Send className="size-4" />
                    {submitting ? "Sending…" : "Send reply"}
                  </DashButton>
                </form>
              ) : (
                <p className="border-t border-white/5 pt-4 text-sm text-zinc-500">
                  This ticket is closed.
                </p>
              )}
            </div>
          )}
        </DashPanel>
      </div>
    </div>
  );
}
