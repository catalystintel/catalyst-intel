/**
 * Thin Web Push wrapper (VAPID) shared by alert delivery and the
 * subscribe/unsubscribe API route. Free — no FCM/APNs account required;
 * VAPID keys are self-generated and just identify this server to browser
 * push services (see `.env.example`).
 */
import webpush from "web-push";

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type PushSendResult = { ok: boolean; detail: string; gone?: boolean };

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const contact = process.env.WEB_PUSH_CONTACT_EMAIL?.trim();
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    `mailto:${contact || "support@example.com"}`,
    publicKey,
    privateKey,
  );
  configured = true;
  return true;
}

export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() &&
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim(),
  );
}

export function webPushPublicKey(): string | null {
  return process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() || null;
}

/**
 * Sends a push notification to one subscription. Returns `gone: true` on a
 * 404/410 so the caller can prune the dead subscription row.
 */
export async function sendWebPush(
  subscription: PushSubscriptionRecord,
  payload: { title: string; body: string; url?: string },
): Promise<PushSendResult> {
  if (!ensureConfigured()) {
    return {
      ok: false,
      detail: "WEB_PUSH_VAPID_PUBLIC_KEY/PRIVATE_KEY not configured.",
    };
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    );
    return { ok: true, detail: "Push sent" };
  } catch (err) {
    const statusCode =
      err && typeof err === "object" && "statusCode" in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;
    const gone = statusCode === 404 || statusCode === 410;
    return {
      ok: false,
      gone,
      detail:
        err instanceof Error
          ? `Push failed (${statusCode ?? "?"}): ${err.message}`
          : "Push failed",
    };
  }
}
