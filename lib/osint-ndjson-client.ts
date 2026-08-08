/**
 * Client helper to consume OSINT NDJSON progress streams (breaches / discord / stealer).
 */

export type OsintNdjsonEvent = {
  type: "partial" | "done" | "error" | string;
  module?: string;
  done?: number;
  total?: number;
  result?: unknown;
  error?: string;
};

export async function consumeOsintNdjsonStream(
  response: Response,
  handlers: {
    onPartial?: (event: OsintNdjsonEvent) => void;
    onDone?: (event: OsintNdjsonEvent) => void;
    onError?: (event: OsintNdjsonEvent) => void;
    signal?: AbortSignal;
  },
): Promise<OsintNdjsonEvent | null> {
  if (!response.body) return null;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastUseful: OsintNdjsonEvent | null = null;

  const handleLine = (line: string) => {
    const trimmed = line.trim();

    if (!trimmed) return;

    let event: OsintNdjsonEvent;

    try {
      event = JSON.parse(trimmed) as OsintNdjsonEvent;
    } catch {
      return;
    }

    if (event.type === "error") {
      handlers.onError?.(event);

      return;
    }

    if (event.type === "partial") {
      lastUseful = event;
      handlers.onPartial?.(event);

      return;
    }

    if (event.type === "done") {
      lastUseful = event;
      handlers.onDone?.(event);
    }
  };

  while (true) {
    if (handlers.signal?.aborted) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }

      break;
    }

    const { done, value } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");

    buffer = lines.pop() ?? "";

    for (const line of lines) {
      handleLine(line);
    }
  }

  if (buffer.trim()) {
    handleLine(buffer);
  }

  return lastUseful;
}
