"use client";

import { apiFetch } from "@/lib/csrf-client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

type ChatMessage = {
  id: number;
  username: string;
  text: string;
  createdAt: string;
};

import { formatTime } from "@/lib/format-datetime";

export function LiveIntelChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [guestName, setGuestName] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => {
        if (data?.user?.username) {
          setGuestName(data.user.username);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadMessages = async () => {
      try {
        const response = await fetch("/api/waiting-room/messages");
        const data = await response.json();

        if (!cancelled && Array.isArray(data.messages)) {
          setMessages(data.messages.slice(-12));
        }
      } catch {
        return;
      }
    };

    loadMessages();
    const interval = window.setInterval(loadMessages, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = input.trim();

    if (!text || !guestName) return;

    const response = await apiFetch("/api/waiting-room/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, guestName }),
    });

    const data = await response.json();

    if (response.ok && data.message) {
      setMessages((current) => [...current, data.message].slice(-12));
      setInput("");
    }
  };

  return (
    <div className="anya-comms flex min-h-[300px] flex-col">
      <div className="anya-comms-header">
        <div>
          <h3 className="anya-comms-title">Wire tap</h3>
          <p className="anya-comms-sub">Open channel · community chat</p>
        </div>
        <span className="anya-comms-live">
          <span className="size-1.5 animate-pulse rounded-full bg-anya-accent" />
          Live
        </span>
      </div>

      <div className="anya-comms-body flex flex-1 flex-col">
        <div
          ref={scrollRef}
          className="mb-4 flex-1 space-y-1 overflow-y-auto pr-1"
        >
          {messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              Channel quiet. Break the silence.
            </p>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="anya-comms-msg">
                <div className="anya-comms-msg-meta">
                  <span className="anya-comms-msg-user">{message.username}</span>
                  <span className="anya-comms-msg-time">
                    {formatTime(message.createdAt)}
                  </span>
                </div>
                <p className="anya-comms-msg-text">{message.text}</p>
              </div>
            ))
          )}
        </div>

        <form className="flex items-center gap-2" onSubmit={handleSend}>
          <input
            className="dash-input min-w-0 flex-1 py-2.5 font-mono text-sm"
            onChange={(event) => setInput(event.target.value)}
            placeholder="transmit message…"
            value={input}
          />
          <button
            className="anya-run-btn !min-w-0 px-3 py-2.5"
            type="submit"
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
