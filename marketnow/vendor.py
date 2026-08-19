"""
MarketNow Vendor System - Complete publisher registration and wallet management
"""
import json, os, hmac, hashlib, base64, sys
from pathlib import Path
from datetime import datetime, timedelta

MASTER_KEY = os.environ.get("MARKETNOW_MASTER_KEY", "marketnow-master-key-2026-alpha")
DATA_DIR = Path.home() / ".marketnow"
VENDOR_FILE = DATA_DIR / "vendors.json"
SALES_FILE = DATA_DIR / "sales.json"
WALLETS_FILE = DATA_DIR / "wallets.json"

def ensure_dirs():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

def load_json(path, default=None):
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return default if default is not None else {}

def save_json(path, data):
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")

# ─── VENDOR / PUBLISHER ───────────────────────────────────────────

def register_vendor(name, email, handle, bio=""):
    """Register a publisher/vendor on MarketNow."""
    vendors = load_json(VENDOR_FILE, {})
    if handle in vendors:
        return {"error": f"Vendor handle '{handle}' already exists"}
    
    vendor_id = f"v-{len(vendors)+1:04d}"
    now = datetime.utcnow().isoformat()
    
    vendor = {
        "id": vendor_id,
        "name": name,
        "email": email,
        "handle": handle,
        "bio": bio,
        "joined": now,
        "skills_published": [],
        "total_sales": 0,
        "total_revenue": 0.0,
        "status": "active",
        "tier": "publisher",
    }
    vendors[handle] = vendor
    save_json(VENDOR_FILE, vendors)
    return vendor

def list_vendors():
    vendors = load_json(VENDOR_FILE, {})
    if not vendors:
        return "No vendors registered yet."
    result = f"\n{'Handle':20s} {'Name':25s} {'Skills':6s} {'Sales':6s} {'Revenue':10s} {'Status':10s}"
    result += "\n" + "-" * 80
    for h, v in vendors.items():
        result += f"\n{h:20s} {v['name']:25s} {len(v['skills_published']):6d} {v['total_sales']:6d} ${v['total_revenue']:<7.2f} {v['status']:10s}"
    return result

def publish_skill(vendor_handle, skill_slug):
    """Assign a skill to a vendor's catalog."""
    vendors = load_json(VENDOR_FILE, {})
    if vendor_handle not in vendors:
        return {"error": "Vendor not found"}
    if skill_slug not in vendors[vendor_handle]["skills_published"]:
        vendors[vendor_handle]["skills_published"].append(skill_slug)
    save_json(VENDOR_FILE, vendors)
    return {"ok": True, "vendor": vendor_handle, "skills": vendors[vendor_handle]["skills_published"]}

# ─── WALLET MANAGEMENT ────────────────────────────────────────────

def add_wallet(vendor_handle, network, address, label=""):
    """Add a payment wallet for a vendor."""
    wallets = load_json(WALLETS_FILE, {})
    if vendor_handle not in wallets:
        wallets[vendor_handle] = []
    
    wallet = {
        "network": network,
        "address": address,
        "label": label or f"{network} wallet",
        "added": datetime.utcnow().isoformat(),
    }
    wallets[vendor_handle].append(wallet)
    save_json(WALLETS_FILE, wallets)
    return wallet

def list_wallets(vendor_handle):
    wallets = load_json(WALLETS_FILE, {})
    return wallets.get(vendor_handle, [])

# ─── LICENSE GENERATION ───────────────────────────────────────────

def generate_license(slug, email, tier, buyer_id):
    payload = f"{slug}:{email}:{tier}:{buyer_id}"
    signature = hmac.new(MASTER_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()[:16]
    raw = f"{payload}|{signature}"
    return base64.b64encode(raw.encode()).decode()

def generate_bundle_license(slugs, email, tier, buyer_id):
    """Generate a bundle license covering multiple skills."""
    payload = f"bundle:{'+'.join(slugs)}:{email}:{tier}:{buyer_id}"
    signature = hmac.new(MASTER_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()[:16]
    raw = f"{payload}|{signature}"
    return base64.b64encode(raw.encode()).decode()

# ─── SALES TRACKING ──────────────────────────────────────────────

def record_sale(vendor_handle, buyer_email, skill_slug, amount, method="crypto"):
    """Record a sale and update vendor stats."""
    sales = load_json(SALES_FILE, [])
    vendors = load_json(VENDOR_FILE, {})
    
    sale = {
        "id": f"s-{len(sales)+1:05d}",
        "vendor": vendor_handle,
        "buyer": buyer_email,
        "skill": skill_slug,
        "amount": amount,
        "method": method,
        "timestamp": datetime.utcnow().isoformat(),
    }
    sales.append(sale)
    save_json(SALES_FILE, sales)
    
    if vendor_handle in vendors:
        vendors[vendor_handle]["total_sales"] += 1
        vendors[vendor_handle]["total_revenue"] += amount
        save_json(VENDOR_FILE, vendors)
    
    return sale

def sales_report(vendor_handle=None):
    sales = load_json(SALES_FILE, [])
    if vendor_handle:
        sales = [s for s in sales if s["vendor"] == vendor_handle]
    return sales

def vendor_dashboard(vendor_handle):
    """Generate a complete dashboard for a vendor."""
    vendors = load_json(VENDOR_FILE, {})
    sales = sales_report(vendor_handle)
    wallets = list_wallets(vendor_handle)
    
    v = vendors.get(vendor_handle, {})
    if not v:
        return f"Vendor '{vendor_handle}' not found."
    
    lines = []
    lines.append("=" * 60)
    lines.append(f"  MARKETNOW VENDOR DASHBOARD")
    lines.append(f"  {v.get('name', vendor_handle)} (@{vendor_handle})")
    lines.append("=" * 60)
    lines.append(f"  Status:     {v.get('status', 'N/A')}")
    lines.append(f"  Joined:     {v.get('joined', 'N/A')}")
    lines.append(f"  Total Sales: ${v.get('total_revenue', 0):.2f} ({v.get('total_sales', 0)} transactions)")
    lines.append(f"  Skills:     {len(v.get('skills_published', []))} published")
    lines.append("")
    
    if wallets:
        lines.append("  WALLETS:")
        for w in wallets:
            lines.append(f"    [{w['network']:8s}] {w['address'][:20]}... ({w.get('label','')})")
    else:
        lines.append("  WALLETS: None configured")
    lines.append("")
    
    if sales:
        lines.append(f"  RECENT SALES ({len(sales)} total):")
        for s in sales[-5:]:
            lines.append(f"    {s['skill']:35s} ${s['amount']:<6.2f} via {s['method']:10s} {s['timestamp'][:10]}")
    else:
        lines.append("  RECENT SALES: None yet")
    lines.append("")
    
    # Generate license keys
    lines.append("  LICENSE KEYS (Admin):")
    lines.append("-" * 60)
    for skill in sorted(v.get('skills_published', [])):
        lk = generate_license(skill, v['email'], 'premium', v['id'])
        lines.append(f"  {skill:35s} {lk[:40]}...")
    lines.append("-" * 60)
    
    return "\n".join(lines)

# ─── PRICING DATA ────────────────────────────────────────────────

def load_pricing():
    for base in [Path(__file__).parent, Path(__file__).parent.parent, Path.cwd(), DATA_DIR]:
        pf = base / "marketplace-pricing.json"
        if pf.exists():
            return json.loads(pf.read_text(encoding="utf-8"))
    return {"skills": []}

def get_skill_price(slug):
    pricing = load_pricing()
    for skill in pricing.get("skills", []):
        if skill["slug"] == slug:
            return skill["price_usd"]
    return 0.0

PRICING_DATA = load_pricing()

# ─── CLI ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    ensure_dirs()
    
    cmds = {
        "register": "register <name> <email> <handle> [bio] -- Register as vendor",
        "vendors": "list vendors",
        "publish": "publish <vendor> <slug> -- Assign skill to vendor",
        "wallet": "wallet <vendor> <network> <address> [label] -- Add wallet",
        "wallets": "wallets <vendor> -- List wallets",
        "license": "license <slug> <email> <tier> <buyer> -- Generate license",
        "bundle-license": "bundle-license <slugs(csv)> <email> <tier> <buyer> -- Bundle license",
        "sale": "sale <vendor> <email> <slug> <amount> [method] -- Record sale",
        "dashboard": "dashboard <vendor> -- Full vendor dashboard",
        "sales": "sales [vendor] -- List sales",
    }
    
    if len(sys.argv) < 2:
        print("MarketNow Vendor System")
        print("Usage: vendor.py <command> [args]")
        print("\nCommands:")
        for cmd, desc in cmds.items():
            print(f"  {cmd:20s} {desc}")
        sys.exit(0)
    
    cmd = sys.argv[1]
    
    if cmd == "register":
        name, email, handle = sys.argv[2], sys.argv[3], sys.argv[4]
        bio = sys.argv[5] if len(sys.argv) > 5 else ""
        result = register_vendor(name, email, handle, bio)
        if "error" in result:
            print(f"[ERROR] {result['error']}")
        else:
            print(f"[OK] Vendor '{handle}' registered! ID: {result['id']}")
    
    elif cmd == "vendors":
        print(list_vendors())
    
    elif cmd == "publish":
        handle, slug = sys.argv[2], sys.argv[3]
        result = publish_skill(handle, slug)
        if "error" in result:
            print(f"[ERROR] {result['error']}")
        else:
            print(f"[OK] Published '{slug}' to @{handle}")
    
    elif cmd == "wallet":
        handle, network, address = sys.argv[2], sys.argv[3], sys.argv[4]
        label = sys.argv[5] if len(sys.argv) > 5 else ""
        w = add_wallet(handle, network, address, label)
        print(f"[OK] Added {w['network']} wallet for @{handle}")
    
    elif cmd == "wallets":
        handle = sys.argv[2] if len(sys.argv) > 2 else ""
        if not handle:
            print("[ERROR] vendor handle required")
            sys.exit(1)
        wl = list_wallets(handle)
        if wl:
            print(f"\nWallets for @{handle}:")
            for w in wl:
                print(f"  [{w['network']:10s}] {w['address']}")
        else:
            print(f"No wallets configured for @{handle}")
    
    elif cmd == "license":
        slug, email, tier, buyer = sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
        lk = generate_license(slug, email, tier, buyer)
        print(f"License key for {slug} ({tier}):")
        print(lk)
    
    elif cmd == "bundle-license":
        slugs = sys.argv[2].split(",")
        email, tier, buyer = sys.argv[3], sys.argv[4], sys.argv[5]
        lk = generate_bundle_license(slugs, email, tier, buyer)
        print(f"Bundle license for {len(slugs)} skills ({tier}):")
        print(lk)
    
    elif cmd == "sale":
        handle, email, slug, amount = sys.argv[2], sys.argv[3], sys.argv[4], float(sys.argv[5])
        method = sys.argv[6] if len(sys.argv) > 6 else "crypto"
        s = record_sale(handle, email, slug, amount, method)
        print(f"[SALE RECORDED] {slug} -> ${amount:.2f} via {method}")
    
    elif cmd == "dashboard":
        handle = sys.argv[2] if len(sys.argv) > 2 else ""
        if not handle:
            print("[ERROR] Vendor handle required")
            sys.exit(1)
        print(vendor_dashboard(handle))
    
    elif cmd == "sales":
        handle = sys.argv[2] if len(sys.argv) > 2 else None
        sl = sales_report(handle)
        print(f"\n{'ID':10s} {'Vendor':15s} {'Skill':30s} {'Amount':8s} {'Method':10s} {'Date':12s}")
        print("-" * 90)
        for s in sl[-20:]:
            print(f"{s['id']:10s} {s['vendor']:15s} {s['skill']:30s} ${s['amount']:<5.2f} {s['method']:10s} {s['timestamp'][:10]}")
    
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
