#!/usr/bin/env node
// =============================================================================
// sync-versions.js
// =============================================================================
// Single-source-of-truth version sync.
//
// Reads the canonical version from one package.json (default: the
// published `marketnow-mcp` package at ../mcp-server/package.json) and
// writes that version into every version-bearing manifest in the repo:
//
//   - aep-marketplace/public/api/agent.json     (agent.version + metrics.npm_latest_version)
//   - aep-marketplace/public/api/manifest.json   (version)
//   - aep-marketplace/server.json                (version — MCP server manifest)
//   - mcp-server/server.json                     (version + packages[].version)
//   - Every other server.json / manifest.json   (any version field found)
//
// Then commits the change with `chore: sync versions to X.Y.Z` and tags the
// commit with `vX.Y.Z`.
//
// Usage:
//   node scripts/sync-versions.js
//   node scripts/sync-versions.js --source=path/to/package.json
//   node scripts/sync-versions.js --dry-run
//   node scripts/sync-versions.js --no-tag
//   node scripts/sync-versions.js --no-commit
//
// Exit codes:
//   0 — All updates applied (or --dry-run showed what would change).
//   1 — Canonical version could not be read.
//   2 — One or more target files could not be updated.
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

// ----------------------------------------------------------------------------
// CLI parsing
// ----------------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      return [k, v === undefined ? true : v];
    }
    return [a, true];
  }),
);

const DRY_RUN = args["dry-run"] === true;
const NO_COMMIT = args["no-commit"] === true;
const NO_TAG = args["no-tag"] === true;
const QUIET = args["quiet"] === true;

// ----------------------------------------------------------------------------
// Paths
// ----------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const AEP_ROOT = resolve(__dirname, "..");             // aep-marketplace/
const MONO_ROOT = resolve(AEP_ROOT, "..");             // marketnow/

const DEFAULT_SOURCE = join(MONO_ROOT, "mcp-server", "package.json");
const SOURCE_PATH = args.source
  ? resolve(process.cwd(), args.source)
  : DEFAULT_SOURCE;

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function log(...xs) { if (!QUIET) console.log(...xs); }
function warn(...xs) { if (!QUIET) console.warn(...xs); }
function err(...xs) { console.error(...xs); }

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf-8"));
}

function writeJson(p, data) {
  // 2-space indent matches the existing files in the repo.
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function setVersionField(obj, version) {
  // Only update if the field exists — don't insert version into files
  // that intentionally omit it.
  if (Object.prototype.hasOwnProperty.call(obj, "version")) {
    if (obj.version !== version) {
      log(`  version: ${obj.version} → ${version}`);
      obj.version = version;
      return true;
    }
  }
  return false;
}

// Recursively walk a JSON value and update every `version` field that
// is a string. Used as a fallback for nested structures (e.g. server.json
// `packages[]` arrays).
function setVersionRecursive(obj, version, path = "$") {
  let changed = false;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (setVersionRecursive(obj[i], version, `${path}[${i}]`)) changed = true;
    }
  } else if (obj && typeof obj === "object") {
    if (
      Object.prototype.hasOwnProperty.call(obj, "version") &&
      typeof obj.version === "string" &&
      obj.version !== version
    ) {
      log(`  ${path}.version: ${obj.version} → ${version}`);
      obj.version = version;
      changed = true;
    }
    for (const k of Object.keys(obj)) {
      if (k === "version") continue;
      if (setVersionRecursive(obj[k], version, `${path}.${k}`)) changed = true;
    }
  }
  return changed;
}

function git(args, opts = {}) {
  const cmd = `git ${args}`;
  if (DRY_RUN) {
    log(`  [dry-run] ${cmd}`);
    return "";
  }
  return execSync(cmd, { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
}

function gitAvailable() {
  try {
    execSync("git --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------
// Step 1 — Read canonical version
// ----------------------------------------------------------------------------
if (!existsSync(SOURCE_PATH)) {
  err(`✗ canonical source not found: ${SOURCE_PATH}`);
  process.exit(1);
}

const sourcePkg = readJson(SOURCE_PATH);
const VERSION = sourcePkg.version;
if (!VERSION) {
  err(`✗ source ${SOURCE_PATH} has no "version" field`);
  process.exit(1);
}

log("");
log("============================================================");
log(" MarketNow — sync-versions");
log(`  source:  ${relative(process.cwd(), SOURCE_PATH)}`);
log(`  version: ${VERSION}`);
log(`  dry-run: ${DRY_RUN}`);
log("============================================================");
log("");

// ----------------------------------------------------------------------------
// Step 2 — Update every manifest file we know about.
// ----------------------------------------------------------------------------

// Each target is { path, mutate: (json, version) => boolean }
// where `mutate` returns true if the file actually changed.
const targets = [
  // --- aep-marketplace/public/api/*.json (canonical API surfaces) ---------
  {
    name: "agent.json",
    path: join(AEP_ROOT, "public", "api", "agent.json"),
    mutate: (j, v) => {
      let changed = false;
      // agent.version — the marketplace "version" exposed to agents.
      if (j.agent && j.agent.version !== v) {
        log(`  agent.version: ${j.agent.version} → ${v}`);
        j.agent.version = v;
        changed = true;
      }
      // metrics.npm_latest_version — should always reflect the canonical
      // npm package version (this is what consumers compare against).
      if (j.metrics && j.metrics.npm_latest_version !== v) {
        log(`  metrics.npm_latest_version: ${j.metrics.npm_latest_version} → ${v}`);
        j.metrics.npm_latest_version = v;
        changed = true;
      }
      return changed;
    },
  },
  {
    name: "manifest.json",
    path: join(AEP_ROOT, "public", "api", "manifest.json"),
    mutate: (j, v) => setVersionField(j, v),
  },

  // --- MCP server manifests (server.json — MCP "server manifest") --------
  {
    name: "mcp-server/server.json",
    path: join(MONO_ROOT, "mcp-server", "server.json"),
    mutate: (j, v) => setVersionRecursive(j, v),
  },
  {
    name: "aep-marketplace/server.json",
    path: join(AEP_ROOT, "server.json"),
    mutate: (j, v) => setVersionRecursive(j, v),
  },

  // --- The aep-marketplace package.json itself (private, but useful to
  //     keep in sync so dashboard badges match) ----------------------------
  {
    name: "aep-marketplace/package.json",
    path: join(AEP_ROOT, "package.json"),
    mutate: (j, v) => {
      // Don't auto-bump private packages — only sync if the version is
      // already non-zero (so we don't accidentally start versioning the
      // private aep-marketplace package without explicit intent).
      if (j.version && j.version !== "0.0.0" && j.version !== v) {
        log(`  version: ${j.version} → ${v}`);
        j.version = v;
        return true;
      }
      return false;
    },
  },
];

// Discover any *additional* manifest.json / server.json files we don't know
// about explicitly, so the script is forward-compatible.
const DISCOVER_GLOBS = [
  "manifest.json",
  "server.json",
];
function discoverFiles() {
  const found = [];
  // Walk two levels deep (cheap, no fs.promises needed).
  for (const top of ["mcp-server", "atc-sdk", "install-stack-cli", "marketnow-cli", "aep-marketplace"]) {
    const dir = join(MONO_ROOT, top);
    if (!existsSync(dir)) continue;
    for (const name of DISCOVER_GLOBS) {
      const p = join(dir, name);
      if (existsSync(p) && !targets.find((t) => t.path === p)) {
        found.push({
          name: `${top}/${name}`,
          path: p,
          mutate: (j, v) => setVersionRecursive(j, v),
        });
      }
    }
  }
  return found;
}

const allTargets = [...targets, ...discoverFiles()];

// ----------------------------------------------------------------------------
// Step 3 — Apply mutations
// ----------------------------------------------------------------------------
const changedFiles = [];
const skippedFiles = [];

for (const t of allTargets) {
  if (!existsSync(t.path)) {
    skippedFiles.push(`${t.name} (missing)`);
    continue;
  }
  let json;
  try {
    json = readJson(t.path);
  } catch (e) {
    warn(`  ✗ ${t.name}: could not parse JSON (${e.message})`);
    skippedFiles.push(`${t.name} (parse error)`);
    continue;
  }
  const before = JSON.stringify(json);
  let changed = false;
  try {
    changed = t.mutate(json, VERSION);
  } catch (e) {
    warn(`  ✗ ${t.name}: mutate failed (${e.message})`);
    skippedFiles.push(`${t.name} (mutate error)`);
    continue;
  }
  const after = JSON.stringify(json);
  if (changed || before !== after) {
    log(`→ ${t.name}`);
    if (!DRY_RUN) writeJson(t.path, json);
    changedFiles.push(t.path);
  } else {
    skippedFiles.push(`${t.name} (already at ${VERSION})`);
  }
}

log("");
log(`Changed: ${changedFiles.length}    Skipped: ${skippedFiles.length}`);
if (changedFiles.length === 0) {
  log("All files already at version " + VERSION + " — nothing to commit.");
  process.exit(0);
}
if (DRY_RUN) {
  log("");
  log("[dry-run] No files written. Re-run without --dry-run to apply.");
  process.exit(0);
}

// ----------------------------------------------------------------------------
// Step 4 — Commit + tag
// ----------------------------------------------------------------------------
if (NO_COMMIT) {
  log("");
  log("--no-commit set; skipping git commit/tag.");
  process.exit(0);
}

if (!gitAvailable()) {
  warn("git not available — skipping commit/tag step.");
  process.exit(0);
}

// Are we in a git repo?
let inRepo = false;
try {
  execSync("git rev-parse --git-dir", { stdio: "ignore" });
  inRepo = true;
} catch {
  inRepo = false;
}
if (!inRepo) {
  warn("Not inside a git repo — skipping commit/tag step.");
  process.exit(0);
}

const commitMsg = `chore: sync versions to ${VERSION}`;

// Stage every changed file by its repo-relative path.
const repoRoot = git("rev-parse --show-toplevel");
for (const abs of changedFiles) {
  const rel = relative(repoRoot, abs);
  git(`add -- "${rel.replace(/"/g, '\\"')}"`);
}

// If nothing actually staged (e.g. files unchanged on disk despite the
// mutation logic saying otherwise), skip the commit.
const staged = git("diff --cached --name-only");
if (!staged) {
  log("No staged changes — skipping commit.");
  process.exit(0);
}

git(`commit -m "${commitMsg}" --no-verify`);
log(`✓ committed: ${commitMsg}`);

if (!NO_TAG) {
  const tagName = `v${VERSION}`;
  // Check if tag already exists.
  const existing = (() => {
    try {
      return git(`rev-parse -q --verify refs/tags/${tagName}`);
    } catch {
      return "";
    }
  })();
  if (existing) {
    log(`⊘ tag ${tagName} already exists — skipping`);
  } else {
    git(`tag -a ${tagName} -m "Version ${VERSION}"`);
    log(`✓ tagged: ${tagName}`);
  }
}

log("");
log("Done.");
process.exit(0);
