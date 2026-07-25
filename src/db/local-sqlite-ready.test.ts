import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { isLocalSqliteReady } from "./local-sqlite-ready";

const ORIGINAL = {
  LIBSQL_URL: process.env.LIBSQL_URL,
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

describe("isLocalSqliteReady", () => {
  it("is true for remote/Turso mode", () => {
    process.env.VERCEL = "1";
    process.env.LIBSQL_URL = "libsql://example.turso.io";
    expect(isLocalSqliteReady()).toBe(true);
  });

  it("is false when the local file is missing", () => {
    delete process.env.VERCEL;
    delete process.env.LIBSQL_URL;
    process.env.DATABASE_URL = "file:./definitely-missing-ci-db.db";
    expect(isLocalSqliteReady()).toBe(false);
  });

  it("is false for an empty local file", () => {
    const emptyPath = path.join(os.tmpdir(), `ci-empty-${Date.now()}.db`);
    fs.writeFileSync(emptyPath, "");
    try {
      delete process.env.VERCEL;
      delete process.env.LIBSQL_URL;
      process.env.DATABASE_URL = `file:${emptyPath}`;
      expect(isLocalSqliteReady()).toBe(false);
    } finally {
      fs.unlinkSync(emptyPath);
    }
  });

  it("is true for a non-empty local file", () => {
    const readyPath = path.join(os.tmpdir(), `ci-ready-${Date.now()}.db`);
    fs.writeFileSync(readyPath, "sqlite-placeholder");
    try {
      delete process.env.VERCEL;
      delete process.env.LIBSQL_URL;
      process.env.DATABASE_URL = `file:${readyPath}`;
      expect(isLocalSqliteReady()).toBe(true);
    } finally {
      fs.unlinkSync(readyPath);
    }
  });
});
