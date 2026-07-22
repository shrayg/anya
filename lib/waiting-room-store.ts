export type WaitingRoomMessage = {
  id: number;
  username: string;
  text: string;
  createdAt: string;
};

const MAX_MESSAGES = 200;
const PRESENCE_TTL_MS = 45_000;

let messages: WaitingRoomMessage[] = [
  {
    id: 1,
    username: "Anya",
    text: "Welcome to the community channel.",
    createdAt: new Date().toISOString(),
  },
];

let nextId = 2;
const presence = new Map<string, number>();

function prunePresence(now: number) {
  for (const [key, lastSeen] of presence.entries()) {
    if (now - lastSeen > PRESENCE_TTL_MS) {
      presence.delete(key);
    }
  }
}

export function getMessages(since?: number) {
  if (!since) {
    return messages;
  }

  return messages.filter((message) => message.id > since);
}

export function addMessage(username: string, text: string) {
  const message: WaitingRoomMessage = {
    id: nextId++,
    username,
    text,
    createdAt: new Date().toISOString(),
  };

  messages = [...messages, message].slice(-MAX_MESSAGES);

  return message;
}

export function touchPresence(sessionKey: string) {
  const now = Date.now();

  presence.set(sessionKey, now);
  prunePresence(now);
}

export function getOnlineCount() {
  const now = Date.now();

  prunePresence(now);

  return presence.size;
}
