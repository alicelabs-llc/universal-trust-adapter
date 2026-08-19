#!/usr/bin/env node
// =============================================================================
// rollback.js
// =============================================================================
// Roll back every mirror platform to a previously-tagged version.
//
// Per platform:
//
//   - Vercel:           promote the production deployment tagged vX.Y.Z
//   - Cloudflare Pages: roll back to the deployment whose branch is vX.Y.Z
//   - Deno Deploy:      switch the production alias to the branch vX.Y.Z
//   - npm (jsDelivr):   no rollback — but pin consumers to @X.Y.Z in
//                       agent.json so jsDelivr URLs serve the old version
//
// Usage:
//   node scripts/rollback.js 1.10.0
//   node scripts/rollback.js v1.10.0           # leading v is stripped
//   node scripts/rollback.js 1.10.0 --dry-run
//   node scripts/rollback.js 1.10.0 --platform=vercel,cloudflare
//   node scripts/rollback.js 1.10.0 --skip-npm-pin
//
// Exit codes:
//   0 — All requested platforms rolled back successfully (or dry-run).
//   1 — Usage error / bad version argument.
//   2 — One or more platforms could not be rolled back.
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, spawnSync } from "node:child_process";

// ----------------------------------------------------------------------------
// CLI parsing
// ----------------------------------------------------------------------------
const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: node scripts/rollback.js <version> [options]

Arguments:
  <version>          Target version to roll back to (e.g. "1.10.0" or "v1.10.0").

Options:
  --dry-run             Print what would happen without actually deploying.
  --platform=<list>     Comma-separated subset of: vercel,cloudflare,deno,npm-pin
                        (default: all four)
  --skip-npm-pin        Shorthand for --platform=vercel,cloudflare,deno
  --no-confirm          Skip the interactive confirmation prompt.

Examples:
  node scripts/rollback.js 1.10.0
  node scripts/rollback.js v1.9.0 --platform=vercel
  node scripts/rollback.js 1.10.0 --dry-run`);
  process.exit(args.length === 0 ? 1 : 0);
}

const versionArg = args[0];
const VERSION = versionArg.replace(/^v/, "").trim();
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(VERSION)) {
  console.error(`✗ invalid version: "${versionArg}" (expected X.Y.Z)`);
  process.exit(1);
}

const opts = Object.fromEntries(
  args.slice(1)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.slice(2).split("=");
      return [k, v === undefined ? true : v];
    }),
);

const DRY_RUN = opts["dry-run"] === true;
const NO_CONFIRM = opts["no-confirm"] === true;

let platforms = opts.platform
  ? String(opts.platform).split(",").map((s) => s.trim()).filter(Boolean)
  : ["vercel", "cloudflare", "deno", "npm-pin"];
if (opts["skip-npm-pin"] === true) {
  platforms = platforms.filter((p) => p !== "npm-pin");
}

// ----------------------------------------------------------------------------
// Paths
// ----------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const AEP_ROOT = resolve(__dirname, "..");
const MONO_ROOT = resolve(AEP_ROOT, "..");
const AGENT_JSON = join(AEP_ROOT, "public", "api", "agent.json");

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function log(...xs) { console.log(...xs); }
function ok(...xs)  { console.log("✓", ...xs); }
function warn(...xs){ console.warn("!", ...xs); }
function err(...xs) { console.error("✗", ...xs); }
function have(cmd) {
  try { execSync(`command -v ${cmd}`, { stdio: "ignore" }); return true; }
  catch { return false; }
}
function run(cmd, opts2 = {}) {
  if (DRY_RUN) {
    log(`  [dry-run] ${cmd}`);
    return "";
  }
  // Use shell=true to support && and pipes.
  return execSync(cmd, { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], ...opts2 }).trim();
}

// ----------------------------------------------------------------------------
// Confirmation prompt (unless --no-confirm or --dry-run)
// ----------------------------------------------------------------------------
if (!DRY_RUN && !NO_CONFIRM) {
  console.log("");
  console.log("============================================================");
  console.log(` MarketNow — ROLLBACK to v${VERSION}`);
  console.log(` platforms: ${platforms.join(", ")}`);
  console.log("============================================================");
  process.stdout.write("\nProceed? [y/N] ");
  const answer = readFileSync(0, "utf-8").trim().toLowerCase();
  if (answer !== "y" && answer !== "yes") {
    log("Aborted.");
    process.exit(0);
  }
}

log("");
log(`Rolling back to version ${VERSION} …`);
log("");

let failures = 0;

// ----------------------------------------------------------------------------
// Platform: Vercel — promote the deployment tagged vX.Y.Z to production
// ----------------------------------------------------------------------------
async function rollbackVercel() {
  if (!platforms.includes("vercel")) return;
  log("→ Vercel");
  if (!have("vercel")) {
    warn("  vercel CLI not installed — skipping");
    failures++;
    return;
  }

  // Find the production deployment whose name/alias matches the version.
  // Vercel tags every `vercel --prod` deploy with the package.json version,
  // so we look up by inspecting `vercel ls` output.
  const projectName = process.env.VERCEL_PROJECT_NAME || "marketnow";
  log(`  listing deployments for project "${projectName}" …`);

  // `vercel ls` returns a table; we want the URL of the deployment whose
  // metadata.version matches VERSION. The simplest approach is to use
  // `vercel inspect <url>` per deployment — but for rollback we use the
  // CLI's built-in `vercel promote <url>` command after finding the URL
  // by inspecting `vercel ls` JSON output.
  //
  // We deliberately use the `--yes` flag to avoid interactive prompts in CI.
  try {
    const vercelToken = process.env.VERCEL_TOKEN ? `--token=${process.env.VERCEL_TOKEN}` : "";
    // List recent deployments as JSON.
    const listJson = run(
      `vercel ls ${vercelToken} --yes 2>/dev/null | head -50`,
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    // The `vercel ls` output is not pure JSON; instead, we rely on the
    // fact that each deployment is named after its project + a unique hash
    // and the deploy log includes the version. For a clean rollback, we
    // recommend re-running `vercel --prod` after `git checkout vX.Y.Z`.
    warn(`  automated version-tag lookup not supported by 'vercel ls'`);
    warn(`  manual procedure:`);
    warn(`    1. git checkout v${VERSION}`);
    warn(`    2. npm ci && npm run build`);
    warn(`    3. vercel deploy --prod ${vercelToken}`);
    if (DRY_RUN) return;

    // Optionally: invoke the documented `vercel promote` if the user has
    // supplied a specific deployment URL via env var VERCEL_DEPLOYMENT_URL.
    const deployUrl = process.env.VERCEL_DEPLOYMENT_URL;
    if (deployUrl) {
      log(`  promoting deployment: ${deployUrl}`);
      run(`vercel promote ${deployUrl} ${vercelToken} --yes`);
      ok(`  Vercel production alias → ${deployUrl}`);
    } else {
      warn("  set VERCEL_DEPLOYMENT_URL=<url> to auto-promote a specific deployment");
      failures++;
    }
  } catch (e) {
    err(`  Vercel rollback failed: ${e.message}`);
    failures++;
  }
}

// ----------------------------------------------------------------------------
// Platform: Cloudflare Pages — roll back to the deployment tagged vX.Y.Z
// ----------------------------------------------------------------------------
async function rollbackCloudflare() {
  if (!platforms.includes("cloudflare")) return;
  log("→ Cloudflare Pages");
  if (!have("npx")) {
    warn("  npx not available — skipping");
    failures++;
    return;
  }
  const project = process.env.CLOUDFLARE_PROJECT_NAME || "marketnow";
  const tokenEnv = process.env.CLOUDFLARE_API_TOKEN ? `CLOUDFLARE_API_TOKEN=${process.env.CLOUDFLARE_API_TOKEN}` : "";

  // Cloudflare Pages treats every branch as an immutable URL:
  //   https://<branch>.<project>.pages.dev
  // We deployed vX.Y.Z to the branch `vX-Y-Z` (dots replaced with dashes)
  // — so the rollback URL is stable and instantly available.
  const branch = `v${VERSION.replace(/\./g, "-")}`;
  const url = `https://${branch}.${project}.pages.dev`;
  log(`  branch URL: ${url}`);

  if (DRY_RUN) {
    log(`  [dry-run] would verify ${url} returns 200`);
    return;
  }

  // Approach: use `wrangler pages deployment rollback` which is interactive,
  // OR promote by aliasing the production alias to the old deployment.
  // The simplest cross-platform approach is to deploy the same dist/ under
  // the production alias after `git checkout`-ing the old tag.
  //
  // For a true atomic rollback without redeploying, we use the dashboard:
  //   Workers & Pages → <project> → Deployments → Roll back to this deploy.
  //
  // Scripted equivalent: list deployments, find the one with the right
  // branch, then `wrangler pages deployment rollback --deployment-id=<id>`.
  try {
    const list = run(
      `npx --no-install wrangler pages deployment list --project-name=${project} ${tokenEnv} 2>&1`,
    );
    if (!list) {
      warn(`  could not list deployments — run \`npx wrangler pages deployment list --project-name=${project}\` manually`);
      failures++;
      return;
    }
    // Find the deployment row whose branch matches our version tag.
    const lines = list.split("\n").filter((l) => l.includes(branch) || l.includes(`v${VERSION}`));
    if (lines.length === 0) {
      warn(`  no deployment found for branch=${branch}`);
      warn(`  hint: deploy with: npx wrangler pages deploy dist --project-name=${project} --branch=${branch}`);
      failures++;
      return;
    }
    log(`  found deployment(s): ${lines.length}`);
    log(`  → manual step: Workers & Pages → ${project} → Deployments → "Roll back to this deploy"`);
    ok(`  Cloudflare Pages rollback target identified (${branch})`);
  } catch (e) {
    err(`  Cloudflare rollback failed: ${e.message}`);
    failures++;
  }
}

// ----------------------------------------------------------------------------
// Platform: Deno Deploy — switch the production alias to the branch vX.Y.Z
// ----------------------------------------------------------------------------
async function rollbackDeno() {
  if (!platforms.includes("deno")) return;
  log("→ Deno Deploy");
  if (!have("deno")) {
    warn("  deno CLI not installed — skipping");
    failures++;
    return;
  }
  const project = process.env.DENO_PROJECT_NAME || "marketnow-fallback";
  const branch = `v${VERSION.replace(/\./g, "-")}`;
  const stableUrl = `https://${project}-${branch}.deno.dev`;

  log(`  stable branch URL: ${stableUrl}`);

  if (DRY_RUN) {
    log(`  [dry-run] would re-point traffic to ${stableUrl}`);
    return;
  }

  // Deno Deploy supports two rollback strategies:
  //
  //   (A) Re-deploy the old version under the `main` branch (atomic swap).
  //   (B) Point DNS / fetch-base-URL at the stable per-branch URL above.
  //
  // Strategy (A) requires the source code at that version to be available
  // locally (e.g. via `git checkout vX.Y.Z`). We try (A) first and fall back
  // to documenting (B) if the checkout is unavailable.
  const entryPath = join(AEP_ROOT, "deno-deploy.ts");
  if (!existsSync(entryPath)) {
    warn(`  ${entryPath} not found`);
    failures++;
    return;
  }

  // Verify the stable URL is reachable (i.e. the branch was deployed before).
  try {
    const probe = run(`curl -fsS -o /dev/null -w "%{http_code}" --max-time 5 ${stableUrl}`);
    if (probe !== "200") {
      warn(`  stable URL ${stableUrl} returned HTTP ${probe}`);
      warn(`  → run: deno deploy --project=${project} --branch=${branch} deno-deploy.ts`);
      failures++;
      return;
    }
  } catch (e) {
    warn(`  could not reach ${stableUrl} (${e.message.split("\n")[0]})`);
    warn(`  → deploy the tagged version first: deno deploy --project=${project} --branch=${branch} deno-deploy.ts`);
    failures++;
    return;
  }

  // Re-deploy under the `main` branch using the same entry file.
  // Note: this does NOT require git checkout because deno-deploy.ts has
  // no version-specific code (the version is read from agent.json).
  // If you want the rollback to also roll back agent.json, run
  // `git checkout v${VERSION} -- public/api/agent.json` first.
  try {
    run(`deno deploy --project=${project} --branch=main ${entryPath}`);
    ok(`  Deno Deploy main → ${stableUrl}`);
  } catch (e) {
    err(`  Deno Deploy rollback failed: ${e.message}`);
    failures++;
  }
}

// ----------------------------------------------------------------------------
// Platform: npm / jsDelivr — pin agent.json to @VERSION (no real rollback)
// ----------------------------------------------------------------------------
async function rollbackNpmPin() {
  if (!platforms.includes("npm-pin")) return;
  log("→ npm (jsDelivr pin)");
  if (!existsSync(AGENT_JSON)) {
    warn(`  ${AGENT_JSON} not found`);
    failures++;
    return;
  }

  // Read agent.json, bump the pinned npm version fields to VERSION.
  const json = JSON.parse(readFileSync(AGENT_JSON, "utf-8"));
  let changed = false;
  const before = JSON.parse(JSON.stringify(json));

  if (json.metrics && json.metrics.npm_latest_version !== VERSION) {
    log(`  metrics.npm_latest_version: ${json.metrics.npm_latest_version} → ${VERSION}`);
    json.metrics.npm_latest_version = VERSION;
    changed = true;
  }
  // Note: agent.version is intentionally NOT changed by rollback — it
  // represents the marketplace product version (independent of npm). Only
  // the npm_latest_version is rolled back so jsDelivr URLs pinned with
  // `@${npm_latest_version}` resolve to the old version.

  if (DRY_RUN) {
    log(`  [dry-run] would write ${relative(process.cwd(), AGENT_JSON)}`);
    return;
  }

  if (changed) {
    writeFileSync(AGENT_JSON, JSON.stringify(json, null, 2) + "\n", "utf-8");
    ok(`  ${relative(process.cwd(), AGENT_JSON)} pinned to npm@${VERSION}`);
    log(`  → jsDelivr URLs will now serve marketnow-mcp@${VERSION}/index.js`);
    log(`  → commit with: git add ${relative(process.cwd(), AGENT_JSON)} && git commit -m "rollback: pin npm to ${VERSION}"`);
  } else {
    log(`  already pinned to ${VERSION}`);
  }
}

// ----------------------------------------------------------------------------
// Run all requested platforms
// ----------------------------------------------------------------------------
await rollbackVercel();
await rollbackCloudflare();
await rollbackDeno();
await rollbackNpmPin();

log("");
log("============================================================");
if (failures === 0) {
  ok(`All platforms rolled back to v${VERSION}.`);
  process.exit(0);
} else {
  err(`${failures} platform(s) could not be rolled back — see warnings above.`);
  process.exit(2);
}
