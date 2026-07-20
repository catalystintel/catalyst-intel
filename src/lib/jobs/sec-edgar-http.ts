/**
 * Shared SEC EDGAR HTTP helpers: required User-Agent, AbortSignal timeouts,
 * retries with backoff, and classified errors.
 *
 * Vercel serverless isolates often see `connect ETIMEDOUT` to www.sec.gov
 * (Akamai CDN) from datacenter IPs. Background self-heal uses a short timeout
 * so the catalysts API stays responsive; GHA cron remains the primary ingest.
 */

export type SecFetchKind = "timeout" | "http" | "network" | "config";

/** `background` = best-effort self-heal; `primary` = admin UI / GHA cron. */
export type SecFetchMode = "background" | "primary";

export class SecEdgarRequestError extends Error {
  readonly kind: SecFetchKind;
  readonly url: string;
  readonly status?: number;
  override readonly cause?: unknown;

  constructor(opts: {
    kind: SecFetchKind;
    message: string;
    url: string;
    status?: number;
    cause?: unknown;
  }) {
    super(opts.message);
    this.name = "SecEdgarRequestError";
    this.kind = opts.kind;
    this.url = opts.url;
    this.status = opts.status;
    this.cause = opts.cause;
  }
}

const MODE_DEFAULTS = {
  background: { timeoutMs: 8_000, retries: 1, backoffMs: 400 },
  primary: { timeoutMs: 20_000, retries: 2, backoffMs: 800 },
} as const;

/** SEC requires a descriptive User-Agent on every request. */
export function getSecUserAgent(): string {
  const userAgent = process.env.SEC_EDGAR_USER_AGENT?.trim();
  if (!userAgent) {
    throw new SecEdgarRequestError({
      kind: "config",
      message:
        "SEC_EDGAR_USER_AGENT env var is required (SEC requires a descriptive User-Agent, " +
        "e.g. 'you@email.com CatalystIntel/0.1').",
      url: "",
    });
  }
  return userAgent;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableHttpStatus(status: number | undefined): boolean {
  return status === 429 || (status !== undefined && status >= 500);
}

function causeMessage(error: unknown): string {
  if (!(error instanceof Error)) return "";
  const nested = (error as Error & { cause?: unknown }).cause;
  if (nested instanceof Error) return nested.message;
  if (nested != null) return String(nested);
  return "";
}

export function classifySecFetchFailure(
  error: unknown,
  url: string,
): SecEdgarRequestError {
  if (error instanceof SecEdgarRequestError) return error;

  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  const nested = causeMessage(error);
  const haystack = `${name} ${message} ${nested}`;

  const isTimeout =
    name === "TimeoutError" ||
    name === "AbortError" ||
    /aborted|timeout|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|HeadersTimeoutError/i.test(
      haystack,
    );

  if (isTimeout) {
    return new SecEdgarRequestError({
      kind: "timeout",
      message: `SEC EDGAR request timed out for ${url}`,
      url,
      cause: error,
    });
  }

  return new SecEdgarRequestError({
    kind: "network",
    message: nested
      ? `SEC EDGAR network error for ${url}: ${message} (${nested})`
      : `SEC EDGAR network error for ${url}: ${message}`,
    url,
    cause: error,
  });
}

/** Human-readable one-liner for logs (distinguishes timeout vs HTTP vs network). */
export function formatSecFetchError(error: unknown): string {
  if (error instanceof SecEdgarRequestError) {
    const status = error.status !== undefined ? ` status=${error.status}` : "";
    return `[${error.kind}${status}] ${error.message}`;
  }
  if (error instanceof Error) {
    const nested = causeMessage(error);
    return nested ? `${error.message}: ${nested}` : error.message;
  }
  return String(error);
}

/**
 * Fetch a SEC URL with User-Agent, timeout, and limited retries.
 * Does not throw on successful HTTP responses — caller checks `res.ok` only
 * after this returns (non-OK is thrown here as {@link SecEdgarRequestError}).
 */
export async function fetchSecUrl(
  url: string,
  options: {
    userAgent: string;
    mode?: SecFetchMode;
    timeoutMs?: number;
    retries?: number;
  },
): Promise<Response> {
  const mode = options.mode ?? "primary";
  const defaults = MODE_DEFAULTS[mode];
  const timeoutMs = options.timeoutMs ?? defaults.timeoutMs;
  const retries = options.retries ?? defaults.retries;
  const backoffMs = defaults.backoffMs;

  let lastError: SecEdgarRequestError | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await sleep(backoffMs * attempt);
    }

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": options.userAgent,
          Accept: "application/atom+xml, application/json, text/xml, */*",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.ok) return res;

      const httpError = new SecEdgarRequestError({
        kind: "http",
        message:
          res.status === 403 || res.status === 401
            ? `SEC EDGAR blocked request (${res.status} ${res.statusText}) for ${url} — check SEC_EDGAR_USER_AGENT`
            : `SEC EDGAR request failed: ${res.status} ${res.statusText} for ${url}`,
        url,
        status: res.status,
      });

      if (isRetryableHttpStatus(res.status) && attempt < retries) {
        lastError = httpError;
        continue;
      }
      throw httpError;
    } catch (error) {
      const classified = classifySecFetchFailure(error, url);

      if (
        classified.kind === "http" &&
        !isRetryableHttpStatus(classified.status)
      ) {
        throw classified;
      }
      if (classified.kind === "config") {
        throw classified;
      }

      lastError = classified;
      if (attempt >= retries) throw classified;
    }
  }

  throw (
    lastError ??
    new SecEdgarRequestError({
      kind: "network",
      message: `SEC EDGAR request failed for ${url}`,
      url,
    })
  );
}
