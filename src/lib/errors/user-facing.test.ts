import { describe, expect, it } from "vitest";

import {
  USER_FACING,
  looksLikeOpsMessage,
  toUserFacingMessage,
} from "./user-facing";

describe("looksLikeOpsMessage", () => {
  it("flags env vars and infra keywords", () => {
    expect(looksLikeOpsMessage("Set LIBSQL_URL in Vercel")).toBe(true);
    expect(looksLikeOpsMessage("Run npm run db:migrate")).toBe(true);
    expect(looksLikeOpsMessage("Turso BLOCKED")).toBe(true);
  });

  it("allows polished product copy", () => {
    expect(looksLikeOpsMessage("Could not add AAPL to watchlist")).toBe(false);
    expect(looksLikeOpsMessage(USER_FACING.database)).toBe(false);
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
