import { afterEach, describe, expect, it } from "vitest";

import { adminRoleForEmail, getAdminEmails, isAdminEmail } from "./admin";

describe("admin allowlist", () => {
  const original = process.env.ADMIN_EMAILS;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ADMIN_EMAILS;
    } else {
      process.env.ADMIN_EMAILS = original;
    }
  });

  it("defaults to the two allowlisted operators", () => {
    delete process.env.ADMIN_EMAILS;
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
