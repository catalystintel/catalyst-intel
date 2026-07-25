import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  databaseSetupMode,
  isLibsqlConfigured,
  isLocalSqliteSetupError,
  isLocalSqliteWriteError,
  isSchemaMissingError,
  localSqlitePath,
} from "./env";

const ORIGINAL = {
  LIBSQL_URL: process.env.LIBSQL_URL,
  LIBSQL_AUTH_TOKEN: process.env.LIBSQL_AUTH_TOKEN,
  DATABASE_URL: process.env.DATABASE_URL,
  VERCEL: process.env.VERCEL,
};

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("isLibsqlConfigured", () => {
  it("accepts Turso URL + token", () => {
    process.env.LIBSQL_URL = "libsql://example.turso.io";
    process.env.LIBSQL_AUTH_TOKEN = "tok_abc";
    delete process.env.VERCEL;
    expect(isLibsqlConfigured()).toBe(true);
  });

  it("rejects Turso URL without token", () => {
    process.env.LIBSQL_URL = "libsql://example.turso.io";
    delete process.env.LIBSQL_AUTH_TOKEN;
    expect(isLibsqlConfigured()).toBe(false);
  });

  it("rejects file databases on Vercel", () => {
    process.env.VERCEL = "1";
    delete process.env.LIBSQL_URL;
    process.env.DATABASE_URL = "file:./local.db";
    expect(isLibsqlConfigured()).toBe(false);
  });

  it("accepts local file databases off Vercel", () => {
    delete process.env.VERCEL;
    delete process.env.LIBSQL_URL;
    process.env.DATABASE_URL = "file:./local.db";
    expect(isLibsqlConfigured()).toBe(true);
  });
});

describe("localSqlitePath", () => {
  it("returns the path segment from file URLs", () => {
    expect(localSqlitePath("file:./local.db")).toBe("./local.db");
    expect(localSqlitePath("file:local.db")).toBe("local.db");
  });
});

describe("isSchemaMissingError", () => {
  it("detects libSQL missing-table errors", () => {
    expect(
      isSchemaMissingError(new Error("SQLITE_ERROR: no such table: users")),
    ).toBe(true);
  });

  it("walks Error.cause", () => {
    expect(
      isSchemaMissingError(
        new Error("Local database schema is missing", {
          cause: new Error("SQLITE_ERROR: no such table: users"),
        }),
      ),
    ).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isSchemaMissingError(new Error("ConnectionFailed"))).toBe(false);
  });
});

describe("isLocalSqliteWriteError", () => {
  it("detects SQLITE_READONLY", () => {
    expect(
      isLocalSqliteWriteError(
        new Error("Failed query: insert into users", {
          cause: new Error(
            "LibsqlError: SQLITE_READONLY: attempt to write a readonly database",
          ),
        }),
      ),
    ).toBe(true);
  });

  it("is included in setup-error catch-all", () => {
    expect(
      isLocalSqliteSetupError(new Error("SQLITE_BUSY: database is locked")),
    ).toBe(true);
  });
});

describe("databaseSetupMode", () => {
  it("is local for file databases", () => {
    delete process.env.VERCEL;
    delete process.env.LIBSQL_URL;
    expect(databaseSetupMode()).toBe("local");
  });

  it("is remote on Vercel", () => {
    process.env.VERCEL = "1";
    expect(databaseSetupMode()).toBe("remote");
  });
});

describe("localSqlitePath absolute resolve helper", () => {
  it("keeps absolute paths absolute when joined by callers", () => {
    const rel = localSqlitePath("file:./local.db");
    expect(rel).toBeTruthy();
    expect(path.join(process.cwd(), rel!)).toBe(
      path.join(process.cwd(), "./local.db"),
    );
  });
});
