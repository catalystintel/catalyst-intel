import { afterEach, describe, expect, it } from "vitest";

import { adminRoleForEmail, getAdminEmails, isAdminEmail } from "./admin";

describe("admin allowlist", () => {
  const originalEmails = process.env.ADMIN_EMAILS;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalEmails === undefined) {
      delete process.env.ADMIN_EMAILS;
    } else {
      process.env.ADMIN_EMAILS = originalEmails;
    }
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("defaults to the two allowlisted operators outside production", () => {
    delete process.env.ADMIN_EMAILS;
    process.env.NODE_ENV = "development";
    expect(getAdminEmails()).toEqual([
      "zhbar10@gmail.com",
      "omer.nachshon@gmail.com",
    ]);
    expect(isAdminEmail("zhbar10@gmail.com")).toBe(true);
    expect(isAdminEmail("ZHBAR10@GMAIL.COM")).toBe(true);
    expect(isAdminEmail("stranger@example.com")).toBe(false);
    expect(adminRoleForEmail("omer.nachshon@gmail.com")).toBe("admin");
    expect(adminRoleForEmail("stranger@example.com")).toBe("user");
  });

  it("fails closed in production when ADMIN_EMAILS is unset", () => {
    delete process.env.ADMIN_EMAILS;
    process.env.NODE_ENV = "production";
    expect(getAdminEmails()).toEqual([]);
    expect(isAdminEmail("zhbar10@gmail.com")).toBe(false);
  });

  it("honors ADMIN_EMAILS overrides", () => {
    process.env.ADMIN_EMAILS = " ops@example.com , other@example.com ";
    expect(getAdminEmails()).toEqual(["ops@example.com", "other@example.com"]);
    expect(isAdminEmail("ops@example.com")).toBe(true);
    expect(isAdminEmail("zhbar10@gmail.com")).toBe(false);
  });

  it("rejects empty / missing emails", () => {
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
  });
});
