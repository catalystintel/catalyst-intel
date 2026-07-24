import { describe, expect, it } from "vitest";

import { validateWebhookUrl } from "./webhook-url";

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
