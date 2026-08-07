import { describe, expect, it } from "vitest";

import {
  deriveNotificationSettings,
  parseNotificationSettingsBody,
} from "./settings-model";

describe("deriveNotificationSettings", () => {
  it("unions watchlists from enabled channel rules", () => {
    const settings = deriveNotificationSettings([
      {
        channel: "push",
        enabled: true,
        conditions: { watchlistIds: [2, 1] },
      },
      {
        channel: "telegram",
        enabled: true,
        conditions: { watchlistIds: [1, 3] },
      },
      {
        channel: "email",
        enabled: false,
        conditions: { watchlistIds: [9] },
      },
    ]);
    expect(settings.channels).toEqual({
      push: true,
      telegram: true,
      email: false,
    });
    expect(settings.watchlistIds).toEqual([1, 2, 3]);
  });
});

describe("parseNotificationSettingsBody", () => {
  it("requires watchlists when a method is on", () => {
    const parsed = parseNotificationSettingsBody({
      channels: { push: true, telegram: false, email: false },
      watchlistIds: [],
    });
    expect(parsed.ok).toBe(false);
  });

  it("allows everything off", () => {
    const parsed = parseNotificationSettingsBody({
      channels: { push: false, telegram: false, email: false },
      watchlistIds: [],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.settings.channels.push).toBe(false);
    }
  });
});
