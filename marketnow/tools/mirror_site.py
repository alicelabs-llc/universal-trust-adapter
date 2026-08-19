import re, os, pathlib, urllib.parse, requests

BASE = "https://inkafit-peru.web.app"
OUT = pathlib.Path("dropea-shop")
OUT.mkdir(parents=True, exist_ok=True)

sess = requests.Session()

html = sess.get(BASE, timeout=20).text
(OUT / "index.html").write_text(html, encoding="utf-8")

# collect asset urls from src/href in html
urls = set()
for m in re.finditer(r'''(?:src|href)=["']([^"']+)["']''', html, re.I):
    u = m.group(1)
    if u.startswith("data:") or u.startswith("mailto:") or u.startswith("#"):
        continue
    full = urllib.parse.urljoin(BASE + "/", u)
    pu = urllib.parse.urlparse(full)
    if pu.netloc != urllib.parse.urlparse(BASE).netloc:
        continue
    urls.add(full)

# download assets
for u in sorted(urls):
    pu = urllib.parse.urlparse(u)
    rel = pu.path.lstrip("/") or "index.html"
    fp = OUT / rel
    fp.parent.mkdir(parents=True, exist_ok=True)
    try:
        r = sess.get(u, timeout=20)
        if r.status_code == 200:
            fp.write_bytes(r.content)
            print("OK", rel)
        else:
            print("SKIP", u, r.status_code)
    except Exception as e:
        print("ERR", u, e)

print("DONE")
