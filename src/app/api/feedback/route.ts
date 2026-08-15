import { NextResponse, type NextRequest } from "next/server";

import { getCurrentAppUser } from "@/lib/auth/current-user";
import { APP_NAME } from "@/lib/brand";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MESSAGE_MAX_CHARS,
  isFeedbackCategory,
  type FeedbackCategory,
} from "@/lib/early-access";
import {
  feedbackInbox,
  isResendConfigured,
  sendResendEmail,
} from "@/lib/email/resend";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";
import {
  isSameOriginRequest,
  sameOriginForbiddenResponse,
} from "@/lib/http/same-origin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function categoryLabel(category: FeedbackCategory): string {
  return (
    FEEDBACK_CATEGORIES.find((c) => c.value === category)?.label ?? category
  );
}

/**
 * Accepts product feedback and emails it to FEEDBACK_TO_EMAIL via Resend.
 * Signed-in only — pre-login / guest submissions are rejected.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return sameOriginForbiddenResponse();
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `feedback:${ip}`,
    ...RATE_LIMITS.feedback,
  });
  if (!limitResult.ok) {
    return rateLimitExceededResponse(limitResult);
  }

  const user = await getCurrentAppUser().catch(() => null);
  if (!user) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
      limitResult,
    );
  }

  if (!isResendConfigured()) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "Feedback email is not configured yet. Try again later." },
        { status: 503 },
      ),
      limitResult,
    );
  }

  const inbox = feedbackInbox();

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const raw =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  const categoryRaw = typeof raw.category === "string" ? raw.category : "";
  if (!isFeedbackCategory(categoryRaw)) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "Pick a feedback type: bug, feature, or improvement." },
        { status: 400 },
      ),
      limitResult,
    );
  }

  const message =
    typeof raw.message === "string"
      ? raw.message.trim().slice(0, FEEDBACK_MESSAGE_MAX_CHARS)
      : "";
  if (message.length < 10) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "Please write at least a short note (10+ characters)." },
        { status: 400 },
      ),
      limitResult,
    );
  }

  const bodyEmail =
    typeof raw.email === "string" ? raw.email.trim().slice(0, 254) : "";
  const fromEmail = user.email?.trim() || bodyEmail;
  if (!fromEmail || !EMAIL_RE.test(fromEmail)) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "A valid email is required so we can follow up." },
        { status: 400 },
      ),
      limitResult,
    );
  }

  const label = categoryLabel(categoryRaw);
  const subject = `[Feedback · ${label}] ${APP_NAME}`;
  const text = [
    `Type: ${label}`,
    `From: ${fromEmail}`,
    `User id: ${user.id}`,
    user.displayName ? `Display name: ${user.displayName}` : null,
    `IP: ${ip}`,
    "",
    message,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const sent = await sendResendEmail({
    to: inbox,
    subject,
    text,
    replyTo: fromEmail,
  });

  if (!sent.ok) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "Could not deliver feedback. Please try again shortly." },
        { status: 502 },
      ),
      limitResult,
    );
  }

  return withRateLimitHeaders(NextResponse.json({ ok: true }), limitResult);
}
