import { describe, expect, it } from "vitest";

import {
  containsBlockedWireTrace,
  sanitizePrWireImageUrl,
  sanitizePrWirePublisher,
  sanitizePrWireText,
} from "./sanitize-pr-wire";

describe("sanitizePrWireText", () => {
  it("strips blocked host URLs and brand tokens", () => {
    const cleaned = sanitizePrWireText(
      "See https://rtpr.io/a/lseg_n1 for more — RTPR exclusive",
    );
    expect(cleaned).toMatch(/See for more/);
    expect(cleaned).toMatch(/exclusive/);
    expect(cleaned && containsBlockedWireTrace(cleaned)).toBe(false);
  });

  it("returns null for empty after sanitize", () => {
    expect(sanitizePrWireText("RTPR")).toBeNull();
  });
});

describe("sanitizePrWirePublisher", () => {
  it("maps aggregator brand to PR Wire", () => {
    expect(sanitizePrWirePublisher("RTPR")).toBe("PR Wire");
    expect(sanitizePrWirePublisher("Business Wire")).toBe("Business Wire");
  });
});

describe("sanitizePrWireImageUrl", () => {
  it("keeps third-party https images", () => {
    expect(sanitizePrWireImageUrl("https://cdn.example.com/a.jpg")).toBe(
      "https://cdn.example.com/a.jpg",
    );
  });

  it("drops blocked-host images", () => {
    expect(sanitizePrWireImageUrl("https://cdn.rtpr.io/x.jpg")).toBeNull();
  });
});
