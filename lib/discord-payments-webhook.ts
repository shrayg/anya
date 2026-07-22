import "server-only";

const DISCORD_WEBHOOK_RE =
  /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/i;

function getWebhookUrl() {
  const url =
    process.env.DISCORD_PAYMENTS_WEBHOOK_URL?.trim() ||
    process.env.DISCORD_SUPPORT_WEBHOOK_URL?.trim();

  if (!url) return null;
  if (!DISCORD_WEBHOOK_RE.test(url)) {
    console.error("Discord payments webhook URL is invalid");

    return null;
  }

  return url;
}

function escapeDiscord(value: string) {
  return value.replace(/[`*_~|\\]/g, "\\$&").slice(0, 900);
}

export type PaymentWebhookPayload = {
  username: string;
  amount: number;
  currency?: string;
  type: string;
  plan?: string | null;
  interval?: string | null;
  description?: string;
  paymentId?: number | null;
  providerRef?: string | null;
};

export async function notifyPaymentDiscord(payload: PaymentWebhookPayload) {
  const webhookUrl = getWebhookUrl();

  if (!webhookUrl) return { sent: false as const, reason: "not_configured" };

  const appUrl =
    process.env.APP_URL?.replace(/\/$/, "") || "https://anyaint.com";
  const money = `$${payload.amount.toFixed(2)} ${(payload.currency || "USD").toUpperCase()}`;

  const title =
    payload.type === "subscription"
      ? "New subscription payment"
      : payload.type === "api_access"
        ? "API access payment"
        : payload.type === "balance_topup" || payload.type === "credits"
          ? "Credit pack purchase"
          : "Payment received";

  const fields = [
    { name: "User", value: escapeDiscord(payload.username), inline: true },
    { name: "Amount", value: money, inline: true },
    { name: "Type", value: escapeDiscord(payload.type), inline: true },
  ];

  if (payload.plan) {
    fields.push({
      name: "Plan",
      value: escapeDiscord(payload.plan),
      inline: true,
    });
  }
  if (payload.interval) {
    fields.push({
      name: "Interval",
      value: escapeDiscord(payload.interval),
      inline: true,
    });
  }
  if (payload.paymentId) {
    fields.push({
      name: "Payment ID",
      value: `\`${payload.paymentId}\``,
      inline: true,
    });
  }
  if (payload.providerRef) {
    fields.push({
      name: "Square ref",
      value: `\`${escapeDiscord(payload.providerRef)}\``,
      inline: false,
    });
  }
  if (payload.description) {
    fields.push({
      name: "Details",
      value: escapeDiscord(payload.description),
      inline: false,
    });
  }

  const body = {
    username: "Anya Payments",
    embeds: [
      {
        title,
        url: `${appUrl}/pricing`,
        color: 0x34d399,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: "Square · anyaint.com" },
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
      console.error("Discord payments webhook failed:", response.status);

      return { sent: false as const, reason: "webhook_error" };
    }

    return { sent: true as const };
  } catch (error) {
    console.error("Discord payments webhook error:", error);

    return { sent: false as const, reason: "webhook_error" };
  }
}
