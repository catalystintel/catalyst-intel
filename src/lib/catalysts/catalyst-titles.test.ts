import { describe, expect, it } from "vitest";

import {
  earningsDateForQuarterInference,
  earningsQuarterLabel,
  format425MergerTitle,
  formatAnalystRatingTitle,
  formatBankruptcyFilingTitle,
  formatClinicalTrialTitle,
  formatCpiTitle,
  formatDelistingRiskTitle,
  formatEarningsReportTitle,
  formatFdaApprovalTitle,
  formatFomcRateDecisionTitle,
  formatForm4InsiderTitle,
  formatHaltTitle,
  formatJobsReportTitle,
  formatMaterialAgreementTitle,
  formatOfficerDirectorChangeTitle,
  formatPriceTargetTitle,
  formatProspectusOfferingTitle,
  formatSchedule13DTitle,
  formatSchedule13GTitle,
  formatSec8kItemTitle,
  formatShelfRegistrationTitle,
  form4TitleKindFromSubcategory,
  looksLikeOfficerDirectorChangeTitle,
  looksLikeResultsOfOperationsTitle,
  resolveDisplayCompanyName,
  titleCaseEventLabel,
} from "./catalyst-titles";
import { haltReasonLabel } from "./halt-reason-codes";

describe("resolveDisplayCompanyName", () => {
  it("prefers the first non-empty candidate", () => {
    expect(resolveDisplayCompanyName(null, "  Apple Inc. ", "AAPL")).toBe(
      "Apple Inc.",
    );
  });

  it("falls back through symbol then Unknown company", () => {
    expect(resolveDisplayCompanyName(undefined, "", "AAPL")).toBe("AAPL");
    expect(resolveDisplayCompanyName(null, "  ")).toBe("Unknown company");
  });
});

describe("formatHaltTitle", () => {
  it("builds Halts (Company) - reason from a reason code", () => {
    expect(formatHaltTitle("Steakholder Foods Ltd. ADS", "T1")).toBe(
      "Halts (Steakholder Foods Ltd. ADS) - News pending",
    );
    expect(formatHaltTitle("Acme Corp", "LUDP")).toBe(
      "Halts (Acme Corp) - Volatility trading pause (LULD)",
    );
  });

  it("never leaves empty parentheses when the name is missing", () => {
    expect(formatHaltTitle(null, "T12")).toBe(
      "Halts (Unknown company) - Additional information requested",
    );
    expect(formatHaltTitle("STKH", "T1")).toBe("Halts (STKH) - News pending");
  });

  it("accepts a pre-resolved reason label", () => {
    expect(
      formatHaltTitle("PMI", "Regulatory concern", { reasonIsLabel: true }),
    ).toBe("Halts (PMI) - Regulatory concern");
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
      "Pfizer Inc Receives FDA Approval!",
    );
  });

  it("falls back when sponsor is missing", () => {
    expect(formatFdaApprovalTitle(null)).toBe(
      "Unknown company Receives FDA Approval!",
    );
    expect(formatFdaApprovalTitle("PFE")).toBe("PFE Receives FDA Approval!");
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

  it("formats Company - Earnings Report Qn", () => {
    expect(formatEarningsReportTitle("Q1", "Apple Inc.")).toBe(
      "Apple Inc. - Earnings Report Q1",
    );
    expect(
      formatEarningsReportTitle(
        earningsQuarterLabel(2, "2026-04-01"),
        "Microsoft Corporation",
      ),
    ).toBe("Microsoft Corporation - Earnings Report Q2");
  });

  it("falls back to symbol / Unknown company, not a bare empty name", () => {
    expect(formatEarningsReportTitle("Q4", "AAPL")).toBe(
      "AAPL - Earnings Report Q4",
    );
    expect(formatEarningsReportTitle("Q1", null)).toBe(
      "Unknown company - Earnings Report Q1",
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

describe("formatSec8kItemTitle / formatForm4InsiderTitle", () => {
  it("builds narrative titles for high-signal 8-K items", () => {
    expect(formatSec8kItemTitle("Material agreement", "PEDEVCO CORP")).toBe(
      "PEDEVCO CORP - New Deal Announced (Major Contract or Partnership)",
    );
    expect(formatSec8kItemTitle("Officer / director change", "Acme Corp")).toBe(
      "Acme Corp - Executive Change",
    );
    expect(
      formatSec8kItemTitle("Officer / director change", "Acme Corp", {
        content:
          "On July 20, 2026, Jane Smith resigned as Chief Executive Officer.",
      }),
    ).toBe("Acme Corp - CEO Change (Departure)");
    expect(formatSec8kItemTitle("Delisting risk", "Quantum-Si Inc")).toBe(
      "Quantum-Si Inc - Delisting Risk (Stock Could Lose Its Listing)",
    );
    expect(formatSec8kItemTitle("Bankruptcy / receivership", "Acme Corp")).toBe(
      "Acme Corp - Bankruptcy Filing (Equity at Risk)",
    );
    expect(formatMaterialAgreementTitle("Acme Corp")).toBe(
      "Acme Corp - New Deal Announced (Major Contract or Partnership)",
    );
    expect(formatBankruptcyFilingTitle("Acme Corp")).toBe(
      "Acme Corp - Bankruptcy Filing (Equity at Risk)",
    );
    expect(formatDelistingRiskTitle("Acme Corp")).toBe(
      "Acme Corp - Delisting Risk (Stock Could Lose Its Listing)",
    );
    expect(formatOfficerDirectorChangeTitle("Acme Corp")).toBe(
      "Acme Corp - Executive Change",
    );
    expect(
      formatOfficerDirectorChangeTitle("Acme Corp", {
        content: "The Board appointed Robert Lee as Chief Financial Officer.",
      }),
    ).toBe("Acme Corp - CFO Change (Appointment)");
    expect(
      formatOfficerDirectorChangeTitle("Acme Corp", {
        content: "A senior officer of the Company resigned effective today.",
      }),
    ).toBe("Acme Corp - Executive Change (Departure)");
    expect(
      looksLikeOfficerDirectorChangeTitle(
        "Acme Corp — Executive Change — CEO/CFO Departure or Appointment",
      ),
    ).toBe(true);
    expect(
      looksLikeOfficerDirectorChangeTitle("Acme Corp: CEO Change (Departure)"),
    ).toBe(true);
    expect(
      looksLikeOfficerDirectorChangeTitle("Acme Corp - CEO Change (Departure)"),
    ).toBe(true);
  });

  it("keeps `{Company} - {Label}` for other 8-K items", () => {
    expect(formatSec8kItemTitle("Change of control", "Acme Corp")).toBe(
      "Acme Corp - Change of Control",
    );
    expect(formatSec8kItemTitle(null, null)).toBe(
      "Unknown company - 8-K Event",
    );
  });

  it("title-cases event labels without ugly double dashes", () => {
    expect(titleCaseEventLabel("Material cybersecurity incident")).toBe(
      "Material Cybersecurity Incident",
    );
    expect(titleCaseEventLabel("Financials non-reliance")).toBe(
      "Financials Non-Reliance",
    );
    expect(titleCaseEventLabel("Reg FD disclosure")).toBe("Reg FD Disclosure");
  });

  it("builds Form 4 buy/sell/mixed titles", () => {
    expect(formatForm4InsiderTitle("buy", "Tesla, Inc.")).toBe(
      "Tesla, Inc. - Form 4 Insider Buy",
    );
    expect(formatForm4InsiderTitle("sell", "Nvidia Corporation")).toBe(
      "Nvidia Corporation - Form 4 Insider Sell",
    );
    expect(formatForm4InsiderTitle("mixed", "Acme Corp")).toBe(
      "Acme Corp - Form 4 Insider Buy & Sell",
    );
    expect(form4TitleKindFromSubcategory("insider_buy")).toBe("buy");
    expect(form4TitleKindFromSubcategory("form4_mixed")).toBe("mixed");
  });
});

describe("offering / ownership / clinical / macro / analyst titles", () => {
  it("formats S-3 / 424B / 425 / 13D / 13G ground-rule titles", () => {
    expect(formatShelfRegistrationTitle("Acme Corp")).toBe(
      "Acme Corp - Shelf Registration (S-3)",
    );
    expect(formatProspectusOfferingTitle("Acme Corp")).toBe(
      "Acme Corp - New Stock Offering Filed (Potential Dilution Ahead)",
    );
    expect(format425MergerTitle("Acme Corp")).toBe(
      "Acme Corp Announces Acquisition — Deal in Play",
    );
    expect(formatSchedule13DTitle("Acme Corp")).toBe(
      "Acme Corp - Schedule 13D",
    );
    expect(formatSchedule13GTitle("Acme Corp")).toBe(
      "Acme Corp - Schedule 13G",
    );
  });

  it("formats clinical / macro / analyst ground-rule titles", () => {
    expect(formatClinicalTrialTitle("Pfizer Inc")).toBe(
      "Pfizer Inc - Clinical Trial",
    );
    expect(formatCpiTitle("July 2026")).toBe("CPI — July 2026");
    expect(formatJobsReportTitle("July 2026")).toBe(
      "Jobs Report (NFP) — July 2026",
    );
    expect(formatFomcRateDecisionTitle()).toBe("FOMC Rate Decision");
    expect(formatPriceTargetTitle("Apple Inc.")).toBe(
      "Apple Inc. - Price Target",
    );
    expect(formatAnalystRatingTitle("NVDA")).toBe("NVDA - Analyst Rating");
  });
});
