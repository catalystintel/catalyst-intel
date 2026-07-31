import { afterEach, describe, expect, it } from "vitest";

import {
  readGuestSearchCount,
  writeGuestSearchCount,
} from "./guest-search-cookie";

describe("guest search cookie", () => {
  const originalGuest = process.env.GUEST_SEARCH_SECRET;
  const originalCron = process.env.CRON_SECRET;
  const originalAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  afterEach(() => {
    if (originalGuest === undefined) delete process.env.GUEST_SEARCH_SECRET;
    else process.env.GUEST_SEARCH_SECRET = originalGuest;
    if (originalCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCron;
    if (originalAnon === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnon;
    }
  });

  it("round-trips a signed count", () => {
    process.env.GUEST_SEARCH_SECRET = "test-secret";
    const value = writeGuestSearchCount(2);
    expect(readGuestSearchCount(value)).toBe(2);
  });

  it("rejects unsigned plain integers", () => {
    process.env.GUEST_SEARCH_SECRET = "test-secret";
    expect(readGuestSearchCount("2")).toBe(0);
    expect(readGuestSearchCount("0")).toBe(0);
  });

  it("rejects tampered macs", () => {
    process.env.GUEST_SEARCH_SECRET = "test-secret";
    const value = writeGuestSearchCount(1);
    const [payload] = value.split(".");
    expect(readGuestSearchCount(`${payload}.deadbeef`)).toBe(0);
  });
});
