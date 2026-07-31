import { describe, expect, it } from "vitest";

import {
  assertWebhookUrlSafeForFetch,
  validateWebhookUrl,
} from "./webhook-url";

describe("validateWebhookUrl", () => {
  it("accepts public https URLs", () => {
    const result = validateWebhookUrl("https://hooks.example.com/alert");
    expect(result).toEqual({
      ok: true,
      url: "https://hooks.example.com/alert",
    });
  });

  it("rejects http", () => {
    const result = validateWebhookUrl("http://hooks.example.com/alert");
    expect(result.ok).toBe(false);
  });

  it("rejects localhost and private IPs", () => {
    for (const url of [
      "https://localhost/hook",
      "https://127.0.0.1/hook",
      "https://10.0.0.5/hook",
      "https://192.168.1.1/hook",
      "https://172.16.0.1/hook",
      "https://169.254.169.254/latest/meta-data/",
      "https://[::1]/hook",
      "https://[::ffff:127.0.0.1]/hook",
      "https://[::ffff:7f00:1]/hook",
      "https://[::ffff:0:7f00:1]/hook",
      "https://[::ffff:a9fe:a9fe]/hook",
    ]) {
      const result = validateWebhookUrl(url);
      expect(result.ok, url).toBe(false);
    }
  });

  it("rejects embedded credentials", () => {
    const result = validateWebhookUrl("https://user:pass@hooks.example.com/h");
    expect(result.ok).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(validateWebhookUrl("not a url").ok).toBe(false);
    expect(validateWebhookUrl("").ok).toBe(false);
  });
});

describe("assertWebhookUrlSafeForFetch", () => {
  it("rejects hostnames that resolve to loopback", async () => {
    const result = await assertWebhookUrlSafeForFetch(
      "https://localtest.me/hook",
      async () => [{ address: "127.0.0.1", family: 4 }],
    );
    expect(result.ok).toBe(false);
  });

  it("rejects hostnames that resolve to IPv4-mapped loopback", async () => {
    const result = await assertWebhookUrlSafeForFetch(
      "https://evil.example/hook",
      async () => [{ address: "::ffff:7f00:1", family: 6 }],
    );
    expect(result.ok).toBe(false);
  });

  it("accepts hostnames that resolve to public IPs", async () => {
    const result = await assertWebhookUrlSafeForFetch(
      "https://example.com/hook",
      async () => [{ address: "93.184.216.34", family: 4 }],
    );
    expect(result).toEqual({
      ok: true,
      url: "https://example.com/hook",
    });
  });

  it("still rejects private literals without DNS", async () => {
    const result = await assertWebhookUrlSafeForFetch(
      "https://[::ffff:7f00:1]/hook",
    );
    expect(result.ok).toBe(false);
  });
});
