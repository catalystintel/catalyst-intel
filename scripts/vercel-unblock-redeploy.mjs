#!/usr/bin/env node
/**
 * Auto-heal Vercel deploys for zhbar10 commits on `main` / `dev`.
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
 * Project lives on Omer's Vercel team — zhbar commits get Hobby git-author BLOCKED.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.vercel.com";
const LOOKBACK_MS = 6 * 60 * 60 * 1000; // 6 hours
const AUTHOR_RE = /zhbar10|zhbar/i;
const ACCESS_FAIL_RE =
  /access|permission|forbidden|unauthorized|not (a )?member|github app|git.?hub.?app|install(ation)?|author|unverified|team seat|private.?repo|denied|401|403|blocked/i;

/** @param {Record<string, unknown> | null | undefined} meta */
export function isZhbarAuthor(meta) {
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
  const zhbar = isZhbarAuthor(deployment.meta ?? {});
  const access = isAccessRelatedFailure(deployment);
  const mapped = resolveBranchTarget(deployment);
  if (!mapped) return null;

  if (state === "BLOCKED" && (zhbar || access)) {
    return {
      ...mapped,
      reason: zhbar ? "blocked-zhbar-author" : "blocked-access",
    };
  }
  if (state === "ERROR" && zhbar) {
    // zhbar ERROR on main/dev: heal even if dashboard omits the message.
    return {
      ...mapped,
      reason: access ? "error-zhbar-access" : "error-zhbar",
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
 * @param {{ meta?: Record<string, unknown> }} deployment
 * @param {string} sha
 */
export function matchDeploymentSha(deployment, sha) {
  if (!sha) return false;
  const got = String(deployment.meta?.githubCommitSha ?? "");
  if (!got) return false;
  return got === sha || got.startsWith(sha) || sha.startsWith(got);
}

/**
 * Classify whether Vercel has decided on a git deploy for this SHA yet.
 * Used instead of a blind sleep after push to main.
 *
 * @param {Array<{ readyState?: string, state?: string, meta?: Record<string, unknown>, target?: string | null }>} deployments
 * @param {string} sha
 * @returns {"absent" | "needs-heal" | "healthy" | "pending"}
 */
export function classifyWaitForSha(deployments, sha) {
  const forSha = deployments.filter((d) => matchDeploymentSha(d, sha));
  if (forSha.length === 0) return "absent";
  if (forSha.some((d) => needsAutoRedeploy(d))) return "needs-heal";
  const healthy = new Set([
    "READY",
    "BUILDING",
    "QUEUED",
    "INITIALIZING",
    "UPLOADING",
  ]);
  if (forSha.some((d) => healthy.has(String(d.readyState ?? d.state ?? "")))) {
    return "healthy";
  }
  return "pending";
}

/**
 * Poll Vercel deployments until this SHA is BLOCKED/ERROR (heal) or healthy,
 * or until timeout. Avoids a fixed 60s sleep after main push.
 *
 * @param {{ token: string, teamId: string, projectId: string }} cfg
 * @param {string} sha
 * @param {{
 *   timeoutMs?: number,
 *   intervalMs?: number,
 *   list?: (cfg: { token: string, teamId: string, projectId: string }) => Promise<Array<Record<string, unknown>>>,
 *   sleep?: (ms: number) => Promise<void>,
 * }} [opts]
 */
export async function waitForShaDeployOutcome(cfg, sha, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const intervalMs = opts.intervalMs ?? 2_500;
  const list = opts.list ?? listRecentDeployments;
  const sleep =
    opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  const started = Date.now();
  /** @type {Array<Record<string, unknown>>} */
  let deployments = [];
  /** @type {ReturnType<typeof classifyWaitForSha> | "timeout"} */
  let outcome = "absent";

  while (Date.now() - started < timeoutMs) {
    deployments = await list(cfg);
    outcome = classifyWaitForSha(deployments, sha);
    if (outcome === "needs-heal" || outcome === "healthy") {
      return {
        outcome,
        waitedMs: Date.now() - started,
        deployments,
      };
    }
    const remaining = timeoutMs - (Date.now() - started);
    if (remaining <= 0) break;
    await sleep(Math.min(intervalMs, remaining));
  }

  deployments = await list(cfg);
  outcome = classifyWaitForSha(deployments, sha);
  return {
    outcome:
      outcome === "absent" || outcome === "pending" ? "timeout" : outcome,
    waitedMs: Date.now() - started,
    deployments,
  };
}

/**
 * @param {string} apiPath
 * @param {string} token
 * @param {string} [teamId]
 * @param {RequestInit} [init]
 * @param {Record<string, string>} [extraQuery]
 */
async function vercelFetch(apiPath, token, teamId, init = {}, extraQuery = {}) {
  const url = new URL(apiPath, API);
  if (teamId) url.searchParams.set("teamId", teamId);
  for (const [k, v] of Object.entries(extraQuery)) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }
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

/** Confirm VERCEL_TOKEN resolves to a user (CLI needs this; some token types don't). */
export async function assertVercelUserToken(token, teamId) {
  const user = await vercelFetch("/v2/user", token, teamId);
  const id = user?.user?.id ?? user?.id;
  if (!id) {
    throw new Error(
      "VERCEL_TOKEN did not resolve to a Vercel user (GET /v2/user). Create a personal token at https://vercel.com/account/tokens (team-owner account) and update the GitHub secret.",
    );
  }
  return user;
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
  };
  if (opts.withLatestCommit) payload.withLatestCommit = true;
  if (target === "production") payload.target = "production";

  // forceNew is a query param (not body) — body forceNew 400s on gitSource deploys
  // and is ignored/invalid for some redeploy shapes.
  return vercelFetch(
    "/v13/deployments",
    cfg.token,
    cfg.teamId,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { forceNew: "1", skipAutoDetectionConfirmation: "1" },
  );
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
  };
  if (target === "production") payload.target = "production";

  // forceNew must be a query param — body `forceNew` returns 400:
  // "should NOT have additional property `forceNew`".
  return vercelFetch(
    "/v13/deployments",
    cfg.token,
    cfg.teamId,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { forceNew: "1", skipAutoDetectionConfirmation: "1" },
  );
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

  // Prefer global `vercel` (workflow installs it); fall back to npx.
  // Pass token via env only — CLI reads VERCEL_TOKEN natively.
  const args = ["deploy", "--yes", "--scope", cfg.teamId];
  if (target === "production") args.push("--prod");

  const env = {
    ...process.env,
    VERCEL_ORG_ID: cfg.teamId,
    VERCEL_PROJECT_ID: cfg.projectId,
    VERCEL_TOKEN: cfg.token,
  };

  let result = spawnSync("vercel", args, { encoding: "utf8", env });
  if (
    result.error &&
    /** @type {NodeJS.ErrnoException} */ (result.error).code === "ENOENT"
  ) {
    const bin = process.platform === "win32" ? "npx.cmd" : "npx";
    result = spawnSync(bin, ["vercel", ...args], { encoding: "utf8", env });
  }
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
          try {
            await assertVercelUserToken(cfg.token, cfg.teamId);
          } catch (authErr) {
            throw new Error(
              `CLI fallback unavailable: ${authErr instanceof Error ? authErr.message : authErr}`,
            );
          }
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

/** Strip accidental quotes / whitespace from `gh secret set` values. */
export function stripSecret(value) {
  const v = value?.trim() ?? "";
  // Accidental quotes from `gh secret set --body '"…"'` break Bearer auth / CLI.
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1).trim();
  }
  return v;
}

/**
 * CLI file-upload deploy of the current working tree (no git fetch/checkout).
 * Prefer env linkage (VERCEL_ORG_ID / VERCEL_PROJECT_ID) over `--scope` — passing
 * `--scope` forces a GET /v2/user that fails for some token types.
 * @param {{ token: string, teamId: string, projectId: string }} cfg
 * @param {"production" | null} target
 */
export function cliDeployCwd(cfg, target) {
  const args = ["deploy", "--yes"];
  if (target === "production") args.push("--prod");

  const env = {
    ...process.env,
    VERCEL_ORG_ID: cfg.teamId,
    VERCEL_PROJECT_ID: cfg.projectId,
    VERCEL_TOKEN: cfg.token,
  };

  let result = spawnSync("vercel", args, { encoding: "utf8", env });
  if (
    result.error &&
    /** @type {NodeJS.ErrnoException} */ (result.error).code === "ENOENT"
  ) {
    const bin = process.platform === "win32" ? "npx.cmd" : "npx";
    result = spawnSync(bin, ["vercel", ...args], { encoding: "utf8", env });
  }
  const out = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (result.status !== 0) {
    throw new Error(`vercel deploy failed: ${out.slice(-800)}`);
  }
  const urlMatch = out.match(/https:\/\/[^\s]+\.vercel\.app/);
  return { url: urlMatch?.[0] ?? null, log: out.slice(-400) };
}

/**
 * Point a hostname at a deployment (API — works without CLI user token).
 * @param {{ token: string, teamId: string }} cfg
 * @param {string} deploymentIdOrUrl
 * @param {string} alias
 */
export async function apiSetAlias(cfg, deploymentIdOrUrl, alias) {
  return vercelFetch("/v2/aliases", cfg.token, cfg.teamId, {
    method: "POST",
    body: JSON.stringify({
      alias,
      // API accepts deployment id (dpl_…) or URL hostname.
      deploymentId: deploymentIdOrUrl,
    }),
  });
}

async function main() {
  const token = stripSecret(process.env.VERCEL_TOKEN);
  const teamId = stripSecret(process.env.VERCEL_ORG_ID);
  const projectId = stripSecret(process.env.VERCEL_PROJECT_ID);
  const projectName =
    stripSecret(process.env.VERCEL_PROJECT_NAME) || "catalyst-intel";
  const allowCli = process.env.VERCEL_UNBLOCK_ALLOW_CLI !== "0";

  if (!token || !teamId || !projectId) {
    console.warn(
      "::warning::VERCEL_TOKEN / VERCEL_ORG_ID / VERCEL_PROJECT_ID not set — skipping unblock redeploy. See DEPLOYMENT.md.",
    );
    process.exit(0);
  }

  const cfg = {
    token,
    teamId,
    projectId,
    projectName,
    allowCli,
  };

  // After a main push, poll Vercel for this SHA instead of sleeping blindly.
  const waitSha = stripSecret(process.env.VERCEL_UNBLOCK_WAIT_SHA);
  if (waitSha) {
    const timeoutMs = Number(process.env.VERCEL_UNBLOCK_WAIT_MS || 90_000);
    const intervalMs = Number(
      process.env.VERCEL_UNBLOCK_WAIT_INTERVAL_MS || 2_500,
    );
    console.log(
      `Polling Vercel for deploy decision on ${waitSha.slice(0, 8)}… (timeout ${timeoutMs}ms)`,
    );
    const waited = await waitForShaDeployOutcome(cfg, waitSha, {
      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 90_000,
      intervalMs: Number.isFinite(intervalMs) ? intervalMs : 2_500,
    });
    console.log(
      `Wait done: outcome=${waited.outcome} waitedMs=${waited.waitedMs}`,
    );
  }

  const out = await runUnblock(cfg);
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
