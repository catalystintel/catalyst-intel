#!/usr/bin/env node
/**
 * CI deploy for push to `dev` / `main` after green test-and-build.
 *
 * Uses the same VERCEL_* secrets as the unblock cron. Prefer paths that work
 * when `vercel` CLI cannot load GET /v2/user (common with some token types):
 *
 *   1) API redeploy of an existing deployment for this SHA (team token "approves"
 *      a git-author BLOCKED deploy)
 *   2) API create from gitSource branch tip
 *   3) CLI file-upload of the checked-out tree (best author-bypass; needs a
 *      personal account token that resolves /v2/user)
 *
 * Staging (`dev`) is aliased to the stable git-dev host when we have a URL/id.
 *
 * Used by `.github/workflows/ci.yml` → `deploy` job.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  apiDeployBranchTip,
  apiRedeploy,
  apiSetAlias,
  assertVercelUserToken,
  cliDeployCwd,
  isVercelAuthError,
  listRecentDeployments,
  resolveVercelAccess,
  stripSecret,
  warnAndSkipUnauthorized,
} from "./vercel-unblock-redeploy.mjs";

const STAGING_ALIAS =
  process.env.STAGING_ALIAS ||
  "catalyst-intel-git-dev-zhbar10s-projects.vercel.app";

/**
 * @param {string} branch
 * @returns {"main" | "dev" | null}
 */
export function resolveDeployBranch(branch) {
  const b = String(branch || "")
    .replace(/^refs\/heads\//, "")
    .trim();
  if (b === "main" || b === "dev") return b;
  return null;
}

/**
 * @param {Array<{ uid?: string, id?: string, meta?: Record<string, unknown>, created?: number, createdAt?: number }>} deployments
 * @param {string} sha
 */
export function findDeploymentForSha(deployments, sha) {
  if (!sha) return null;
  const matches = deployments.filter(
    (d) => String(d.meta?.githubCommitSha ?? "") === sha,
  );
  if (matches.length === 0) return null;
  matches.sort(
    (a, b) =>
      Number(b.created ?? b.createdAt ?? 0) -
      Number(a.created ?? a.createdAt ?? 0),
  );
  return matches[0];
}

/**
 * @param {{
 *   token: string,
 *   teamId: string,
 *   projectId: string,
 *   projectName?: string,
 *   branch: "main" | "dev",
 *   sha?: string,
 *   allowCli?: boolean,
 *   stagingAlias?: string,
 * }} cfg
 */
export async function runCiDeploy(cfg) {
  const projectName = cfg.projectName ?? "catalyst-intel";
  const target = cfg.branch === "main" ? "production" : null;
  const stagingAlias = cfg.stagingAlias ?? STAGING_ALIAS;
  const allowCli = cfg.allowCli !== false;
  const sha = cfg.sha ?? "";

  /** @type {string | null} */
  let method = null;
  /** @type {Record<string, unknown> | null} */
  let created = null;

  /** @type {Array<{ uid?: string, id?: string, meta?: Record<string, unknown>, created?: number, createdAt?: number }>} */
  let deployments = [];
  try {
    deployments = await listRecentDeployments(cfg);
  } catch (err) {
    // Listing is best-effort for same-SHA redeploy; auth failures soft-skip
    // in main(). Other list errors should not block gitSource / CLI paths.
    if (isVercelAuthError(err)) throw err;
    console.warn(`listRecentDeployments failed (continuing): ${err}`);
  }
  const existing = findDeploymentForSha(deployments, sha);

  if (existing) {
    const uid = existing.uid ?? existing.id;
    if (uid) {
      try {
        created = await apiRedeploy(
          { ...cfg, projectName },
          String(uid),
          target,
          { withLatestCommit: false },
        );
        method = "api-redeploy-same-sha";
      } catch (err) {
        console.warn(`api-redeploy-same-sha failed: ${err}`);
      }
    }
  }

  if (!created) {
    try {
      created = await apiDeployBranchTip(
        { ...cfg, projectName },
        cfg.branch,
        target,
        {
          githubOrg: "zhbar10",
          githubRepo: "catalyst-intel",
          githubCommitSha: sha || undefined,
        },
      );
      method = "api-gitSource-branch-tip";
    } catch (err) {
      console.warn(`api-gitSource-branch-tip failed: ${err}`);
    }
  }

  if (!created && allowCli) {
    try {
      await assertVercelUserToken(cfg.token, cfg.teamId);
      const cli = cliDeployCwd(cfg, target);
      method = "cli-file-upload";
      created = {
        id: null,
        url: cli.url,
        readyState: "BUILDING",
      };
      console.log(`CLI deploy started: ${cli.url}`);
    } catch (err) {
      throw new Error(
        `All deploy methods failed. Last CLI/API error: ${err instanceof Error ? err.message : err}. If you see "User not found", set VERCEL_TOKEN to a personal token from https://vercel.com/account/tokens (team-owner account).`,
      );
    }
  }

  if (!created) {
    throw new Error(
      "All deploy methods failed (API redeploy / gitSource). CLI skipped or unavailable.",
    );
  }

  const newUid = created?.id ?? created?.uid ?? null;
  const url =
    typeof created?.url === "string"
      ? created.url.startsWith("http")
        ? created.url
        : `https://${created.url}`
      : null;

  console.log(
    `OK via ${method}: ${newUid ?? url} readyState=${created?.readyState ?? "?"}`,
  );

  if (cfg.branch === "dev") {
    // Prefer deployment id; fall back to hostname for CLI-only creates.
    const aliasTarget =
      (newUid && String(newUid)) ||
      (url ? url.replace(/^https?:\/\//, "").split("/")[0] : null);
    if (aliasTarget) {
      try {
        await apiSetAlias(cfg, aliasTarget, stagingAlias);
        console.log(`Aliased ${aliasTarget} → ${stagingAlias}`);
      } catch (err) {
        // Alias is best-effort; deploy itself already succeeded.
        console.warn(`Staging alias failed (non-fatal): ${err}`);
      }
    }
  }

  return {
    branch: cfg.branch,
    target,
    method,
    sha: sha || null,
    newUid,
    url,
    stagingAlias: cfg.branch === "dev" ? stagingAlias : null,
  };
}

async function main() {
  const token = stripSecret(process.env.VERCEL_TOKEN);
  const teamId = stripSecret(process.env.VERCEL_ORG_ID);
  const projectId = stripSecret(process.env.VERCEL_PROJECT_ID);
  const projectName =
    stripSecret(process.env.VERCEL_PROJECT_NAME) || "catalyst-intel";
  const branch = resolveDeployBranch(
    process.env.DEPLOY_BRANCH || process.env.GITHUB_REF_NAME || "",
  );
  const sha = stripSecret(process.env.GITHUB_SHA) || "";
  const allowCli = process.env.VERCEL_CI_ALLOW_CLI !== "0";

  if (!token) {
    console.warn(
      "::warning::VERCEL_TOKEN not set — skipping CI Vercel deploy. See DEPLOYMENT.md.",
    );
    process.exit(0);
  }
  if (!teamId || !projectId) {
    console.warn(
      "::warning::VERCEL_ORG_ID / VERCEL_PROJECT_ID not set — skipping CI Vercel deploy. See DEPLOYMENT.md.",
    );
    process.exit(0);
  }
  if (!branch) {
    console.warn(
      `::warning::CI deploy only supports push to main/dev (got ${process.env.DEPLOY_BRANCH || process.env.GITHUB_REF_NAME || "empty"}) — skipping.`,
    );
    process.exit(0);
  }

  /** @type {{ token: string, teamId: string, projectId: string, projectName: string }} */
  let access;
  try {
    access = await resolveVercelAccess({
      token,
      teamId,
      projectId,
      projectName,
    });
  } catch (err) {
    if (isVercelAuthError(err)) {
      warnAndSkipUnauthorized("CI Vercel deploy", err);
      process.exit(0);
    }
    throw err;
  }

  try {
    const out = await runCiDeploy({
      ...access,
      projectName,
      branch,
      sha,
      allowCli,
      stagingAlias: STAGING_ALIAS,
    });
    console.log(JSON.stringify(out, null, 2));
  } catch (err) {
    if (isVercelAuthError(err)) {
      warnAndSkipUnauthorized("CI Vercel deploy", err);
      process.exit(0);
    }
    throw err;
  }
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
