#!/usr/bin/env python3
"""
Generates patch files (.patch) ready for `git apply`.

For each fixed file, we:
  1. Download/copy the original
  2. Save the fixed version
  3. Run `diff -u` to produce a unified diff
  4. Write it as patches/<filename>.patch

Usage:
  cd /path/to/marketnow-repo
  git apply patches/agent.json.patch
  git apply patches/package.json.patch
"""
import subprocess
import urllib.request
from pathlib import Path

BASE = Path('/home/z/my-project/download/marketnow-fixes')
PATCH_DIR = BASE / 'patches'
PATCH_DIR.mkdir(parents=True, exist_ok=True)

# Staging directories for originals
ORIG_DIR = Path('/tmp/marketnow-orig')
FIXED_DIR = Path('/tmp/marketnow-fixed')
ORIG_DIR.mkdir(parents=True, exist_ok=True)
FIXED_DIR.mkdir(parents=True, exist_ok=True)


def fetch_originals():
    """Download the original files from the live site / npm."""
    # agent.json from live site
    print("Fetching original agent.json...")
    urllib.request.urlretrieve("https://marketnow.site/api/agent.json", ORIG_DIR / "agent.json")

    # package.json from npm registry
    print("Fetching original package.json from npm...")
    import json
    with urllib.request.urlopen("https://registry.npmjs.org/marketnow-mcp") as r:
        npm_data = json.loads(r.read())
    latest = npm_data['dist-tags']['latest']
    pkg = npm_data['versions'][latest]
    with (ORIG_DIR / 'package.json').open('w') as f:
        json.dump(pkg, f, indent=2, ensure_ascii=False)
        f.write('\n')

    # LICENSE — original doesn't exist (404 repo), create empty placeholder
    print("Creating placeholder for missing LICENSE...")
    (ORIG_DIR / 'LICENSE').write_text(
        "# ORIGINAL LICENSE FILE WAS MISSING\n"
        "# The repo at github.com/edgarfloresguerra2011-a11y/marketnow returns 404\n"
        "# (audit finding F2)\n"
    )
    (ORIG_DIR / 'README.md').write_text(
        "# ORIGINAL README.md WAS MISSING\n"
        "# The repo at github.com/edgarfloresguerra2011-a11y/marketnow returns 404\n"
        "# (audit finding F2)\n"
    )
    (ORIG_DIR / '.github' / 'SECURITY.md').parent.mkdir(parents=True, exist_ok=True)
    (ORIG_DIR / '.github' / 'SECURITY.md').write_text(
        "# ORIGINAL .github/SECURITY.md WAS MISSING\n"
    )
    (ORIG_DIR / 'NOTICE').write_text("# ORIGINAL NOTICE WAS MISSING\n")


def stage_fixed():
    """Copy the fixed files to staging."""
    print("Staging fixed files...")
    (FIXED_DIR / 'agent.json').write_bytes((BASE / 'agent.json.fixed').read_bytes())
    (FIXED_DIR / 'package.json').write_bytes((BASE / 'package.json.fixed').read_bytes())
    (FIXED_DIR / 'LICENSE').write_bytes((BASE / 'LICENSE').read_bytes())
    (FIXED_DIR / 'README.md').write_bytes((BASE / 'README.md').read_bytes())
    (FIXED_DIR / '.github').mkdir(parents=True, exist_ok=True)
    (FIXED_DIR / '.github' / 'SECURITY.md').write_bytes((BASE / '.github' / 'SECURITY.md').read_bytes())
    (FIXED_DIR / 'NOTICE').write_bytes((BASE / 'NOTICE').read_bytes())


def make_patches():
    """Generate unified diff .patch files for each."""
    files = [
        ('agent.json', 'agent.json'),
        ('package.json', 'package.json'),
        ('LICENSE', 'LICENSE'),
        ('README.md', 'README.md'),
        ('.github/SECURITY.md', 'github-SECURITY.md'),
        ('NOTICE', 'NOTICE'),
    ]
    for orig_rel, patch_name in files:
        orig = ORIG_DIR / orig_rel
        fixed = FIXED_DIR / orig_rel
        if not orig.exists() or not fixed.exists():
            print(f"  SKIP {patch_name} (missing file)")
            continue
        try:
            result = subprocess.run(
                ['diff', '-u', '--label', f'a/{orig_rel}', '--label', f'b/{orig_rel}',
                 str(orig), str(fixed)],
                capture_output=True, text=True
            )
            patch_text = result.stdout
            # Prepend a patch header
            patch_path = PATCH_DIR / f'{patch_name}.patch'
            patch_path.write_text(patch_text if patch_text else "# No changes\n")
            line_count = patch_text.count('\n')
            print(f"  Wrote {patch_path.name} ({line_count} diff lines)")
        except Exception as e:
            print(f"  FAIL {patch_name}: {e}")


if __name__ == '__main__':
    fetch_originals()
    stage_fixed()
    make_patches()
    print("\nDone. Patch files in:", PATCH_DIR)
    print("\nTo apply:")
    print("  cd /path/to/marketnow-repo")
    print("  git apply patches/agent.json.patch")
    print("  git apply patches/package.json.patch")
    print("  # LICENSE, README.md, .github/SECURITY.md, NOTICE are new files - use:")
    print("  cp ../marketnow-fixes/LICENSE . && cp ../marketnow-fixes/README.md . && ...")
