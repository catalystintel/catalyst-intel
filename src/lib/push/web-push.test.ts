import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendNotification = vi.fn();
const setVapidDetails = vi.fn();

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
    sendNotification: (...args: unknown[]) => sendNotification(...args),
  },
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  sendNotification.mockReset();
  setVapidDetails.mockReset();
  process.env.WEB_PUSH_VAPID_PUBLIC_KEY = "pub";
  process.env.WEB_PUSH_VAPID_PRIVATE_KEY = "priv";
  process.env.WEB_PUSH_CONTACT_EMAIL = "support@example.com";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("isWebPushConfigured", () => {
  it("requires both VAPID keys", async () => {
    const { isWebPushConfigured } = await import("./web-push");
    expect(isWebPushConfigured()).toBe(true);
    delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    expect(isWebPushConfigured()).toBe(false);
  });
});

describe("sendWebPush", () => {
  const subscription = {
    endpoint: "https://push.example/1",
    p256dh: "p",
    auth: "a",
  };

  it("fails clearly when VAPID keys are missing", async () => {
    delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    const { sendWebPush } = await import("./web-push");
    const result = await sendWebPush(subscription, {
      title: "t",
      body: "b",
    });
    expect(result.ok).toBe(false);
    expect(result.detail.toLowerCase()).toContain("not available");
  });

  it("sends via web-push and reports success", async () => {
    sendNotification.mockResolvedValue(undefined);
    const { sendWebPush } = await import("./web-push");
    const result = await sendWebPush(subscription, { title: "t", body: "b" });
    expect(result.ok).toBe(true);
    expect(sendNotification).toHaveBeenCalledWith(
      { endpoint: subscription.endpoint, keys: { p256dh: "p", auth: "a" } },
      expect.any(String),
    );
  });

  it("flags gone subscriptions on 404/410", async () => {
    sendNotification.mockRejectedValue(
      Object.assign(new Error("Gone"), { statusCode: 410 }),
    );
    const { sendWebPush } = await import("./web-push");
    const result = await sendWebPush(subscription, { title: "t", body: "b" });
    expect(result.ok).toBe(false);
    expect(result.gone).toBe(true);
  });
});
