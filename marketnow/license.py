"""
MarketNow License System - HMAC-based offline license validation
"""
import os
import json
import hmac
import hashlib
import base64
import sys
from pathlib import Path

# In production, this comes from an env variable or hardcoded for the marketplace
MASTER_KEY = os.environ.get("MARKETNOW_MASTER_KEY", "marketnow-master-key-2026-alpha")

LICENSE_DIR = Path.home() / ".marketnow"


def get_license_dir():
    LICENSE_DIR.mkdir(parents=True, exist_ok=True)
    return LICENSE_DIR


def generate_license(slug: str, email: str, tier: str, buyer_id: str) -> str:
    """Generate a license key for a skill purchase."""
    payload = f"{slug}:{email}:{tier}:{buyer_id}"
    signature = hmac.new(
        MASTER_KEY.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()[:16]
    raw = f"{payload}|{signature}"
    return base64.b64encode(raw.encode()).decode()


def validate_license(slug: str, license_key: str) -> dict:
    """Validate a license key and return its metadata."""
    try:
        raw = base64.b64decode(license_key.encode()).decode()
        parts = raw.split("|")
        if len(parts) != 2:
            return {"valid": False, "reason": "Invalid format"}
        payload, signature = parts
        expected = hmac.new(
            MASTER_KEY.encode(), payload.encode(), hashlib.sha256
        ).hexdigest()[:16]
        if not hmac.compare_digest(signature, expected):
            return {"valid": False, "reason": "Invalid signature"}
        slug_found, email, tier, buyer_id = payload.split(":")
        return {
            "valid": True,
            "slug": slug_found,
            "email": email,
            "tier": tier,
            "buyer_id": buyer_id,
        }
    except Exception as e:
        return {"valid": False, "reason": str(e)}


def check_license(slug: str) -> dict:
    """Check if a valid license exists for this skill."""
    lic_file = LICENSE_DIR / f"license-{slug}.key"
    if not lic_file.exists():
        return {"valid": False, "reason": "No license file found"}
    license_key = lic_file.read_text().strip()
    return validate_license(slug, license_key)


def save_license(slug: str, license_key: str) -> bool:
    """Save a validated license key."""
    result = validate_license(slug, license_key)
    if result["valid"]:
        lic_dir = get_license_dir()
        lic_file = lic_dir / f"license-{slug}.key"
        lic_file.write_text(license_key)
        return True
    return False


def load_pricing() -> dict:
    """Load marketplace pricing data."""
    # Check multiple locations
    for base in [Path(__file__).parent, Path(__file__).parent.parent, Path.cwd(), Path.home() / ".marketnow"]:
        pricing_file = base / "marketplace-pricing.json"
        if pricing_file.exists():
            return json.loads(pricing_file.read_text(encoding="utf-8"))
    return {"skills": []}


def get_skill_price(slug: str) -> float:
    """Get the price for a specific skill."""
    pricing = load_pricing()
    for skill in pricing.get("skills", []):
        if skill["slug"] == slug:
            return skill["price_usd"]
    return 0.0


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: license.py <command> [args]")
        print("Commands:")
        print("  check <slug>           Check if skill is licensed")
        print("  activate <slug> <key>  Activate a skill with license key")
        print("  generate <slug> <email> <tier> <buyer>  Generate a license")
        print("  price <slug>           Get price for a skill")
        print("  list                   List all skill prices")
        sys.exit(0)

    cmd = sys.argv[1]

    if cmd == "check":
        if len(sys.argv) < 3:
            print("Usage: license.py check <slug>")
            sys.exit(1)
        slug = sys.argv[2]
        result = check_license(slug)
        if result["valid"]:
            print(f"[LICENSED] {slug} - Tier: {result.get('tier', 'standard')}")
            print(f"  Buyer: {result.get('email', 'unknown')}")
        else:
            print(f"[UNLICENSED] {slug} - {result.get('reason', 'Unknown error')}")
            price = get_skill_price(slug)
            if price > 0:
                print(f"  Price: ${price:.2f}")
                print(f"  Buy at: https://marketnow.site/pricing#{slug}")
        sys.exit(0 if result["valid"] else 1)

    elif cmd == "activate":
        if len(sys.argv) < 4:
            print("Usage: license.py activate <slug> <license-key>")
            sys.exit(1)
        slug = sys.argv[2]
        key = sys.argv[3]
        if save_license(slug, key):
            result = validate_license(slug, key)
            print(f"[ACTIVATED] {slug}")
            print(f"  Tier: {result.get('tier', 'standard')}")
            print(f"  Buyer: {result.get('email', 'unknown')}")
        else:
            print("[ERROR] Invalid license key")
            sys.exit(1)

    elif cmd == "generate":
        if len(sys.argv) < 6:
            print("Usage: license.py generate <slug> <email> <tier> <buyer>")
            sys.exit(1)
        slug, email, tier, buyer = sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
        key = generate_license(slug, email, tier, buyer)
        print(f"License key for {slug} ({tier}):")
        print(key)

    elif cmd == "price":
        if len(sys.argv) < 3:
            print("Usage: license.py price <slug>")
            sys.exit(1)
        slug = sys.argv[2]
        price = get_skill_price(slug)
        if price > 0:
            print(f"${price:.2f}")
        else:
            print("Not found")
            sys.exit(1)

    elif cmd == "list":
        pricing = load_pricing()
        print(f"{'Skill':40s} {'Price':>8s} {'Tier':12s}")
        print("-" * 62)
        for skill in pricing.get("skills", []):
            print(f"{skill['name']:40s} ${skill['price_usd']:>5.2f} {skill['tier']:12s}")
        total = sum(s["price_usd"] for s in pricing["skills"])
        print("-" * 62)
        print(f"{'BUNDLE ALL 10':40s} ${total - (total * 0.42):>5.2f} (42% OFF)")
        print(f"{'Individual Total':40s} ${total:>5.2f}")
