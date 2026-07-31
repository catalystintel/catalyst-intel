import { describe, expect, it } from "vitest";

import {
  USER_FACING,
  looksLikeOpsMessage,
  scrubEnvNamesFromMessage,
  toUserFacingMessage,
} from "./user-facing";

describe("looksLikeOpsMessage", () => {
  it("flags env vars and infra keywords", () => {
    expect(looksLikeOpsMessage("Set LIBSQL_URL in Vercel")).toBe(true);
    expect(looksLikeOpsMessage("Run npm run db:migrate")).toBe(true);
    expect(looksLikeOpsMessage("Turso BLOCKED")).toBe(true);
    expect(
      looksLikeOpsMessage("FINNHUB_API_KEY is not set. Add it to enable…"),
    ).toBe(true);
    expect(looksLikeOpsMessage("needs POLYGON_API_KEY")).toBe(true);
  });

  it("allows polished product copy", () => {
    expect(looksLikeOpsMessage("Could not add AAPL to watchlist")).toBe(false);
    expect(looksLikeOpsMessage(USER_FACING.database)).toBe(false);
    expect(
      looksLikeOpsMessage(
        "Finnhub is not configured. Add credentials to enable NYSE listings.",
      ),
    ).toBe(false);
  });
});

describe("scrubEnvNamesFromMessage", () => {
  it("replaces vendor env token names with credentials", () => {
    expect(
      scrubEnvNamesFromMessage(
        "Add FINNHUB_API_KEY or POLYGON_API_KEY in hosting",
      ),
    ).toBe("Add credentials or credentials in hosting");
  });
});

describe("toUserFacingMessage", () => {
  it("maps database setup hints", () => {
    expect(
      toUserFacingMessage(
        "Database is not configured for this environment. On Vercel, set LIBSQL_URL…",
      ),
    ).toBe(USER_FACING.database);
  });

  it("maps Turso quota copy", () => {
    expect(
      toUserFacingMessage(
        "Turso database quota exceeded (BLOCKED): SQL reads are blocked…",
      ),
    ).toBe(USER_FACING.databaseQuota);
  });

  it("maps raw vendor API key soft-skips", () => {
    expect(
      toUserFacingMessage(
        "FINNHUB_API_KEY is not set. Add it to enable Finnhub earnings…",
      ),
    ).toBe(USER_FACING.generic);
  });

  it("passes through safe product errors", () => {
    expect(toUserFacingMessage("Could not load catalysts.")).toBe(
      "Could not load catalysts.",
    );
  });

  it("falls back for opaque ops leaks", () => {
    expect(toUserFacingMessage("SQLITE_READONLY: attempt to write")).toBe(
      USER_FACING.generic,
    );
  });
});
