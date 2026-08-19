"""ATC/1.0 Python SDK — Issue and verify Agent Trust Cards."""

__version__ = "1.0.1"
__author__ = "AliceLabs LLC"
__spec_version__ = "ATC/1.0"
__algorithm__ = "Ed25519"

from .keys import generate_keypair, load_keypair_from_private, sign_message, verify_signature
from .issue import issue_atc, resign_atc, canonicalize_atc, compute_payload_hash
from .verify import verify_atc, verify_atc_sync

__all__ = [
    "generate_keypair",
    "load_keypair_from_private",
    "sign_message",
    "verify_signature",
    "issue_atc",
    "resign_atc",
    "canonicalize_atc",
    "compute_payload_hash",
    "verify_atc",
    "verify_atc_sync",
    "__version__",
    "__spec_version__",
    "__algorithm__",
]
