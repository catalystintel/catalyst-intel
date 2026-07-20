import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SecEdgarRequestError,
  classifySecFetchFailure,
  fetchSecUrl,
  formatSecFetchError,
  getSecUserAgent,
} from "./sec-edgar-http";

const URL = "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.SEC_EDGAR_USER_AGENT;
});

describe("getSecUserAgent", () => {
  it("returns the trimmed env value", () => {
    process.env.SEC_EDGAR_USER_AGENT = "  you@email.com CatalystIntel/0.1  ";
    expect(getSecUserAgent()).toBe("you@email.com CatalystIntel/0.1");
  });

  it("throws a config error when unset", () => {
    expect(() => getSecUserAgent()).toThrow(SecEdgarRequestError);
    try {
      getSecUserAgent();
    } catch (error) {
      expect(error).toMatchObject({ kind: "config" });
    }
  });
});

describe("classifySecFetchFailure", () => {
  it("classifies AbortError / TimeoutError as timeout", () => {
    const abort = new Error("The operation was aborted");
    abort.name = "TimeoutError";
    expect(classifySecFetchFailure(abort, URL).kind).toBe("timeout");
  });

  it("classifies ETIMEDOUT cause as timeout", () => {
    const err = new TypeError("fetch failed");
    (err as Error & { cause: Error }).cause = new Error(
      "connect ETIMEDOUT 23.204.211.209:443",
    );
    const classified = classifySecFetchFailure(err, URL);
    expect(classified.kind).toBe("timeout");
    expect(classified.message).toContain(URL);
  });

  it("classifies other fetch failures as network", () => {
    const err = new TypeError("fetch failed");
    (err as Error & { cause: Error }).cause = new Error("ECONNREFUSED");
    expect(classifySecFetchFailure(err, URL).kind).toBe("network");
  });
});

describe("formatSecFetchError", () => {
  it("includes kind and status for SecEdgarRequestError", () => {
    const error = new SecEdgarRequestError({
      kind: "http",
      message: "blocked",
      url: URL,
      status: 403,
    });
    expect(formatSecFetchError(error)).toBe("[http status=403] blocked");
  });
});

describe("fetchSecUrl", () => {
  it("sets User-Agent and returns an ok response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("<feed/>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchSecUrl(URL, {
      userAgent: "you@email.com CatalystIntel/0.1",
      mode: "primary",
      retries: 0,
    });

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({
      "User-Agent": "you@email.com CatalystIntel/0.1",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("retries retryable HTTP failures then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("nope", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchSecUrl(URL, {
      userAgent: "ua",
      mode: "background",
      retries: 1,
      timeoutMs: 5_000,
    });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry 403 auth blocks", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("forbidden", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchSecUrl(URL, { userAgent: "ua", retries: 2 }),
    ).rejects.toMatchObject({ kind: "http", status: 403 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("retries timeouts then throws a classified timeout error", async () => {
    const abort = new Error("The operation was aborted due to timeout");
    abort.name = "TimeoutError";
    const fetchMock = vi.fn().mockRejectedValue(abort);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchSecUrl(URL, {
        userAgent: "ua",
        mode: "background",
        retries: 1,
        timeoutMs: 50,
      }),
    ).rejects.toMatchObject({ kind: "timeout" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
