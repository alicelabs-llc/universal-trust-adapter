/**
 * P3-2: SBOM generation script — wired into `npm run build`.
 *
 * Generates an SPDX 2.3 SBOM for each workspace package and writes it to
 * dist/{package}/sbom.spdx.json. The SBOM's documentHash is intended to
 * be embedded into ATC v3 credentials' artifact_binding.sbom_hash field
 * by the CA issuance tooling.
 *
 * Usage:
 *   node scripts/generate-sbom.js
 *
 * Output:
 *   packages/core/dist/sbom.spdx.json
 *   packages/adapters/dist/sbom.spdx.json
 *   packages/gateway/dist/sbom.spdx.json
 *   (one per workspace package that has a dist/ directory)
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

// Find all workspace packages with a dist/ directory (i.e., they were built)
// The TypeScript compiler outputs to ROOT/dist/packages/{name}/ because
// tsconfig.json uses rootDir = "." (the repo root).
const packagesDir = path.join(ROOT, 'packages');
const rootDistDir = path.join(ROOT, 'dist', 'packages');
const workspaces = fs.readdirSync(packagesDir)
  .filter(name => {
    const pkgJsonPath = path.join(packagesDir, name, 'package.json');
    return fs.existsSync(pkgJsonPath);
  })
  .map(name => ({
    name,
    dir: path.join(packagesDir, name),
    distDir: path.join(rootDistDir, name),
  }));

let generated = 0;
const errors = [];

for (const pkg of workspaces) {
  if (!fs.existsSync(pkg.distDir)) {
    continue;
  }
  try {
    const coreDist = path.join(ROOT, 'dist', 'packages', 'core', 'supply-chain.js');
    let generateSBOM;
    if (fs.existsSync(coreDist)) {
      generateSBOM = require(coreDist).generateSBOM;
    } else {
      const localDist = path.join(pkg.distDir, 'supply-chain.js');
      if (fs.existsSync(localDist)) {
        generateSBOM = require(localDist).generateSBOM;
      } else {
        throw new Error(`No supply-chain.js found in ${coreDist} or ${localDist}`);
      }
    }

    const sbom = generateSBOM({
      rootDir: pkg.dir,
      artifactPath: 'dist',
      creator: 'Organization: AliceLabs LLC',
    });

    const outPath = path.join(pkg.distDir, 'sbom.spdx.json');
    fs.writeFileSync(outPath, JSON.stringify(sbom, null, 2) + '\n', 'utf-8');
    console.log(`✅ ${pkg.name}: wrote sbom.spdx.json (${sbom.packages.length} packages, hash=${sbom.documentHash.slice(0, 24)}…)`);
    generated++;
  } catch (e) {
    errors.push(`${pkg.name}: ${e.message}`);
    console.error(`❌ ${pkg.name}: ${e.message}`);
  }
}

console.log(`\nGenerated ${generated} SBOMs`);
if (errors.length > 0) {
  console.error(`${errors.length} errors:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
