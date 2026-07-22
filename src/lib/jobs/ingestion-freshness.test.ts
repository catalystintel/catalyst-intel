import { beforeEach, describe, expect, it } from "vitest";

import {
  markRefetchCompleted,
  markRefetchFailed,
  markRefetchTriggered,
  resetIngestionFreshnessStore,
  shouldTriggerBackgroundRefetch,
} from "./ingestion-freshness";

describe("shouldTriggerBackgroundRefetch", () => {
  beforeEach(() => {
    resetIngestionFreshnessStore();
  });

  it("triggers when the database has never been populated", () => {
    expect(
      shouldTriggerBackgroundRefetch({ lastFetchedAt: null, now: 1_000 }),
    ).toBe(true);
  });

  it("triggers when the last fetch is older than the stale threshold", () => {
    const now = 20 * 60_000;
    const lastFetchedAt = new Date(now - 5 * 60_000);
    expect(shouldTriggerBackgroundRefetch({ lastFetchedAt, now })).toBe(true);
  });

  it("does not trigger when the last fetch is within the stale threshold", () => {
    const now = 20 * 60_000;
    const lastFetchedAt = new Date(now - 2 * 60_000);
    expect(shouldTriggerBackgroundRefetch({ lastFetchedAt, now })).toBe(false);
  });

  it("does not retrigger again within the cooldown window", () => {
    const now = 20 * 60_000;
    const lastFetchedAt = new Date(now - 5 * 60_000);
    markRefetchTriggered(now);

    expect(
      shouldTriggerBackgroundRefetch({
        lastFetchedAt,
        now: now + 60_000,
      }),
    ).toBe(false);
  });

  it("allows retriggering once the cooldown window has elapsed", () => {
    const now = 20 * 60_000;
    const lastFetchedAt = new Date(now - 5 * 60_000);
    markRefetchTriggered(now);
    markRefetchCompleted();

    expect(
      shouldTriggerBackgroundRefetch({
        lastFetchedAt,
        now: now + 4 * 60_000,
      }),
    ).toBe(true);
  });

  it("suppresses concurrent triggers while a refetch is in flight", () => {
    const now = 20 * 60_000;
    const lastFetchedAt = new Date(now - 5 * 60_000);
    markRefetchTriggered(now);

    expect(
      shouldTriggerBackgroundRefetch({
        lastFetchedAt,
        now: now + 4 * 60_000,
      }),
    ).toBe(false);

    markRefetchCompleted();
    expect(
      shouldTriggerBackgroundRefetch({
        lastFetchedAt,
        now: now + 4 * 60_000,
      }),
    ).toBe(true);
  });

  it("applies a longer cooldown after a failed background refetch", () => {
    const now = 20 * 60_000;
    const lastFetchedAt = new Date(now - 5 * 60_000);
    markRefetchTriggered(now);
    markRefetchFailed(now);

    expect(
      shouldTriggerBackgroundRefetch({
        lastFetchedAt,
        now: now + 4 * 60_000,
      }),
    ).toBe(false);

    expect(
      shouldTriggerBackgroundRefetch({
        lastFetchedAt,
        now: now + 11 * 60_000,
      }),
    ).toBe(true);
  });
});
