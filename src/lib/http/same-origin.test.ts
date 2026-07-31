import { describe, expect, it } from "vitest";

import { isSameOriginRequest } from "./same-origin";

function req(headers: Record<string, string>): Request {
  return new Request("https://app.example/api/x", {
    method: "POST",
    headers,
  });
}

describe("isSameOriginRequest", () => {
  it("accepts matching Origin", () => {
    expect(
      isSameOriginRequest(
        req({
          origin: "https://app.example",
          host: "app.example",
        }),
      ),
    ).toBe(true);
  });

  it("rejects mismatched Origin", () => {
    expect(
      isSameOriginRequest(
        req({
          origin: "https://evil.example",
          host: "app.example",
        }),
      ),
    ).toBe(false);
  });

  it("accepts same-origin Sec-Fetch-Site without Origin", () => {
    expect(
      isSameOriginRequest(
        req({
          host: "app.example",
          "sec-fetch-site": "same-origin",
        }),
      ),
    ).toBe(true);
  });

  it("rejects cross-site Sec-Fetch-Site without Origin", () => {
    expect(
      isSameOriginRequest(
        req({
          host: "app.example",
          "sec-fetch-site": "cross-site",
        }),
      ),
    ).toBe(false);
  });
});
