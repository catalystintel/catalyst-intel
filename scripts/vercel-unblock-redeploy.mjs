#!/usr/bin/env node
/**
 * Auto-heal Vercel deploys for omer.nachshon commits on `main` / `dev`.
 *
 * Triggers when a recent deployment is:
 *   - BLOCKED (unverified / non-seat git author), or
 *   - ERROR / failed with access, auth, GitHub App, or permission wording
 *
 * Then redeploys via team VERCEL_TOKEN:
 *   1) API redeploy of the blocked/failed deployment (team token "approves")
 *   2) If that fails (access), API deploy from branch tip (`withLatestCommit` / gitSource)
 *   3) If that fails, CLI `vercel deploy` from a checked-out branch tip (file upload
 *      bypasses git-author seat checks)
 *
 * Used by `.github/workflows/vercel-unblock-redeploy.yml`.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.vercel.com";
const LOOKBACK_MS = 6 * 60 * 60 * 1000; // 6 hours
const AUTHOR_RE = /omer\.?\s*nachshon|omer\.nachshon|nachshon/i;
const ACCESS_FAIL_RE =
  /access|permission|forbidden|unauthorized|not (a )?member|github app|git.?hub.?app|install(ation)?|author|unverified|team seat|private.?repo|denied|401|403|blocked/i;

/** @param {Record<string, unknown> | null | undefined} meta */
export function isOmerAuthor(meta) {
  if (!meta || typeof meta !== "object") return false;
  const fields = [
    meta.githubCommitAuthorName,
    meta.githubCommitAuthorLogin,
    meta.githubCommitAuthorEmail,
    meta.githubCommitOrgUser,
    meta.actor,
  ];
  return fields.some((v) => typeof v === "string" && AUTHOR_RE.test(v));
}

/** @param {unknown} deployment */
export function deploymentErrorText(deployment) {
  if (!deployment || typeof deployment !== "object") return "";
  const d = /** @type {Record<string, unknown>} */ (deployment);
  const meta = /** @type {Record<string, unknown>} */ (d.meta ?? {});
  const parts = [
    d.errorMessage,
    d.errorCode,
    d.readyStateReason,
    meta.errorMessage,
    meta.githubCommitAuthorLogin,
    typeof d.aliasError === "object" && d.aliasError
      ? JSON.stringify(d.aliasError)
      : "",
  ];
  return parts.filter((p) => typeof p === "string" && p).join(" | ");
}

/** @param {unknown} deployment */
export function isAccessRelatedFailure(deployment) {
  const text = deploymentErrorText(deployment);
  if (ACCESS_FAIL_RE.test(text)) return true;
  // BLOCKED with no message is usually git-author / seat enforcement.
  const state =
    /** @type {{ readyState?: string, state?: string }} */ (deployment)
      .readyState ?? /** @type {{ state?: string }} */ (deployment).state;
  return state === "BLOCKED";
}

/**
 * @param {{ target?: string | null, meta?: Record<string, unknown>, readyState?: string, state?: string }} deployment
 * @returns {{ branch: "main" | "dev", target: "production" | null, reason: string } | null}
 */
export function needsAutoRedeploy(deployment) {
  const state = deployment.readyState ?? deployment.state;
  const omer = isOmerAuthor(deployment.meta ?? {});
  const access = isAccessRelatedFailure(deployment);
  const mapped = resolveBranchTarget(deployment);
  if (!mapped) return null;

  if (state === "BLOCKED" && (omer || access)) {
    return {
      ...mapped,
      reason: omer ? "blocked-omer-author" : "blocked-access",
    };
  }
  if (state === "ERROR" && omer) {
    // Omer ERROR on main/dev: heal even if dashboard omits the message.
    return {
      ...mapped,
      reason: access ? "error-omer-access" : "error-omer",
    };
  }
  return null;
}

/**
 * @param {{ target?: string | null, meta?: Record<string, unknown> }} deployment
 * @returns {{ branch: "main" | "dev", target: "production" | null } | null}
 */
export function resolveBranchTarget(deployment) {
  const ref = String(deployment.meta?.githubCommitRef ?? "")
    .replace(/^refs\/heads\//, "")
    .trim();
  const target = deployment.target ?? null;

  if (target === "production" || ref === "main") {
    return { branch: "main", target: "production" };
  }
  if (ref === "dev") {
    return { branch: "dev", target: null };
  }
  return null;
}

/**
 * @param {Array<{ uid: string, created?: number, createdAt?: number, state?: string, readyState?: string, meta?: Record<string, unknown> }>} deployments
 * @param {string} sha
 * @param {number} afterMs
 */
export function hasNewerHealthyForSha(deployments, sha, afterMs) {
  if (!sha) return false;
  const active = new Set([
    "READY",
    "BUILDING",
    "QUEUED",
    "INITIALIZING",
    "UPLOADING",
  ]);
  return deployments.some((d) => {
    const state = d.readyState ?? d.state;
    if (!state || !active.has(state)) return false;
    if (String(d.meta?.githubCommitSha ?? "") !== sha) return false;
    const created = Number(d.created ?? d.createdAt ?? 0);
    return created > afterMs;
  });
}

/**
 * @param {Array<{ uid: string, created?: number, createdAt?: number, state?: string, readyState?: string, meta?: Record<string, unknown>, target?: string | null }>} deployments
 * @param {"main" | "dev"} branch
 * @param {number} afterMs
 */
export function hasNewerHealthyForBranch(deployments, branch, afterMs) {
  const active = new Set([
    "READY",
    "BUILDING",
    "QUEUED",
    "INITIALIZING",
    "UPLOADING",
  ]);
  return deployments.some((d) => {
    const state = d.readyState ?? d.state;
    if (!state || !active.has(state)) return false;
    const mapped = resolveBranchTarget(d);
    if (!mapped || mapped.branch !== branch) return false;
    const created = Number(d.created ?? d.createdAt ?? 0);
    return created > afterMs;
  });
}

/** @deprecated use hasNewerHealthyForSha */
export const hasNewerNonBlockedForSha = hasNewerHealthyForSha;

/**
 * @param {string} apiPath
 * @param {string} token
 * @param {string} [teamId]
 * @param {RequestInit} [init]
 */
async function vercelFetch(apiPath, token, teamId, init = {}) {
  const url = new URL(apiPath, API);
  if (teamId) url.searchParams.set("teamId", teamId);
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const msg =
      typeof body?.error?.message === "string"
        ? body.error.message
        : typeof body?.message === "string"
          ? body.message
          : text.slice(0, 300);
    const err = new Error(`Vercel ${res.status} ${apiPath}: ${msg}`);
    // @ts-expect-error attach status for fallback logic
    err.status = res.status;
    // @ts-expect-error attach body
    err.body = body;
    throw err;
  }
  return body;
}

export function isAccessErrorMessage(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return ACCESS_FAIL_RE.test(msg);
}

/**
 * @param {{ token: string, teamId: string, projectId: string }} cfg
 */
export async function listRecentDeployments(cfg) {
  const since = Date.now() - LOOKBACK_MS;
  const qs = new URLSearchParams({
    projectId: cfg.projectId,
    limit: "50",
    since: String(since),
  });
  const data = await vercelFetch(
    `/v6/deployments?${qs}`,
    cfg.token,
    cfg.teamId,
  );
  return Array.isArray(data?.deployments) ? data.deployments : [];
}

/**
 * @param {{ token: string, teamId: string, projectName: string }} cfg
 * @param {string} deploymentUid
 * @param {"production" | null} target
 * @param {{ withLatestCommit?: boolean }} [opts]
 */
export async function apiRedeploy(cfg, deploymentUid, target, opts = {}) {
  /** @type {Record<string, unknown>} */
  const payload = {
    name: cfg.projectName,
    deploymentId: deploymentUid,
    forceNew: 1,
  };
  if (opts.withLatestCommit) payload.withLatestCommit = true;
  if (target === "production") payload.target = "production";

  return vercelFetch("/v13/deployments", cfg.token, cfg.teamId, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Deploy branch tip via gitSource (still goes through Git integration).
 * @param {{ token: string, teamId: string, projectId: string, projectName: string }} cfg
 * @param {"main" | "dev"} branch
 * @param {"production" | null} target
 * @param {Record<string, unknown>} meta
 */
export async function apiDeployBranchTip(cfg, branch, target, meta) {
  const repoIdRaw = meta.githubCommitRepoId ?? meta.repoId;
  const repoId =
    typeof repoIdRaw === "number"
      ? repoIdRaw
      : typeof repoIdRaw === "string" && /^\d+$/.test(repoIdRaw)
        ? Number(repoIdRaw)
        : null;

  /** @type {Record<string, unknown>} */
  const gitSource = {
    type: "github",
    ref: branch,
  };
  if (repoId != null) {
    gitSource.repoId = repoId;
  } else {
    gitSource.org = String(meta.githubOrg ?? meta.org ?? "zhbar10");
    gitSource.repo = String(
      meta.githubRepo ?? meta.repo ?? "catalyst-intel",
    ).replace(/^.*\//, "");
  }

  /** @type {Record<string, unknown>} */
  const payload = {
    name: cfg.projectName,
    project: cfg.projectId,
    gitSource,
    forceNew: 1,
  };
  if (target === "production") payload.target = "production";

  return vercelFetch("/v13/deployments", cfg.token, cfg.teamId, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * CLI file-upload deploy — bypasses git-author / GitHub App seat checks.
 * @param {{ token: string, teamId: string, projectId: string }} cfg
 * @param {"main" | "dev"} branch
 * @param {"production" | null} target
 */
export function cliDeployBranchTip(cfg, branch, target) {
  const fetch = spawnSync("git", ["fetch", "origin", branch], {
    encoding: "utf8",
  });
  if (fetch.status !== 0) {
    throw new Error(
      `git fetch origin ${branch} failed: ${fetch.stderr || fetch.stdout}`,
    );
  }
  const co = spawnSync("git", ["checkout", "-f", `origin/${branch}`], {
    encoding: "utf8",
  });
  if (co.status !== 0) {
    throw new Error(
      `git checkout origin/${branch} failed: ${co.stderr || co.stdout}`,
    );
  }

  const args = ["deploy", "--yes", "--token", cfg.token, "--scope", cfg.teamId];
  if (target === "production") args.push("--prod");

  // Prefer local vercel if present; else npx.
  const bin = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(bin, ["vercel", ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      VERCEL_ORG_ID: cfg.teamId,
      VERCEL_PROJECT_ID: cfg.projectId,
      VERCEL_TOKEN: cfg.token,
    },
  });
  const out = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (result.status !== 0) {
    throw new Error(`vercel deploy failed: ${out.slice(-800)}`);
  }
  const urlMatch = out.match(/https:\/\/[^\s]+\.vercel\.app/);
  return { url: urlMatch?.[0] ?? null, log: out.slice(-400) };
}

/**
 * @param {{ token: string, teamId: string, projectId: string, projectName?: string, allowCli?: boolean }} cfg
 */
export async function runUnblock(cfg) {
  const projectName = cfg.projectName ?? "catalyst-intel";
  const allowCli = cfg.allowCli !== false;
  const deployments = await listRecentDeployments(cfg);
  const candidates = deployments.filter((d) => needsAutoRedeploy(d));

  /** @type {Array<Record<string, unknown>>} */
  const results = [];

  for (const d of candidates) {
    const mapped = needsAutoRedeploy(d);
    if (!mapped) continue;

    const sha = String(d.meta?.githubCommitSha ?? "");
    const created = Number(d.created ?? d.createdAt ?? 0);

    if (
      hasNewerHealthyForSha(deployments, sha, created) ||
      hasNewerHealthyForBranch(deployments, mapped.branch, created)
    ) {
      results.push({
        uid: d.uid,
        branch: mapped.branch,
        reason: mapped.reason,
        skipped: "already healthy deploy for sha/branch after this failure",
      });
      continue;
    }

    console.log(
      `Healing ${d.uid} (${mapped.reason}) ${mapped.branch} → ${mapped.target ?? "preview"} sha=${sha.slice(0, 8) || "?"}`,
    );

    let createdDeploy = null;
    let method = "";

    try {
      createdDeploy = await apiRedeploy(
        { ...cfg, projectName },
        d.uid,
        mapped.target,
        { withLatestCommit: false },
      );
      method = "api-redeploy-same-sha";
    } catch (err) {
      console.warn(`api-redeploy-same-sha failed: ${err}`);
      try {
        createdDeploy = await apiRedeploy(
          { ...cfg, projectName },
          d.uid,
          mapped.target,
          { withLatestCommit: true },
        );
        method = "api-redeploy-latest-commit";
      } catch (err2) {
        console.warn(`api-redeploy-latest-commit failed: ${err2}`);
        try {
          createdDeploy = await apiDeployBranchTip(
            { ...cfg, projectName },
            mapped.branch,
            mapped.target,
            d.meta ?? {},
          );
          method = "api-gitSource-branch-tip";
        } catch (err3) {
          console.warn(`api-gitSource-branch-tip failed: ${err3}`);
          if (!allowCli) throw err3;
          const cli = cliDeployBranchTip(cfg, mapped.branch, mapped.target);
          method = "cli-file-upload-branch-tip";
          createdDeploy = {
            id: null,
            url: cli.url,
            readyState: "BUILDING",
          };
          console.log(`CLI deploy started: ${cli.url}`);
        }
      }
    }

    const newUid = createdDeploy?.id ?? createdDeploy?.uid ?? null;
    console.log(
      `OK via ${method}: ${newUid ?? createdDeploy?.url} readyState=${createdDeploy?.readyState}`,
    );
    results.push({
      uid: d.uid,
      branch: mapped.branch,
      reason: mapped.reason,
      method,
      newUid,
      url: createdDeploy?.url ?? null,
    });

    deployments.unshift({
      uid: newUid ?? `cli-${Date.now()}`,
      created: Date.now(),
      readyState: createdDeploy?.readyState ?? "QUEUED",
      target: mapped.target,
      meta: {
        githubCommitSha: sha || undefined,
        githubCommitRef: mapped.branch,
      },
    });
  }

  return {
    scanned: deployments.length,
    candidates: candidates.length,
    results,
  };
}

async function main() {
  const token = process.env.VERCEL_TOKEN?.trim();
  const teamId = process.env.VERCEL_ORG_ID?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const projectName =
    process.env.VERCEL_PROJECT_NAME?.trim() || "catalyst-intel";
  const allowCli = process.env.VERCEL_UNBLOCK_ALLOW_CLI !== "0";

  if (!token || !teamId || !projectId) {
    console.warn(
      "::warning::VERCEL_TOKEN / VERCEL_ORG_ID / VERCEL_PROJECT_ID not set — skipping unblock redeploy. See DEPLOYMENT.md.",
    );
    process.exit(0);
  }

  const out = await runUnblock({
    token,
    teamId,
    projectId,
    projectName,
    allowCli,
  });
  console.log(JSON.stringify(out, null, 2));
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
