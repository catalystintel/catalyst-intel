import { describe, expect, it } from "vitest";

import { getRequestOrigin, safeNextPath } from "./origin";

describe("getRequestOrigin", () => {
  it("prefers the Origin header", () => {
    const headers = new Headers({ origin: "http://localhost:3000" });
    expect(getRequestOrigin(headers)).toBe("http://localhost:3000");
  });

  it("uses http for localhost when Origin is missing", () => {
    const headers = new Headers({ host: "localhost:3000" });
    expect(getRequestOrigin(headers)).toBe("http://localhost:3000");
  });

  it("uses https for non-local hosts when Origin is missing", () => {
    const headers = new Headers({ host: "catalyst-intel.vercel.app" });
    expect(getRequestOrigin(headers)).toBe("https://catalyst-intel.vercel.app");
  });
});

describe("safeNextPath", () => {
  it("allows relative app paths", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
  });

  it("rejects open redirects", () => {
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
  });
});
