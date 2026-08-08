import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getTelegramChat = vi.fn();
const isTelegramConfigured = vi.fn();
const linkGet = vi.fn();

vi.mock("@/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          get: () => linkGet(),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/telegram/bot", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/telegram/bot")>(
      "@/lib/telegram/bot",
    );
  return {
    ...actual,
    getTelegramChat: (...args: unknown[]) => getTelegramChat(...args),
    isTelegramConfigured: (...args: unknown[]) => isTelegramConfigured(...args),
  };
});

import { probeTelegramLinkHealth } from "./link";

describe("probeTelegramLinkHealth", () => {
  beforeEach(() => {
    getTelegramChat.mockReset();
    isTelegramConfigured.mockReset();
    linkGet.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports bot_not_configured when token is missing", async () => {
    isTelegramConfigured.mockReturnValue(false);
    const health = await probeTelegramLinkHealth(1);
    expect(health.status).toBe("bot_not_configured");
    expect(health.linked).toBeNull();
    expect(getTelegramChat).not.toHaveBeenCalled();
  });

  it("reports not_linked when no row exists", async () => {
    isTelegramConfigured.mockReturnValue(true);
    linkGet.mockResolvedValue(undefined);
    const health = await probeTelegramLinkHealth(1);
    expect(health.status).toBe("not_linked");
    expect(health.linked).toBeNull();
  });

  it("reports live when getChat succeeds", async () => {
    isTelegramConfigured.mockReturnValue(true);
    linkGet.mockResolvedValue({
      id: 9,
      userId: 1,
      chatId: "1193066531",
      telegramUserId: "1193066531",
      username: "omer",
      mutedUntil: null,
      linkedAt: "2026-08-08T00:00:00.000Z",
    });
    getTelegramChat.mockResolvedValue({
      ok: true,
      detail: "getChat ok",
      chatType: "private",
    });
    const health = await probeTelegramLinkHealth(1);
    expect(health.status).toBe("live");
    expect(health.linked?.chatId).toBe("1193066531");
    expect(getTelegramChat).toHaveBeenCalledWith("1193066531");
  });

  it("reports unreachable when getChat fails", async () => {
    isTelegramConfigured.mockReturnValue(true);
    linkGet.mockResolvedValue({
      id: 9,
      userId: 1,
      chatId: "1193066531",
      telegramUserId: null,
      username: null,
      mutedUntil: null,
      linkedAt: "2026-08-08T00:00:00.000Z",
    });
    getTelegramChat.mockResolvedValue({
      ok: false,
      detail: "Bad Request: chat not found",
    });
    const health = await probeTelegramLinkHealth(1);
    expect(health.status).toBe("unreachable");
    expect(health.detail).toContain("chat not found");
    expect(health.linked?.chatId).toBe("1193066531");
  });
});
