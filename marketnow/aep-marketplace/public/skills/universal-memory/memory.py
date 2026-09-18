#!/usr/bin/env python3
"""
universal-memory — memory.py
Persistent local memory for ANY AI agent. Zero dependencies, zero network.

Store:   ~/.universal-memory/memory.jsonl  (global)
         ./.universal-memory/memory.jsonl  (project)
License: MIT — (c) 2026 AliceLabs / MarketNow

Commands:
  remember <text> [--type T] [--scope S] [--tag x] [--agent A]  store a memory
  recall <query> [--limit N] [--scope S]                        search memories
  profile [--scope S]                                           grouped summary
  forget <id> [--scope S]                                        delete a memory (real delete)
  stats                                                         counts
  export [--format md|json] [--scope S]                          dump
  doctor                                                        health check

Types:   decision | rule | preference | fact | context
Scopes:  global | project
Add --json to any command for machine-readable output.
"""
import argparse
import json
import os
import sys
import tempfile
from datetime import datetime, timezone

__version__ = "1.0.0"
TYPES = ["decision", "rule", "preference", "fact", "context"]
SCOPES = ["global", "project"]
STOPWORDS = {"the", "a", "an", "of", "to", "and", "or", "in", "on", "for",
             "is", "are", "was", "do", "does", "did", "with", "that", "this",
             "it", "we", "i", "you", "my", "our", "me", "what", "how"}


def store_path(scope: str) -> str:
    if scope == "project":
        return os.path.join(os.getcwd(), ".universal-memory", "memory.jsonl")
    return os.path.join(os.path.expanduser("~"), ".universal-memory", "memory.jsonl")


def read_store(path: str):
    out = []
    if not os.path.exists(path):
        return out
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                pass  # skip corrupt line, keep history
    return out


def append_entry(path: str, entry: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def rewrite_without(path: str, entries) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path),
                               prefix=".memory-tmp-")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            for e in entries:
                fh.write(json.dumps(e, ensure_ascii=False) + "\n")
        os.replace(tmp, path)  # atomic
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def new_id() -> str:
    import secrets
    return "um-%d-%s" % (int(datetime.now(timezone.utc).timestamp() * 1000),
                         secrets.token_hex(3))


def tokenize(s: str):
    tok, cur = [], []
    for ch in (s or "").lower():
        if ch.isalnum():
            cur.append(ch)
        else:
            if cur:
                tok.append("".join(cur)); cur = []
    if cur:
        tok.append("".join(cur))
    return [t for t in tok if len(t) > 1 and t not in STOPWORDS]


def score(entry, tokens, phrase) -> float:
    s = 0.0
    text = (entry.get("text") or "").lower()
    tags = [str(t).lower() for t in (entry.get("tags") or [])]
    for t in tokens:
        if t in tags:
            s += 2.0
        if t in text:
            s += 1.0
    if phrase and len(phrase) > 3 and phrase in text:
        s += 0.5
    return s


def scope_entries(scope: str):
    if scope == "all":
        out = [dict(e, _f="global") for e in read_store(store_path("global"))]
        out += [dict(e, _f="project") for e in read_store(store_path("project"))]
        return out
    return [dict(e, _f=scope) for e in read_store(store_path(scope))]


def fmt(e) -> str:
    tags = "  (%s)" % ", ".join(e["tags"]) if e.get("tags") else ""
    agent = "  {via %s}" % e["agent"] if e.get("agent") not in (None, "unknown") else ""
    return "[%s] %s:%s — %s%s%s  <%s>" % (e.get("ts"), e["_f"], e.get("type"),
                                           e.get("text"), tags, agent, e.get("id"))


def build_parser():
    p = argparse.ArgumentParser(prog="memory.py",
                                description="universal-memory CLI (%s)" % __version__)
    sub = p.add_subparsers(dest="cmd")

    m = sub.add_parser("remember", help="store a memory")
    m.add_argument("text", nargs="+")
    m.add_argument("--type", default="fact", choices=TYPES)
    m.add_argument("--scope", default="global", choices=SCOPES)
    m.add_argument("--tag", action="append", default=[])
    m.add_argument("--agent", default=os.environ.get("AGENT_NAME",
                   os.environ.get("AGENT_ID", "unknown")))

    r = sub.add_parser("recall", help="search memories")
    r.add_argument("query", nargs="+")
    r.add_argument("--limit", type=int, default=5)
    r.add_argument("--scope", default="all", choices=SCOPES + ["all"])

    pr = sub.add_parser("profile", help="grouped summary")
    pr.add_argument("--scope", default="all", choices=SCOPES + ["all"])

    f = sub.add_parser("forget", help="delete a memory (real delete)")
    f.add_argument("id")
    f.add_argument("--scope", default="all", choices=SCOPES + ["all"])

    sub.add_parser("stats", help="counts")

    ex = sub.add_parser("export", help="dump store")
    ex.add_argument("--format", default="md", choices=["md", "json"])
    ex.add_argument("--scope", default="all", choices=SCOPES + ["all"])

    sub.add_parser("doctor", help="health check")

    for sp in (m, r, pr, f, ex):
        sp.add_argument("--json", action="store_true")
    return p


def out_json(opts, obj):
    print(json.dumps(obj, ensure_ascii=False))


def main(argv=None):
    args = build_parser().parse_args(argv)
    as_json = getattr(args, "json", False)

    if args.cmd == "remember":
        text = " ".join(args.text).strip()[:2000]
        entry = {"id": new_id(), "ts": datetime.now(timezone.utc).isoformat(),
                 "type": args.type, "scope": args.scope, "text": text,
                 "tags": args.tag, "agent": args.agent}
        file = store_path(args.scope)
        append_entry(file, entry)
        if as_json:
            out_json(args, {"ok": True, "stored": entry, "file": file})
        else:
            print("stored %s [%s]: %s\n  id: %s" % (entry["type"], entry["scope"],
                                                    entry["text"], entry["id"]))

    elif args.cmd == "recall":
        q = " ".join(args.query).strip()
        tokens = tokenize(q)
        hits = [(e, score(e, tokens, q.lower())) for e in scope_entries(args.scope)]
        hits = [(e, s) for e, s in hits if s > 0]
        hits.sort(key=lambda h: (-h[1], h[0].get("ts", "")))
        hits = hits[:args.limit]
        if as_json:
            out_json(args, {"ok": True, "query": q, "hits": [e for e, _ in hits]})
        elif not hits:
            print("no memories match that query.")
        else:
            for e, _ in hits:
                print(fmt(e))

    elif args.cmd == "profile":
        all_ = scope_entries(args.scope)
        by = {}
        for e in all_:
            by.setdefault(e.get("type"), []).append(e)
        if as_json:
            out_json(args, {"ok": True, "profile": by})
        elif not all_:
            print("nothing remembered yet.")
        else:
            print("universal-memory profile — %d entries\n" % len(all_))
            for t in TYPES:
                if t not in by:
                    continue
                print("%s (%d)" % (t.upper(), len(by[t])))
                for e in reversed(by[t][-5:]):
                    print("  " + fmt(e))
                print("")

    elif args.cmd == "forget":
        scopes = [args.scope] if args.scope in SCOPES else SCOPES
        for sc in scopes:
            file = store_path(sc)
            entries = read_store(file)
            keep = [e for e in entries if e.get("id") != args.id]
            if len(keep) != len(entries):
                rewrite_without(file, keep)
                if as_json:
                    out_json(args, {"ok": True, "forgot": args.id, "scope": sc})
                else:
                    print("forgot %s (%s). real delete — no shadow copy." % (args.id, sc))
                return
        print("id not found: %s" % args.id, file=sys.stderr)
        sys.exit(1)

    elif args.cmd == "stats":
        g = read_store(store_path("global"))
        p = read_store(store_path("project"))
        both = g + p
        by_type, by_agent = {}, {}
        for e in both:
            by_type[e.get("type")] = by_type.get(e.get("type"), 0) + 1
            a = e.get("agent") or "unknown"
            by_agent[a] = by_agent.get(a, 0) + 1
        if as_json:
            out_json(args, {"ok": True, "global": len(g), "project": len(p),
                            "by_type": by_type, "by_agent": by_agent})
        else:
            print("global: %d | project: %d" % (len(g), len(p)))
            for k, v in by_type.items():
                print("  %s: %d" % (k, v))
            if len(by_agent) > 1:
                print("agents sharing this store: " +
                      ", ".join("%s(%d)" % kv for kv in by_agent.items()))

    elif args.cmd == "export":
        all_ = scope_entries(args.scope)
        if args.format == "json":
            print(json.dumps([{k: v for k, v in e.items() if k != "_f"}
                              for e in all_], ensure_ascii=False, indent=2))
        else:
            print("# Universal Memory export\n")
            print("_exported: %s_\n" % datetime.now(timezone.utc).isoformat())
            for f in ("global", "project"):
                lst = [e for e in all_ if e["_f"] == f]
                if not lst:
                    continue
                print("## %s\n" % f)
                for t in TYPES:
                    tl = [e for e in lst if e.get("type") == t]
                    if not tl:
                        continue
                    print("### %s\n" % t)
                    for e in tl:
                        print("- [%s] %s _(%s)_ <%s>" %
                              (e.get("ts"), e.get("text"), e.get("agent"), e.get("id")))
                    print("")

    elif args.cmd == "doctor":
        checks, ok_all = [], True
        for sc in SCOPES:
            path = store_path(sc)
            ok, detail = True, "missing (created on first remember)"
            try:
                os.makedirs(os.path.dirname(path), exist_ok=True)
                fd, probe = tempfile.mkstemp(dir=os.path.dirname(path))
                os.close(fd); os.unlink(probe)
                detail = "writable, %d entries" % len(read_store(path))
            except OSError as err:
                ok, ok_all = False, False
                detail = "NOT writable: %s" % err
            checks.append({"scope": sc, "path": path, "ok": ok, "detail": detail})
        if as_json:
            out_json(args, {"ok": ok_all, "version": __version__,
                            "python": sys.version.split()[0], "checks": checks})
        else:
            print("universal-memory %s (python %s)" % (__version__, sys.version.split()[0]))
            for c in checks:
                print("  %s %s: %s — %s" % ("OK " if c["ok"] else "FAIL",
                                            c["scope"], c["path"], c["detail"]))
            # zero-network proof: this file performs no network calls whatsoever.
        if not ok_all:
            sys.exit(1)

    else:
        build_parser().print_help()
        sys.exit(2)


if __name__ == "__main__":
    main()
