# Reproducible source-tree rebuild — `agent-trust-card@1.1.2`

> "Nothing here makes the source tree rebuild to the published bytes."
> — [@anp2network](https://dev.to/anp2network), 2026-09-02

It does now. **Bytes published, rule stated, shortcut killed** — the same treatment the vectors got.

## What is claimed, precisely

The npm tarball `agent-trust-card-1.1.2.tgz` (sha256 `f1b44ed29eea0ca9eee65c1e0974c5d2b4b512378c6d21edb6344daf9184641a`, 26782 bytes) contains a tar layer (122880 uncompressed bytes). **The source tree in this repo, transformed by the rule in `tarball-rule.json`, rebuilds that tar layer byte-for-byte** (sha256 `519d406adba1e8199ca0c91a8f47195a81e42745aac05e599c9b3de87359b990`).

What is **not** claimed: byte-identity of the gzip layer. The `.tgz` deflate stream depends on the zlib build the publisher used — no zlib version guarantee exists across platforms, so the honest claim targets the layer that is fully determined by content + rule: the tar. The `.tgz` itself is pinned by digest in three places (npm registry, this repo, and Rekor — see `../anchors/`).

## The rule (short form)

1. **12 file entries, fixed order** — see `tarball-rule.json` `entries`. No directory entries.
2. **Fixed metadata per entry** — typeflag `0`, mode `000644`, mtime `499162500`, uid/gid/uname/gname empty, `ustar\0`/`00`, devmajor/devminor `000000`. Numeric field encodings are stated in `tarball-rule.json`.
3. **Content transforms** —
   - 11 files: every LF becomes CRLF; all other bytes verbatim.
   - `package.json`: parsed and re-serialized in the publisher's format (BOM, CRLF, 4-space indent, two spaces after colons, alignment rule for nested openers, `<`/`>` escaped). The source of truth for the format is `build-agent-trust-card.mjs`, and the proof that the rule is right is that the output matches the published bytes.
4. **Trailer** — two zero blocks, nothing after.

## Verify it yourself (the stranger flow)

```bash
git clone https://github.com/alicelabs-llc/universal-trust-adapter
cd universal-trust-adapter/uta-repo/tests/reproducible

# full flow: downloads the tarball from the npm registry, checks the anchored
# digest, rebuilds from the source tree, compares byte-for-byte.
# (the source dir defaults to ../../../marketnow/atc-sdk inside the clone;
#  pass --src explicitly if you moved anything)
node verify-rebuild.mjs --manifest source-manifest.json
```

Expected output:

```
✓ published .tgz sha256 === anchored digest (f1b44ed29eea0ca9…) — f1b44ed2… (26782 bytes)
✓ rebuild produced a tar — 122880 bytes, sha256 519d406adba1e819…
✓ gunzip(published) === rebuilt tar — BYTE-FOR-BYTE — 122880 bytes identical
✓ per-file source manifest (12 files)
```

No trust in this README is required: the comparison target is downloaded from `registry.npmjs.org`, and the rebuild inputs come from the git checkout you just made. If either side moved, the verification fails.

## Why the shortcut is dead

- The build is **from the source files**, not from a stored artifact: change any byte of `marketnow/atc-sdk/` and the rebuild diverges at that entry.
- The per-file manifest (sha256 per source file) is checked independently, so "rebuild matches" cannot be faked by tampering with the tarball: both sides must agree.
- The digests themselves (`.tgz`, tar layer, source manifest) are anchored in **Rekor** — an append-only, third-party, inclusion-checkable log operated by Sigstore. The publisher cannot rewrite them. See `../anchors/README.md`.

## Files

| File | Role |
|---|---|
| `build-agent-trust-card.mjs` | The deterministic builder (zero dependencies, Node >= 18). Contains the rule as executable code. |
| `verify-rebuild.mjs` | The stranger flow: download → digest check → rebuild → byte-for-byte compare. |
| `tarball-rule.json` | The rule, machine-readable: entry order, metadata, transforms, digests. |
| `source-manifest.json` | Bytes published: per-file sha256 of the 12 source files. |
| `agent-trust-card-1.1.2.tgz` | The pinned artifact, served from this repo as a third location (identical to npm's). |

## Acknowledgments

The gap was named by @anp2network on 2026-09-02 ("the asset is the npm tarball uploaded as a file, so identity there holds by construction and says nothing about whether the source tree rebuilds to those bytes") and again on 2026-09-07. The residual they named — two authorities collapsing to `dist.integrity` — is closed by the Rekor anchor, not by this rebuild: the rebuild binds *source tree → artifact*, Rekor binds *artifact → a timestamp the publisher cannot rewrite*.
