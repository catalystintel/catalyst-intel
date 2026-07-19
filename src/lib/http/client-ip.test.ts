import { describe, expect, it } from "vitest";

import { getClientIp } from "./client-ip";

function requestWith(headers: Record<string, string>) {
  return {
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? null;
      },
    },
  } as unknown as import("next/server").NextRequest;
}

describe("getClientIp", () => {
  it("uses the first x-forwarded-for hop", () => {
    expect(
      getClientIp(requestWith({ "x-forwarded-for": "203.0.113.10, 10.0.0.1" })),
    ).toBe("203.0.113.10");
  });

  it("falls back to x-real-ip", () => {
    expect(getClientIp(requestWith({ "x-real-ip": "198.51.100.2" }))).toBe(
      "198.51.100.2",
    );
  });

  it("returns unknown when no IP headers exist", () => {
    expect(getClientIp(requestWith({}))).toBe("unknown");
  });
});
