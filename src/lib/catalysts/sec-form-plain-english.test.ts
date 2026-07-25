import { describe, expect, it } from "vitest";

import {
  plainEnglishForSecForm,
  shortSecFormLabel,
} from "./sec-form-plain-english";

describe("plainEnglishForSecForm", () => {
  it("explains 424B without calling it simple equity dilution", () => {
    const text = plainEnglishForSecForm("424B2");
    expect(text).toMatch(/structured note|prospectus supplement/i);
    expect(text).not.toMatch(/dilution/i);
  });

  it("explains S-3 shelf", () => {
    expect(plainEnglishForSecForm("S-3/A")).toMatch(/shelf/i);
  });

  it("explains Form 4", () => {
    expect(plainEnglishForSecForm("4")).toMatch(/insider/i);
  });
});

describe("shortSecFormLabel", () => {
  it("returns short labels", () => {
    expect(shortSecFormLabel("424B3")).toMatch(/Pricing supplement/i);
    expect(shortSecFormLabel("8-K")).toMatch(/8-K/);
  });
});
