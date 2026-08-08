import { describe, expect, it } from "vitest";
import {
  applyTeamScope,
  classifyWaitForSha,
  hasNewerHealthyForSha,
  isAccessRelatedFailure,
  isVercelAuthError,
  isZhbarAuthor,
  matchDeploymentSha,
  needsAutoRedeploy,
  resolveBranchTarget,
  stripSecret,
  waitForShaDeployOutcome,
} from "./vercel-unblock-redeploy.mjs";

describe("isZhbarAuthor", () => {
  it("matches common name/email/login variants", () => {
    expect(isZhbarAuthor({ githubCommitAuthorName: "zhbar10" })).toBe(true);
    expect(
      isZhbarAuthor({ githubCommitAuthorEmail: "zhbar10@gmail.com" }),
    ).toBe(true);
    expect(isZhbarAuthor({ githubCommitAuthorLogin: "zhbar10" })).toBe(true);
    expect(isZhbarAuthor({ actor: "zhbar" })).toBe(true);
  });

  it("rejects unrelated authors", () => {
    expect(isZhbarAuthor({ githubCommitAuthorName: "Omer Nachshon" })).toBe(
      false,
    );
    expect(
      isZhbarAuthor({ githubCommitAuthorEmail: "omer.nachshon@gmail.com" }),
    ).toBe(false);
    expect(isZhbarAuthor({ githubCommitAuthorLogin: "OmerNachshon" })).toBe(
      false,
    );
    expect(isZhbarAuthor({})).toBe(false);
    expect(isZhbarAuthor(null)).toBe(false);
  });
});

describe("isAccessRelatedFailure", () => {
  it("treats BLOCKED as access-related", () => {
    expect(isAccessRelatedFailure({ readyState: "BLOCKED", meta: {} })).toBe(
      true,
    );
  });

  it("matches GitHub App / permission error text", () => {
    expect(
      isAccessRelatedFailure({
        readyState: "ERROR",
        errorMessage: "GitHub App does not have access to this repository",
      }),
    ).toBe(true);
    expect(
      isAccessRelatedFailure({
        readyState: "ERROR",
        errorMessage: "Commit author is not a team member",
      }),
    ).toBe(true);
  });

  it("ignores unrelated build errors", () => {
    expect(
      isAccessRelatedFailure({
        readyState: "ERROR",
        errorMessage: "TypeScript build failed: cannot find module",
      }),
    ).toBe(false);
  });
});

describe("needsAutoRedeploy", () => {
  it("heals blocked zhbar commits on main/dev", () => {
    expect(
      needsAutoRedeploy({
        readyState: "BLOCKED",
        target: "production",
        meta: {
          githubCommitRef: "main",
          githubCommitAuthorEmail: "zhbar10@gmail.com",
        },
      }),
    ).toMatchObject({
      branch: "main",
      target: "production",
      reason: "blocked-zhbar-author",
    });

    expect(
      needsAutoRedeploy({
        readyState: "BLOCKED",
        meta: {
          githubCommitRef: "dev",
          githubCommitAuthorLogin: "zhbar10",
        },
      }),
    ).toMatchObject({ branch: "dev", target: null });
  });

  it("heals zhbar ERROR with access wording", () => {
    expect(
      needsAutoRedeploy({
        readyState: "ERROR",
        meta: {
          githubCommitRef: "dev",
          githubCommitAuthorName: "zhbar10",
        },
        errorMessage: "unauthorized GitHub App installation",
      }),
    ).toMatchObject({ branch: "dev", reason: "error-zhbar-access" });
  });

  it("ignores feature-branch and non-zhbar build failures", () => {
    expect(
      needsAutoRedeploy({
        readyState: "BLOCKED",
        meta: {
          githubCommitRef: "feat/x",
          githubCommitAuthorLogin: "zhbar10",
        },
      }),
    ).toBeNull();
    expect(
      needsAutoRedeploy({
        readyState: "ERROR",
        meta: {
          githubCommitRef: "main",
          githubCommitAuthorLogin: "OmerNachshon",
        },
        errorMessage: "npm run build failed",
      }),
    ).toBeNull();
  });
});

describe("resolveBranchTarget", () => {
  it("maps production / main to production", () => {
    expect(
      resolveBranchTarget({
        target: "production",
        meta: { githubCommitRef: "feat/x" },
      }),
    ).toEqual({ branch: "main", target: "production" });
    expect(
      resolveBranchTarget({
        target: null,
        meta: { githubCommitRef: "refs/heads/main" },
      }),
    ).toEqual({ branch: "main", target: "production" });
  });
});

describe("hasNewerHealthyForSha", () => {
  it("detects a later READY deploy for the same sha", () => {
    const deployments = [
      {
        uid: "dpl_new",
        created: 2000,
        readyState: "READY",
        meta: { githubCommitSha: "abc" },
      },
      {
        uid: "dpl_blocked",
        created: 1000,
        readyState: "BLOCKED",
        meta: { githubCommitSha: "abc" },
      },
    ];
    expect(hasNewerHealthyForSha(deployments, "abc", 1000)).toBe(true);
    expect(hasNewerHealthyForSha(deployments, "abc", 2000)).toBe(false);
  });
});

describe("matchDeploymentSha / classifyWaitForSha", () => {
  it("matches full or prefix SHAs", () => {
    expect(
      matchDeploymentSha(
        { meta: { githubCommitSha: "abcdef123456" } },
        "abcdef123456",
      ),
    ).toBe(true);
    expect(
      matchDeploymentSha(
        { meta: { githubCommitSha: "abcdef123456" } },
        "abcdef",
      ),
    ).toBe(true);
    expect(
      matchDeploymentSha(
        { meta: { githubCommitSha: "abcdef" } },
        "abcdef123456",
      ),
    ).toBe(true);
    expect(
      matchDeploymentSha({ meta: { githubCommitSha: "ffffff" } }, "abcdef"),
    ).toBe(false);
  });

  it("classifies absent / needs-heal / healthy", () => {
    expect(classifyWaitForSha([], "abc")).toBe("absent");
    expect(
      classifyWaitForSha(
        [
          {
            readyState: "BLOCKED",
            target: "production",
            meta: {
              githubCommitSha: "abc",
              githubCommitAuthorLogin: "zhbar10",
            },
          },
        ],
        "abc",
      ),
    ).toBe("needs-heal");
    expect(
      classifyWaitForSha(
        [
          {
            readyState: "BUILDING",
            target: "production",
            meta: { githubCommitSha: "abc" },
          },
        ],
        "abc",
      ),
    ).toBe("healthy");
  });
});

describe("stripSecret", () => {
  it("strips quotes, BOM, CR, and Bearer prefix", () => {
    expect(stripSecret('  "abc"  ')).toBe("abc");
    expect(stripSecret("Bearer tok_123")).toBe("tok_123");
    expect(stripSecret("\uFEFFteam_x\r\n")).toBe("team_x");
  });
});

describe("applyTeamScope", () => {
  it("uses teamId for team_ ids and opaque account ids", () => {
    const a = new URL("https://api.vercel.com/v6/deployments");
    applyTeamScope(a, "team_abc");
    expect(a.searchParams.get("teamId")).toBe("team_abc");
    expect(a.searchParams.get("slug")).toBeNull();

    const b = new URL("https://api.vercel.com/v6/deployments");
    applyTeamScope(b, "AbCdEfGhIjKlMnOp123456");
    expect(b.searchParams.get("teamId")).toBe("AbCdEfGhIjKlMnOp123456");
    expect(b.searchParams.get("slug")).toBeNull();
  });

  it("uses slug for hyphenated dashboard slugs", () => {
    const u = new URL("https://api.vercel.com/v6/deployments");
    applyTeamScope(u, "zhbar10s-projects");
    expect(u.searchParams.get("slug")).toBe("zhbar10s-projects");
    expect(u.searchParams.get("teamId")).toBeNull();
  });
});

describe("isVercelAuthError", () => {
  it("detects 401/403 status and Not authorized wording", () => {
    expect(
      isVercelAuthError(Object.assign(new Error("x"), { status: 403 })),
    ).toBe(true);
    expect(
      isVercelAuthError(
        new Error("Vercel 403 /v6/deployments: Not authorized"),
      ),
    ).toBe(true);
    expect(isVercelAuthError(new Error("TypeScript build failed"))).toBe(false);
  });
});

describe("waitForShaDeployOutcome", () => {
  it("returns early when a blocked deploy appears", async function () {
    let calls = 0;
    const list = async () => {
      calls += 1;
      if (calls < 2) return [];
      return [
        {
          readyState: "BLOCKED",
          target: "production",
          meta: {
            githubCommitSha: "deadbeef",
            githubCommitAuthorLogin: "zhbar10",
          },
        },
      ];
    };
    const slept = [];
    const out = await waitForShaDeployOutcome(
      { token: "t", teamId: "team", projectId: "prj" },
      "deadbeef",
      {
        timeoutMs: 10_000,
        intervalMs: 10,
        list,
        sleep: async (ms) => {
          slept.push(ms);
        },
      },
    );
    expect(out.outcome).toBe("needs-heal");
    expect(calls).toBe(2);
    expect(slept.length).toBe(1);
    expect(out.waitedMs).toBeGreaterThanOrEqual(0);
  });

  it("times out when the SHA never appears", async function () {
    const out = await waitForShaDeployOutcome(
      { token: "t", teamId: "team", projectId: "prj" },
      "missing",
      {
        timeoutMs: 25,
        intervalMs: 10,
        list: async () => [],
        sleep: async () => {},
      },
    );
    expect(out.outcome).toBe("timeout");
  });
});
