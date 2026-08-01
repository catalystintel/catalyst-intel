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

  it("strips wire-house brands from body text", () => {
    const cleaned = sanitizePrWireText(
      "AUBURN HILLS /PRNewswire/ -- Company announced a deal. Business Wire also covered it.",
    );
    expect(cleaned).not.toMatch(/PRNewswire|Business Wire/i);
    expect(cleaned).toMatch(/Company announced/);
  });

  it("returns null for empty after sanitize", () => {
    expect(sanitizePrWireText("RTPR")).toBeNull();
  });
});

describe("sanitizePrWirePublisher", () => {
  it("never returns a wire-house or aggregator byline", () => {
    expect(sanitizePrWirePublisher("RTPR")).toBeNull();
    expect(sanitizePrWirePublisher("Business Wire")).toBeNull();
    expect(sanitizePrWirePublisher("PR Newswire")).toBeNull();
    expect(sanitizePrWirePublisher("PR Wire")).toBeNull();
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
