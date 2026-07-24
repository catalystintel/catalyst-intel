/**
 * SSRF guard for user-supplied alert webhook URLs.
 *
 * Authenticated users can configure webhook destinations that the server
 * POSTs to on every matching ingest (auto-fire) and on manual "Test". Without
 * this check, a rule could target localhost, link-local, or cloud metadata.
 *
 * Residual risk: DNS rebinding after hostname validation. We also disable
 * redirect following at the fetch call site to avoid open-redirect bounce.
 */

export type WebhookUrlValidation =
  { ok: true; url: string } | { ok: false; reason: string };

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

function isIpv4Literal(hostname: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
}

function parseIpv4(hostname: string): number[] | null {
  if (!isIpv4Literal(hostname)) return null;
  const parts = hostname.split(".").map((p) => Number(p));
  if (
    parts.length !== 4 ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  ) {
    return null;
  }
  return parts;
}

function isBlockedIpv4(parts: number[]): boolean {
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this" network
  if (a === 169 && b === 254) return true; // link-local / metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isBlockedIpv6(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "::1" || h === "::") return true;
  // Unique-local (fc00::/7), link-local (fe80::/10), multicast (ff00::/8)
  if (h.startsWith("fc") || h.startsWith("fd")) return true;
  if (
    h.startsWith("fe8") ||
    h.startsWith("fe9") ||
    h.startsWith("fea") ||
    h.startsWith("feb")
  ) {
    return true;
  }
  if (h.startsWith("ff")) return true;
  // IPv4-mapped IPv6 (::ffff:a.b.c.d)
  const mapped = h.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) {
    const parts = parseIpv4(mapped[1]);
    return parts ? isBlockedIpv4(parts) : true;
  }
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  // Node's URL parser keeps brackets on IPv6 hostnames (`[::1]`).
  const h = hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[|\]$/g, "");
  if (!h) return true;
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  ) {
    return true;
  }

  const ipv4 = parseIpv4(h);
  if (ipv4) return isBlockedIpv4(ipv4);

  if (h.includes(":")) return isBlockedIpv6(h);

  return false;
}

/**
 * Validates a webhook destination before we store or fetch it.
 *
 * @param raw - User-supplied URL string.
 * @returns Normalized href on success, or a human-readable rejection reason.
 */
export function validateWebhookUrl(raw: string): WebhookUrlValidation {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, reason: "Webhook URL is required." };
  }
  if (trimmed.length > 2048) {
    return { ok: false, reason: "Webhook URL is too long." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "Webhook URL is not a valid URL." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "Webhook URL must use https." };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: "Webhook URL must not include credentials." };
  }

  if (isBlockedHostname(parsed.hostname)) {
    return {
      ok: false,
      reason: "Webhook URL must not target private, local, or metadata hosts.",
    };
  }

  return { ok: true, url: parsed.href };
}
