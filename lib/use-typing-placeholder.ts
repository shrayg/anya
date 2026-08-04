"use client";

import { useEffect, useState } from "react";

type Phase = "typing" | "holding" | "deleting" | "pausing";

/**
 * Cycles a typewriter string for empty inputs. Freezes while disabled
 * (e.g. focused / has value). Honors prefers-reduced-motion (static text).
 */
export function useTypingPlaceholder(
  fullText: string,
  options?: {
    enabled?: boolean;
    typeMs?: number;
    deleteMs?: number;
    holdMs?: number;
    pauseMs?: number;
  },
) {
  const enabled = options?.enabled ?? true;
  const typeMs = options?.typeMs ?? 55;
  const deleteMs = options?.deleteMs ?? 32;
  const holdMs = options?.holdMs ?? 1600;
  const pauseMs = options?.pauseMs ?? 420;

  const [display, setDisplay] = useState(fullText);
  const [caretOn, setCaretOn] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setDisplay(fullText);
      setCaretOn(false);

      return;
    }

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setDisplay(fullText);
      setCaretOn(false);

      return;
    }

    let phase: Phase = "typing";
    let index = 0;
    let timer = 0;
    let caretTimer = 0;

    setDisplay("");
    setCaretOn(true);

    caretTimer = window.setInterval(() => {
      setCaretOn((prev) => !prev);
    }, 530);

    const tick = () => {
      if (phase === "typing") {
        index = Math.min(fullText.length, index + 1);
        setDisplay(fullText.slice(0, index));
        if (index >= fullText.length) {
          phase = "holding";
          timer = window.setTimeout(tick, holdMs);
        } else {
          timer = window.setTimeout(tick, typeMs);
        }

        return;
      }

      if (phase === "holding") {
        phase = "deleting";
        timer = window.setTimeout(tick, deleteMs);

        return;
      }

      if (phase === "deleting") {
        index = Math.max(0, index - 1);
        setDisplay(fullText.slice(0, index));
        if (index <= 0) {
          phase = "pausing";
          timer = window.setTimeout(tick, pauseMs);
        } else {
          timer = window.setTimeout(tick, deleteMs);
        }

        return;
      }

      phase = "typing";
      timer = window.setTimeout(tick, typeMs);
    };

    timer = window.setTimeout(tick, typeMs);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(caretTimer);
    };
  }, [fullText, enabled, typeMs, deleteMs, holdMs, pauseMs]);

  if (!enabled) return fullText;

  return caretOn ? `${display}|` : `${display}\u00A0`;
}
