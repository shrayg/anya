"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BlurredValue } from "@/components/dashboard/blurred-value";
import { PUBLIC_AI_LABEL } from "@/lib/public-branding";
import type { AiIntelResult } from "@/lib/ai-intel";
import {
  buildCryptoAiChatMessages,
  type CryptoChatMessage,
} from "@/lib/crypto-ai-chat";
import { formatTime } from "@/lib/format-datetime";

function renderChatText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-white/6 px-1 py-0.5 font-mono text-[0.82em] text-anya-accent"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.includes("\n")) {
      return part.split("\n").map((line, lineIndex) => (
        <span key={`${index}-${lineIndex}`}>
          {lineIndex > 0 && <br />}
          {line}
        </span>
      ));
    }

    return part;
  });
}

function TypingIndicator() {
  return (
    <div className="crypto-ai-chat-msg crypto-ai-chat-msg--anya crypto-ai-chat-msg--typing">
      <div className="anya-comms-msg-meta">
        <span className="crypto-ai-chat-name">{PUBLIC_AI_LABEL}</span>
        <span className="anya-comms-msg-time">analysing…</span>
      </div>
      <p className="crypto-ai-chat-typing-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </p>
    </div>
  );
}

function ChatBubble({
  message,
  blurResults = false,
}: {
  message: CryptoChatMessage;
  blurResults?: boolean;
}) {
  const isUser = message.role === "user";
  const toneClass =
    message.tone === "warn"
      ? "crypto-ai-chat-msg--warn"
      : message.tone === "success"
        ? "crypto-ai-chat-msg--success"
        : message.tone === "info"
          ? "crypto-ai-chat-msg--info"
          : "";

  return (
    <div
      className={`crypto-ai-chat-msg ${isUser ? "crypto-ai-chat-msg--user" : "crypto-ai-chat-msg--anya"} ${toneClass}`}
    >
      <div className="anya-comms-msg-meta">
        <span className={isUser ? "anya-comms-msg-user" : "crypto-ai-chat-name"}>
          {isUser ? "you" : PUBLIC_AI_LABEL}
        </span>
        {message.meta ? (
          <span className="anya-comms-msg-time">{message.meta}</span>
        ) : null}
      </div>
      <p className="anya-comms-msg-text">
        {blurResults ? (
          <BlurredValue forceBlur text={message.text} />
        ) : (
          renderChatText(message.text)
        )}
      </p>
    </div>
  );
}

type CryptoAiChatResultsProps = {
  result: AiIntelResult;
  blurResults?: boolean;
};

export function CryptoAiChatResults({ result, blurResults = false }: CryptoAiChatResultsProps) {
  const messages = useMemo(
    () => buildCryptoAiChatMessages(result.query, result),
    [result],
  );
  const [visibleCount, setVisibleCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(false);
  const startedAt = useMemo(() => new Date().toISOString(), [result.query]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setVisibleCount(0);
    setIsTyping(false);
  }, [result]);

  useEffect(() => {
    if (visibleCount >= messages.length) {
      setIsTyping(false);
      return;
    }

    const next = messages[visibleCount];
    const delay =
      visibleCount === 0
        ? 120
        : next.role === "anya" && visibleCount > 0
          ? 680 + Math.min(next.text.length * 8, 1200)
          : 280;

    const showTyping = next.role === "anya" && visibleCount > 0;
    let typingTimer: number | undefined;
    let revealTimer: number | undefined;

    if (showTyping) {
      typingTimer = window.setTimeout(() => {
        if (!isMountedRef.current) return;
        setIsTyping(true);
      }, 0);
    }

    revealTimer = window.setTimeout(() => {
      if (!isMountedRef.current) return;
      setVisibleCount((current) => current + 1);
      setIsTyping(false);
    }, delay);

    return () => {
      if (typingTimer !== undefined) window.clearTimeout(typingTimer);
      if (revealTimer !== undefined) window.clearTimeout(revealTimer);
    };
  }, [visibleCount, messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [visibleCount, isTyping]);

  const done = visibleCount >= messages.length;

  return (
    <div className="anya-comms crypto-ai-chat">
      <div className="anya-comms-header">
        <div>
          <h3 className="anya-comms-title">Crypto AI Analyse</h3>
          <p className="anya-comms-sub">
            Live wallet intel · {formatTime(startedAt)}
          </p>
        </div>
        <span className="anya-comms-live">
          <span
            className={`size-1.5 rounded-full bg-anya-accent ${done ? "" : "animate-pulse"}`}
          />
          {done ? "Complete" : "Analysing"}
        </span>
      </div>

      <div className="anya-comms-body">
        <div ref={scrollRef} className="crypto-ai-chat-feed">
          {messages.slice(0, visibleCount).map((message) => (
            <ChatBubble key={message.id} blurResults={blurResults} message={message} />
          ))}
          {isTyping ? <TypingIndicator /> : null}
        </div>

        {done ? (
          <div className="crypto-ai-chat-footer">
            <span className="crypto-ai-chat-risk">
              Risk {result.riskLabel} · {result.riskScore}/100
            </span>
            <span className="text-xs text-zinc-500">
              {result.elapsedMs}ms · {result.sources.join(" · ")}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
