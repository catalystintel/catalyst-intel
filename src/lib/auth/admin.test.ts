import { afterEach, describe, expect, it } from "vitest";

import { mutableProcessEnv } from "@/lib/test/mutable-process-env";
import { adminRoleForEmail, getAdminEmails, isAdminEmail } from "./admin";

describe("admin allowlist", () => {
  const env = mutableProcessEnv();
  const originalEmails = env.ADMIN_EMAILS;
  const originalNodeEnv = env.NODE_ENV;

  afterEach(() => {
    if (originalEmails === undefined) {
      delete env.ADMIN_EMAILS;
    } else {
      env.ADMIN_EMAILS = originalEmails;
    }
    env.NODE_ENV = originalNodeEnv;
  });

  it("defaults to the two allowlisted operators when ADMIN_EMAILS is unset", () => {
    delete env.ADMIN_EMAILS;
    env.NODE_ENV = "development";
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

  it("keeps operator defaults in production when ADMIN_EMAILS is unset", () => {
    delete env.ADMIN_EMAILS;
    env.NODE_ENV = "production";
    expect(getAdminEmails()).toEqual([
      "zhbar10@gmail.com",
      "omer.nachshon@gmail.com",
    ]);
    expect(isAdminEmail("omer.nachshon@gmail.com")).toBe(true);
    expect(isAdminEmail("zhbar10@gmail.com")).toBe(true);
  });

  it("merges ADMIN_EMAILS extras onto the operator defaults", () => {
    env.ADMIN_EMAILS = " ops@example.com , other@example.com ";
    expect(getAdminEmails()).toEqual([
      "zhbar10@gmail.com",
      "omer.nachshon@gmail.com",
      "ops@example.com",
      "other@example.com",
    ]);
    expect(isAdminEmail("ops@example.com")).toBe(true);
    expect(isAdminEmail("zhbar10@gmail.com")).toBe(true);
    expect(isAdminEmail("omer.nachshon@gmail.com")).toBe(true);
  });

  it("rejects empty / missing emails", () => {
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
  });
});
