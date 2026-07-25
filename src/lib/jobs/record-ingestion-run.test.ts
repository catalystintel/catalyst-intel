import { describe, expect, it } from "vitest";

import type { SourceFetchResult } from "@/lib/jobs/ingest-pipeline";
import {
  deriveIngestionRunStatus,
  toSourceSnapshots,
} from "@/lib/jobs/record-ingestion-run";

function source(
  overrides: Partial<SourceFetchResult> & Pick<SourceFetchResult, "source">,
): SourceFetchResult {
  return {
    configured: true,
    status: "ok",
    fetched: 1,
    inserted: 0,
    skipped: 1,
    errors: 0,
    ranAt: "2026-07-24T00:00:00.000Z",
    purgedCatalysts: 0,
    purgedRawSources: 0,
    ...overrides,
  };
}

describe("deriveIngestionRunStatus", () => {
  it("returns ok when all configured sources succeed", () => {
    expect(
      deriveIngestionRunStatus(
        [source({ source: "sec-edgar" }), source({ source: "nasdaq-halts" })],
        { fetched: 2, inserted: 0, skipped: 2, errors: 0 },
      ),
    ).toBe("ok");
  });

  it("returns partial when some configured sources error", () => {
    expect(
      deriveIngestionRunStatus(
        [
          source({ source: "sec-edgar" }),
          source({ source: "finnhub", status: "error", errors: 1 }),
        ],
        { fetched: 1, inserted: 0, skipped: 0, errors: 1 },
      ),
    ).toBe("partial");
  });

  it("returns failed when every configured source errors", () => {
    expect(
      deriveIngestionRunStatus(
        [
          source({ source: "sec-edgar", status: "error", errors: 1 }),
          source({ source: "nasdaq-halts", status: "error", errors: 1 }),
        ],
        { fetched: 0, inserted: 0, skipped: 0, errors: 2 },
      ),
    ).toBe("failed");
  });

  it("ignores unconfigured skipped sources when deciding failed", () => {
    expect(
      deriveIngestionRunStatus(
        [
          source({ source: "sec-edgar", status: "error", errors: 1 }),
          source({
            source: "finnhub",
            configured: false,
            status: "skipped",
            message: "no key",
          }),
        ],
        { fetched: 0, inserted: 0, skipped: 0, errors: 1 },
      ),
    ).toBe("failed");
  });
});

describe("toSourceSnapshots", () => {
  it("omits message when absent", () => {
    expect(toSourceSnapshots([source({ source: "openfda" })])).toEqual([
      {
        source: "openfda",
        configured: true,
        status: "ok",
        fetched: 1,
        inserted: 0,
        skipped: 1,
        errors: 0,
      },
    ]);
  });

  it("includes message when present", () => {
    expect(
      toSourceSnapshots([
        source({
          source: "finnhub",
          configured: false,
          status: "skipped",
          message: "no key",
        }),
      ])[0]?.message,
    ).toBe("no key");
  });
});
