#!/usr/bin/env node
/**
 * Adds proprietary copyright headers to all Sentinel engine files.
 * Run this after modifying any Sentinel file to ensure headers are present.
 *
 * Usage: node scripts/add-copyright-headers.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, '..');

const SENTINEL_HEADER = `/**
 * ⚠️ SENTINEL PROPRIETARY — Copyright (c) 2026 AliceLabs LLC. All Rights Reserved.
 *
 * This file is part of the Sentinel Security Audit Engine.
 * DO NOT COPY, REDISTRIBUTE, OR BUILD COMPETING PRODUCTS.
 * See SENTINEL-LICENSE for full terms.
 *
 * "Sentinel" is a trademark of AliceLabs LLC.
 * Patent pending on the 3-layer audit pipeline (L1.5 → L1.6 → L2).
 *
 * For licensing: legal@alicelabs.site
 * For verification: https://marketnow.site/verify
 */
`;

const SENTINEL_HEADER_PY = `# ⚠️ SENTINEL PROPRIETARY — Copyright (c) 2026 AliceLabs LLC. All Rights Reserved.
#
# This file is part of the Sentinel Security Audit Engine.
# DO NOT COPY, REDISTRIBUTE, OR BUILD COMPETING PRODUCTS.
# See SENTINEL-LICENSE for full terms.
#
# "Sentinel" is a trademark of AliceLabs LLC.
# Patent pending on the 3-layer audit pipeline (L1.5 → L1.6 → L2).
#
# For licensing: legal@alicelabs.site
# For verification: https://marketnow.site/verify
`;

const SENTINEL_HEADER_SH = `#!/usr/bin/env bash
# ⚠️ SENTINEL PROPRIETARY — Copyright (c) 2026 AliceLabs LLC. All Rights Reserved.
#
# This file is part of the Sentinel Security Audit Engine.
# DO NOT COPY, REDISTRIBUTE, OR BUILD COMPETING PRODUCTS.
# See SENTINEL-LICENSE for full terms.
#
# "Sentinel" is a trademark of AliceLabs LLC.
# Patent pending on the 3-layer audit pipeline (L1.5 → L1.6 → L2).
`;

// Files that MUST have the Sentinel proprietary header
const SENTINEL_FILES = [
  { path: 'aep-marketplace/lib/sentinel-audit.mjs', type: 'js' },
  { path: 'aep-marketplace/lib/sentinel-l16.mjs', type: 'js' },
  { path: 'aep-marketplace/lib/sentinel-l2-trigger.mjs', type: 'js' },
  { path: 'aep-marketplace/api/audit-skill.js', type: 'js' },
  { path: 'scripts/l2-analyze.py', type: 'py' },
  { path: 'scripts/l2-build-docker.sh', type: 'sh' },
  { path: 'scripts/l2-parse-url.py', type: 'py' },
  { path: 'scripts/audit-all-skills.mjs', type: 'js' },
  { path: 'scripts/generate-badges.mjs', type: 'js' },
  { path: 'scripts/monitor-github-issue.mjs', type: 'js' },
];

function addHeader(filePath, type) {
  const fullPath = path.join(REPO_ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`  ⊘ ${filePath} — not found, skipping`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const header = type === 'py' ? SENTINEL_HEADER_PY : type === 'sh' ? SENTINEL_HEADER_SH : SENTINEL_HEADER;

  // Check if header already exists
  if (content.includes('SENTINEL PROPRIETARY')) {
    console.log(`  ✓ ${filePath} — header already present`);
    return false;
  }

  // For .sh files, replace the existing shebang
  if (type === 'sh' && content.startsWith('#!/usr/bin/env bash\n')) {
    content = header + '\n' + content.substring(content.indexOf('\n') + 1);
  } else if (type === 'py' && content.startsWith('#!')) {
    // Keep shebang, add header after
    const shebangEnd = content.indexOf('\n') + 1;
    content = content.substring(0, shebangEnd) + '\n' + header + content.substring(shebangEnd);
  } else if (type === 'js' && content.startsWith('/*')) {
    // File already has a comment block — prepend our header
    content = header + '\n' + content;
  } else {
    content = header + '\n' + content;
  }

  fs.writeFileSync(fullPath, content);
  console.log(`  ✅ ${filePath} — header added`);
  return true;
}

console.log('Adding Sentinel proprietary copyright headers...\n');

let added = 0;
for (const file of SENTINEL_FILES) {
  if (addHeader(file.path, file.type)) added++;
}

console.log(`\n✅ Done. ${added} files updated.`);
console.log('\nThese files are now marked as SENTINEL PROPRIETARY.');
console.log('Do NOT remove the headers — they are legally required.');
