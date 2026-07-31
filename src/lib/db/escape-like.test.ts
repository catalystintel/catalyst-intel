import { describe, expect, it } from "vitest";

import { escapeLike } from "./escape-like";

describe("escapeLike", () => {
  it("escapes percent, underscore, and backslash", () => {
    expect(escapeLike("100%_ready\\go")).toBe("100\\%\\_ready\\\\go");
  });

  it("leaves plain text alone", () => {
    expect(escapeLike("AAPL")).toBe("AAPL");
  });
});
