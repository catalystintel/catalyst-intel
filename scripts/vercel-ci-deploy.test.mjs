import { describe, expect, it } from "vitest";
import {
  findDeploymentForSha,
  resolveDeployBranch,
} from "./vercel-ci-deploy.mjs";

describe("resolveDeployBranch", () => {
  it("accepts main and dev (with or without refs/heads/)", () => {
    expect(resolveDeployBranch("main")).toBe("main");
    expect(resolveDeployBranch("dev")).toBe("dev");
    expect(resolveDeployBranch("refs/heads/main")).toBe("main");
    expect(resolveDeployBranch("refs/heads/dev")).toBe("dev");
  });

  it("rejects other branches", () => {
    expect(resolveDeployBranch("feat/foo")).toBe(null);
    expect(resolveDeployBranch("")).toBe(null);
  });
});

describe("findDeploymentForSha", () => {
  it("returns newest matching deployment", () => {
    const found = findDeploymentForSha(
      [
        {
          uid: "old",
          created: 1,
          meta: { githubCommitSha: "abc" },
        },
        {
          uid: "new",
          created: 9,
          meta: { githubCommitSha: "abc" },
        },
        {
          uid: "other",
          created: 99,
          meta: { githubCommitSha: "zzz" },
        },
      ],
      "abc",
    );
    expect(found?.uid).toBe("new");
  });

  it("returns null when sha missing or unmatched", () => {
    expect(findDeploymentForSha([{ uid: "x", meta: {} }], "abc")).toBe(null);
    expect(findDeploymentForSha([{ uid: "x", meta: {} }], "")).toBe(null);
  });
});
