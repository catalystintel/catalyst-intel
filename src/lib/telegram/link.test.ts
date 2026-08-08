import { afterEach, describe, expect, it } from "vitest";

import { telegramDeepLinkForStart, telegramWebDeepLinkForStart } from "./link";

const originalPublicUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
const originalUsername = process.env.TELEGRAM_BOT_USERNAME;

afterEach(() => {
  if (originalPublicUsername === undefined) {
    delete process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  } else {
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = originalPublicUsername;
  }
  if (originalUsername === undefined) delete process.env.TELEGRAM_BOT_USERNAME;
  else process.env.TELEGRAM_BOT_USERNAME = originalUsername;
});

describe("telegram deep links", () => {
  it("builds t.me and web.telegram.org start links", () => {
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = "CatalystIntelBot";
    expect(telegramDeepLinkForStart("abc123")).toBe(
      "https://t.me/CatalystIntelBot?start=abc123",
    );
    const web = telegramWebDeepLinkForStart("abc123");
    expect(web).toContain("https://web.telegram.org/a/#?tgaddr=");
    expect(web).toContain(
      encodeURIComponent("tg://resolve?domain=CatalystIntelBot&start=abc123"),
    );
  });

  it("returns null without a bot username", () => {
    delete process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
    delete process.env.TELEGRAM_BOT_USERNAME;
    expect(telegramDeepLinkForStart("abc")).toBeNull();
    expect(telegramWebDeepLinkForStart("abc")).toBeNull();
  });
});
