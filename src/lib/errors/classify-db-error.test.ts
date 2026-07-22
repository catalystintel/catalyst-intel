import { describe, expect, it } from "vitest";

import { classifyDbError } from "./classify-db-error";

describe("classifyDbError", () => {
  it("flags the explicit not-configured message from assertDatabaseConfigured", () => {
    expect(
      classifyDbError(
        "Database is not configured. Set LIBSQL_URL and LIBSQL_AUTH_TOKEN on Vercel (Turso). See DEPLOYMENT.md.",
      ),
    ).toBe("not-configured");
  });

  it("flags a local-file fallback error as not-configured", () => {
    expect(classifyDbError("unable to open database file: local.db")).toBe(
      "not-configured",
    );
  });

  it("flags a real libSQL client connection error as transient, not a config problem", () => {
    // Regression: this exact class of error (a live Turso database that's
    // configured correctly but briefly unreachable) used to be shown with
    // "set LIBSQL_URL and LIBSQL_AUTH_TOKEN" instructions, which is wrong
    // and wastes an admin's time chasing a phantom setup issue.
    expect(classifyDbError("ConnectionFailed: fetch failed")).toBe("transient");
    expect(classifyDbError("LibsqlError: fetch failed")).toBe("transient");
  });

  it("falls back to unknown for unrelated errors", () => {
    expect(classifyDbError("Cannot read properties of undefined")).toBe(
      "unknown",
    );
  });
});
