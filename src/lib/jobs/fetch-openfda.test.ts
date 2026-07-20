import { describe, expect, it } from "vitest";

import {
  parseOpenFdaDate,
  pickRecentApprovedSubmission,
} from "./fetch-openfda";

describe("parseOpenFdaDate", () => {
  it("parses YYYYMMDD from openFDA", () => {
    expect(parseOpenFdaDate("20241023")).toBe("2024-10-23");
    expect(parseOpenFdaDate("20020802")).toBe("2002-08-02");
  });

  it("accepts already-ISO dates", () => {
    expect(parseOpenFdaDate("2024-10-23")).toBe("2024-10-23");
    expect(parseOpenFdaDate("2024-10-23T12:00:00Z")).toBe("2024-10-23");
  });

  it("returns null for empty or invalid values", () => {
    expect(parseOpenFdaDate(null)).toBeNull();
    expect(parseOpenFdaDate("")).toBeNull();
    expect(parseOpenFdaDate("not-a-date")).toBeNull();
  });
});

describe("pickRecentApprovedSubmission", () => {
  const now = new Date("2026-07-20T12:00:00.000Z");

  it("skips AP submissions older than the retention window", () => {
    const picked = pickRecentApprovedSubmission(
      [
        {
          submission_type: "ORIG",
          submission_status: "AP",
          submission_status_date: "20241023",
        },
        {
          submission_type: "SUPPL",
          submission_status: "AP",
          submission_status_date: "20200101",
        },
      ],
      { now },
    );
    expect(picked).toBeNull();
  });

  it("prefers newest in-window AP; ORIG wins same-day ties", () => {
    const newest = pickRecentApprovedSubmission(
      [
        {
          submission_type: "SUPPL",
          submission_status: "AP",
          submission_status_date: "20260716",
          submission_class_code: "LABELING",
        },
        {
          submission_type: "ORIG",
          submission_status: "AP",
          submission_status_date: "20260601",
        },
      ],
      { now },
    );
    expect(newest?.dateYmd).toBe("2026-07-16");
    expect(newest?.submission.submission_type).toBe("SUPPL");

    const tied = pickRecentApprovedSubmission(
      [
        {
          submission_type: "SUPPL",
          submission_status: "AP",
          submission_status_date: "20260716",
        },
        {
          submission_type: "ORIG",
          submission_status: "AP",
          submission_status_date: "20260716",
        },
      ],
      { now },
    );
    expect(tied?.submission.submission_type).toBe("ORIG");
  });

  it("falls back to newest in-window AP when no ORIG", () => {
    const picked = pickRecentApprovedSubmission(
      [
        {
          submission_type: "SUPPL",
          submission_status: "AP",
          submission_status_date: "20260501",
        },
        {
          submission_type: "SUPPL",
          submission_status: "AP",
          submission_status_date: "20260710",
        },
      ],
      { now },
    );
    expect(picked?.dateYmd).toBe("2026-07-10");
  });
});
