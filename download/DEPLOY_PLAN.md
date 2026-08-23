# 🚀 Action Plan: Update GitHub + Activate Anti-Ban Routes

## What's broken right now

| Problem | Impact |
|---------|--------|
| GitHub repo (`universal-trust-adapter`) is 3 commits behind local | Users who clone from GitHub get OLD code (v1.0.0), but NPM has v2.0.0 |
| `git push` from local fails — no GitHub PAT configured | Can't push the 3 commits |
| `marketnow.site/install.sh` returns HTML (catch-all route) | Pretty URLs don't work, only `/uta-packages/*.tgz` works |
| `/trust-card.json` returns HTML, not JSON | AI agents can't verify trustworthiness |

## What ALREADY works (verified — proof)

✅ **4 independent download channels serving IDENTICAL code** (sha256 verified):

```
Channel 1 (NPM):
  https://registry.npmjs.org/@marketnow/uts/-/uts-2.0.0.tgz
  sha256: 352e90e0aef7c5bb07e35533100f9325220c7cd52efadbba1f9b1180096ae923

Channel 2 (jsDelivr CDN — free mirror of NPM):
  https://cdn.jsdelivr.net/npm/@marketnow/uts@2.0.0/
  → returns package.json + every file in the published package

Channel 3 (unpkg CDN — free mirror of NPM):
  https://unpkg.com/@marketnow/uts@2.0.0/
  → same as jsDelivr, different CDN provider

Channel 4 (marketnow.site direct — AliceLabs-owned):
  https://marketnow.site/uta-packages/marketnow-uts-2.0.0.tgz
  sha256: 352e90e0aef7c5bb07e35533100f9325220c7cd52efadbba1f9b1180096ae923
```

**If GitHub bans us tomorrow**: NPM, jsDelivr, unpkg, and marketnow.site direct STILL serve the code. None of them depend on GitHub.

## Action items (3 steps)

### Step 1 — Push 3 commits to GitHub (~5 min)

You need a GitHub Personal Access Token (PAT) with `repo` scope:
1. Go to https://github.com/settings/tokens
2. Generate new classic token, scope: `repo` (full control of private repos)
3. Save the token somewhere safe

Then run:
```bash
cd /home/z/my-project
export GH_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
git remote set-url origin "https://eddyflores100-lang:${GH_TOKEN}@github.com/eddyflores100-lang/universal-trust-adapter.git"
git push origin main

# Verify:
git log origin/main..HEAD  # should output nothing (we're in sync)
```

**Alternative — if you prefer a bundle file:**
```bash
# Clone the bundle into a fresh repo and push:
cd /tmp
git clone /home/z/my-project/download/uta-to-push.bundle uta-fresh
cd uta-fresh
git remote add origin "https://YOUR_USER:YOUR_PAT@github.com/eddyflores100-lang/universal-trust-adapter.git"
git push -f origin main
```

### Step 2 — Deploy marketnow.site updates (~3 min)

The updated files are already in `/home/z/my-project/marketnow/aep-marketplace/`. You just need to deploy.

**Option A — Vercel CLI** (recommended):
```bash
cd /home/z/my-project/marketnow/aep-marketplace
export VERCEL_TOKEN="your-new-vercel-token-here"  # current token expired
npx vercel --prod --token "$VERCEL_TOKEN"
```

**Option B — Git + auto-deploy** (if you have Vercel connected to GitHub):
```bash
cd /home/z/my-project/marketnow/aep-marketplace
git add public/install.sh public/resilience.json public/.well-known/keys.json \
        public/releases.html api/resilience.js api/trust-card.js vercel.json
git commit -m "feat: add anti-ban resilience endpoints + multi-source installer"
git push
# Vercel auto-deploys on push
```

**Option C — Vercel dashboard**:
- Go to https://vercel.com/dashboard
- Find the marketnow project
- Click "Redeploy" with the latest commit

### Step 3 — Verify everything works (~1 min)

```bash
# Test all endpoints return real content (not HTML)
echo "1. install.sh returns shell script:"
curl -fsSL https://marketnow.site/install.sh | head -3

echo ""
echo "2. resilience.json returns JSON manifest:"
curl -fsSL https://marketnow.site/resilience.json | python3 -m json.tool | head -10

echo ""
echo "3. trust-card.json returns JSON trust card:"
curl -fsSL https://marketnow.site/trust-card.json | python3 -m json.tool | head -10

echo ""
echo "4. /download/uts.tgz returns real gzip:"
curl -fsSL -o /tmp/uts.tgz https://marketnow.site/download/uts.tgz
file /tmp/uts.tgz  # should say "gzip compressed data"

echo ""
echo "5. Run the multi-source installer:"
curl -fsSL https://marketnow.site/install.sh | bash -s -- @marketnow/uts
```

## Token issues to fix

Current tokens are stale:
- `.npm-token` is placeholder text (`PAST...HERE`), needs real npm publish token
- `.vercel-token` lacks scope, needs new token with `deploy` scope
- No GitHub PAT configured

## Summary

After these 3 steps, you'll have:
- ✅ GitHub updated with latest 3 commits
- ✅ marketnow.site with pretty `/download/uts.tgz`, `/install.sh`, `/resilience.json`, `/trust-card.json`
- ✅ 4 independent download channels serving IDENTICAL code
- ✅ Multi-source installer that auto-fails over across channels
- ✅ AI agents can curl `/trust-card.json` to verify trust
- ✅ Even if GitHub bans us, code is downloadable from 3 other places
