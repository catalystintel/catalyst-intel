/**
 * Thin Resend client shared by alert delivery and product feedback.
 */

export type ResendSendResult = { ok: boolean; detail: string };

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function resendFromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Catalyst Intel <onboarding@resend.dev>"
  );
}

/**
 * Sends a plain-text email via Resend. Returns a structured result — never throws.
 */
export async function sendResendEmail(options: {
  to: string | string[];
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<ResendSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      detail: "RESEND_API_KEY not configured — email delivery skipped.",
    };
  }

  const to = Array.isArray(options.to) ? options.to : [options.to];
  const payload: Record<string, unknown> = {
    from: resendFromAddress(),
    to,
    subject: options.subject,
    text: options.text,
  };
  if (options.replyTo?.trim()) {
    payload.reply_to = options.replyTo.trim();
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        detail: `Resend HTTP ${res.status}${body ? `: ${body.slice(0, 180)}` : ""}`,
      };
    }
    return { ok: true, detail: "Email sent via Resend" };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "Email failed",
    };
  }
}

/** Default product-feedback inbox (override with FEEDBACK_TO_EMAIL). */
export const DEFAULT_FEEDBACK_TO_EMAIL = "catalyst.intel.feedback@gmail.com";

/** Inbox for product feedback (bugs / features / improvements). */
export function feedbackInbox(): string {
  return process.env.FEEDBACK_TO_EMAIL?.trim() || DEFAULT_FEEDBACK_TO_EMAIL;
}
