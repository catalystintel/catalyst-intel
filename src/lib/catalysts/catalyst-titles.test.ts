import { describe, expect, it } from "vitest";

import {
  earningsDateForQuarterInference,
  earningsQuarterLabel,
  formatEarningsReportTitle,
  formatFdaApprovalTitle,
  formatHaltTitle,
  looksLikeResultsOfOperationsTitle,
  resolveDisplayCompanyName,
} from "./catalyst-titles";
import { haltReasonLabel } from "./halt-reason-codes";

describe("resolveDisplayCompanyName", () => {
  it("prefers the first non-empty candidate", () => {
    expect(resolveDisplayCompanyName(null, "  Apple Inc. ", "AAPL")).toBe(
      "Apple Inc.",
    );
  });

  it("falls back through ticker then Unknown company", () => {
    expect(resolveDisplayCompanyName(undefined, "", "AAPL")).toBe("AAPL");
    expect(resolveDisplayCompanyName(null, "  ")).toBe("Unknown company");
  });
});

describe("formatHaltTitle", () => {
  it("builds Halts (Company) — reason from a reason code", () => {
    expect(formatHaltTitle("Steakholder Foods Ltd. ADS", "T1")).toBe(
      "Halts (Steakholder Foods Ltd. ADS) — News pending",
    );
    expect(formatHaltTitle("Acme Corp", "LUDP")).toBe(
      "Halts (Acme Corp) — Volatility trading pause (LULD)",
    );
  });

  it("never leaves empty parentheses when the name is missing", () => {
    expect(formatHaltTitle(null, "T12")).toBe(
      "Halts (Unknown company) — Additional information requested",
    );
    expect(formatHaltTitle("STKH", "T1")).toBe("Halts (STKH) — News pending");
  });

  it("accepts a pre-resolved reason label", () => {
    expect(
      formatHaltTitle("PMI", "Regulatory concern", { reasonIsLabel: true }),
    ).toBe("Halts (PMI) — Regulatory concern");
  });
});

describe("haltReasonLabel", () => {
  it("maps common Nasdaq codes", () => {
    expect(haltReasonLabel("t1")).toBe("News pending");
    expect(haltReasonLabel("H11")).toBe("Regulatory concern");
    expect(haltReasonLabel("UNKNOWN99")).toBe("Reason code UNKNOWN99");
    expect(haltReasonLabel(null)).toBe("Reason unavailable");
  });
});

describe("formatFdaApprovalTitle", () => {
  it("uses the sponsor / company name", () => {
    expect(formatFdaApprovalTitle("Pfizer Inc")).toBe(
      "FDA Approval - Pfizer Inc",
    );
  });

  it("falls back when sponsor is missing", () => {
    expect(formatFdaApprovalTitle(null)).toBe("FDA Approval - Unknown company");
    expect(formatFdaApprovalTitle("PFE")).toBe("FDA Approval - PFE");
  });
});

describe("earningsQuarterLabel + formatEarningsReportTitle", () => {
  it("prefers the explicit Finnhub quarter field", () => {
    expect(earningsQuarterLabel(1, "2026-07-25")).toBe("Q1");
    expect(earningsQuarterLabel(3, null)).toBe("Q3");
  });

  it("derives quarter from the earnings date when quarter is absent", () => {
    expect(earningsQuarterLabel(null, "2026-01-15")).toBe("Q1");
    expect(earningsQuarterLabel(undefined, "2026-04-30")).toBe("Q2");
    expect(earningsQuarterLabel(null, "2026-08-01")).toBe("Q3");
    expect(earningsQuarterLabel(null, "2026-11-20")).toBe("Q4");
  });

  it("formats Earnings Report Qn - Company Name", () => {
    expect(formatEarningsReportTitle("Q1", "Apple Inc.")).toBe(
      "Earnings Report Q1 - Apple Inc.",
    );
    expect(
      formatEarningsReportTitle(
        earningsQuarterLabel(2, "2026-04-01"),
        "Microsoft Corporation",
      ),
    ).toBe("Earnings Report Q2 - Microsoft Corporation");
  });

  it("falls back to ticker / Unknown company, not a bare empty name", () => {
    expect(formatEarningsReportTitle("Q4", "AAPL")).toBe(
      "Earnings Report Q4 - AAPL",
    );
    expect(formatEarningsReportTitle("Q1", null)).toBe(
      "Earnings Report Q1 - Unknown company",
    );
  });

  it("infers a date from period end, Filed:, then timestamp", () => {
    expect(
      earningsDateForQuarterInference({
        periodEndYmd: "2026-03-31",
        summary: "Filed: 2026-07-24 AccNo: 1",
        timestamp: "2026-07-25T12:00:00.000Z",
      }),
    ).toBe("2026-03-31");

    expect(
      earningsDateForQuarterInference({
        summary:
          "For the quarter ended June 30, 2026. Filed: 2026-07-24 AccNo: 1",
        timestamp: "2026-07-25T12:00:00.000Z",
      }),
    ).toBe("2026-06-30");

    expect(
      earningsDateForQuarterInference({
        summary: "Filed: 2026-07-24 AccNo: 1",
        timestamp: "2026-07-25T12:00:00.000Z",
      }),
    ).toBe("2026-07-24");

    expect(
      earningsDateForQuarterInference({
        timestamp: "2026-11-02T08:00:00.000Z",
      }),
    ).toBe("2026-11-02");
  });

  it("detects Results of Operations wording", () => {
    expect(
      looksLikeResultsOfOperationsTitle(
        "Acme - Results of Operations and Financial Condition",
      ),
    ).toBe(true);
    expect(looksLikeResultsOfOperationsTitle("Guidance update")).toBe(false);
  });
});
