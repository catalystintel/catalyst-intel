/**
 * SMTP client for alert / notification email (e.g. Gmail App Password).
 * Product feedback stays on Resend — see `./resend.ts`.
 */

import nodemailer from "nodemailer";

import { APP_NAME } from "@/lib/brand";

export type SmtpSendResult = { ok: boolean; detail: string };

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
    process.env.SMTP_USER?.trim() &&
    process.env.SMTP_PASS?.trim(),
  );
}

export function smtpFromAddress(): string {
  const from = process.env.SMTP_FROM?.trim();
  if (from) return from;
  const user = process.env.SMTP_USER?.trim();
  return user ? `${APP_NAME} <${user}>` : APP_NAME;
}

function smtpPort(): number {
  const raw = process.env.SMTP_PORT?.trim();
  if (!raw) return 587;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 587;
}

/**
 * Sends a plain-text email via SMTP. Returns a structured result — never throws.
 */
export async function sendSmtpEmail(options: {
  to: string | string[];
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<SmtpSendResult> {
  if (!isSmtpConfigured()) {
    return {
      ok: false,
      detail: "Email delivery is not available right now.",
    };
  }

  const host = process.env.SMTP_HOST!.trim();
  const user = process.env.SMTP_USER!.trim();
  const pass = process.env.SMTP_PASS!.trim();
  const port = smtpPort();
  // Port 465 = implicit TLS; 587 = STARTTLS (Gmail default).
  const secure = process.env.SMTP_SECURE?.trim() === "true" || port === 465;

  const to = Array.isArray(options.to) ? options.to : [options.to];

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });

    await transporter.sendMail({
      from: smtpFromAddress(),
      to,
      subject: options.subject,
      text: options.text,
      ...(options.replyTo?.trim() ? { replyTo: options.replyTo.trim() } : {}),
    });

    return { ok: true, detail: "Email sent via SMTP" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email failed";
    return {
      ok: false,
      detail: `SMTP: ${message}`.slice(0, 220),
    };
  }
}
