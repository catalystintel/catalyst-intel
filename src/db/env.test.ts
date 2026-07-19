import { afterEach, describe, expect, it } from "vitest";

import { isLibsqlConfigured } from "./env";

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
