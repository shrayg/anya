import "server-only";

const DISCORD_WEBHOOK_RE =
  /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/i;

function getWebhookUrl() {
  const url = process.env.DISCORD_SUPPORT_WEBHOOK_URL?.trim();

  if (!url) return null;
  if (!DISCORD_WEBHOOK_RE.test(url)) {
    console.error(
      "DISCORD_SUPPORT_WEBHOOK_URL is invalid or not a Discord webhook",
    );

    return null;
  }

  return url;
}

function escapeDiscord(value: string) {
  return value.replace(/[`*_~|\\]/g, "\\$&").slice(0, 900);
}

type TicketWebhookPayload = {
  event: "created" | "reply" | "status";
  ticketPublicId: string;
  subject: string;
  category: string;
  status: string;
  username: string;
  isStaffReply?: boolean;
  messagePreview?: string;
  newStatus?: string;
};

export async function notifySupportDiscord(payload: TicketWebhookPayload) {
  const webhookUrl = getWebhookUrl();

  if (!webhookUrl) return { sent: false as const, reason: "not_configured" };

  const appUrl =
    process.env.APP_URL?.replace(/\/$/, "") || "https://anyaint.com";
  const ticketUrl = `${appUrl}/dashboard/support?ticket=${encodeURIComponent(payload.ticketPublicId)}`;

  const title =
    payload.event === "created"
      ? "New support ticket"
      : payload.event === "reply"
        ? payload.isStaffReply
          ? "Staff replied to ticket"
          : "User replied to ticket"
        : "Ticket status updated";

  const fields = [
    {
      name: "Ticket",
      value: `\`${escapeDiscord(payload.ticketPublicId)}\``,
      inline: true,
    },
    { name: "User", value: escapeDiscord(payload.username), inline: true },
    { name: "Category", value: escapeDiscord(payload.category), inline: true },
    {
      name: "Status",
      value: escapeDiscord(payload.newStatus || payload.status),
      inline: true,
    },
    { name: "Subject", value: escapeDiscord(payload.subject), inline: false },
  ];

  if (payload.messagePreview) {
    fields.push({
      name: "Message",
      value: escapeDiscord(payload.messagePreview),
      inline: false,
    });
  }

  const body = {
    username: "Anya.Int Support",
    embeds: [
      {
        title,
        url: ticketUrl,
        color:
          payload.event === "created"
            ? 0xf59e0b
            : payload.event === "status"
              ? 0x38bdf8
              : 0x34d399,
        fields,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error("Discord webhook failed:", response.status);

      return { sent: false as const, reason: "webhook_error" };
    }

    return { sent: true as const };
  } catch (error) {
    console.error("Discord webhook error:", error);

    return { sent: false as const, reason: "webhook_error" };
  }
}
