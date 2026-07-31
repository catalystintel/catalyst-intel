/**
 * SSRF guard for user-supplied alert webhook URLs.
 *
 * Authenticated users can configure webhook destinations that the server
 * POSTs to on every matching ingest (auto-fire) and on manual "Test". Without
 * this check, a rule could target localhost, link-local, or cloud metadata.
 *
 * Storage uses hostname/literal checks. Delivery also resolves DNS and
 * re-validates every address (mitigates DNS rebinding / nip.io-style hosts).
 * Fetch call sites must disable redirect following.
 */

import { lookup } from "node:dns/promises";

export type WebhookUrlValidation =
  { ok: true; url: string } | { ok: false; reason: string };

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const PRIVATE_RESOLVE_REASON =
  "Webhook URL must not target private, local, or metadata hosts.";

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

/**
 * Parse IPv4-mapped IPv6 (`::ffff:…`) into IPv4 octets, or null if not mapped.
 * Handles dotted (`::ffff:127.0.0.1`), hex (`::ffff:7f00:1`), and
 * `::ffff:0:7f00:1` forms Node's URL parser may emit.
 */
function ipv4MappedOctets(hostname: string): number[] | null {
  const h = hostname.toLowerCase();

  const dotted = h.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) return parseIpv4(dotted[1]);

  const hex = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = Number.parseInt(hex[1], 16);
    const lo = Number.parseInt(hex[2], 16);
    if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null;
    return [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff];
  }

  const hexWithZero = h.match(/^::ffff:0:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexWithZero) {
    const hi = Number.parseInt(hexWithZero[1], 16);
    const lo = Number.parseInt(hexWithZero[2], 16);
    if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null;
    return [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff];
  }

  return null;
}

function isBlockedIpv6(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "::1" || h === "::") return true;

  const mapped = ipv4MappedOctets(h);
  if (mapped) return isBlockedIpv4(mapped);

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
  return false;
}

function normalizeHostname(hostname: string): string {
  // Node's URL parser keeps brackets on IPv6 hostnames (`[::1]`).
  return hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[|\]$/g, "");
}

function isBlockedHostname(hostname: string): boolean {
  const h = normalizeHostname(hostname);
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

function isBlockedResolvedAddress(address: string, family: number): boolean {
  if (family === 4 || isIpv4Literal(address)) {
    const parts = parseIpv4(address);
    return parts ? isBlockedIpv4(parts) : true;
  }
  return isBlockedIpv6(address);
}

/**
 * Validates a webhook destination before we store or fetch it (sync checks).
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
      reason: PRIVATE_RESOLVE_REASON,
    };
  }

  return { ok: true, url: parsed.href };
}

export type WebhookDnsLookup = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<{ address: string; family: number }[]>;

/**
 * Full SSRF check for outbound delivery: sync validation plus DNS resolve of
 * every A/AAAA record. Call immediately before `fetch`.
 *
 * @param resolveDns - Injectable DNS lookup (tests); defaults to `dns.promises.lookup`.
 */
export async function assertWebhookUrlSafeForFetch(
  raw: string,
  resolveDns: WebhookDnsLookup = lookup,
): Promise<WebhookUrlValidation> {
  const sync = validateWebhookUrl(raw);
  if (!sync.ok) return sync;

  const parsed = new URL(sync.url);
  const host = normalizeHostname(parsed.hostname);

  // Literal IPs were already checked in validateWebhookUrl.
  if (parseIpv4(host) || host.includes(":")) {
    return sync;
  }

  let records: { address: string; family: number }[];
  try {
    records = await resolveDns(host, { all: true, verbatim: true });
  } catch {
    return {
      ok: false,
      reason: "Webhook URL hostname could not be resolved.",
    };
  }

  if (records.length === 0) {
    return {
      ok: false,
      reason: "Webhook URL hostname could not be resolved.",
    };
  }

  for (const record of records) {
    if (isBlockedResolvedAddress(record.address, record.family)) {
      return { ok: false, reason: PRIVATE_RESOLVE_REASON };
    }
  }

  return sync;
}
