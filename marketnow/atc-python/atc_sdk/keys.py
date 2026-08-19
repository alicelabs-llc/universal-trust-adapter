"""ATC/1.0 key utilities — Ed25519 keypair generation and signing."""

from __future__ import annotations

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives import serialization
import base64
import json
from dataclasses import dataclass
from typing import Tuple

ATC_ALGORITHM = "Ed25519"


@dataclass
class KeyPair:
    """A CA or agent keypair with Ed25519 keys."""
    public_key: str  # base64 SPKI
    private_key: str  # base64 PKCS8
    raw_private_key: Ed25519PrivateKey
    raw_public_key: Ed25519PublicKey


def generate_keypair() -> KeyPair:
    """Generate a new Ed25519 keypair."""
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()

    priv_pem = private_key.private_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    pub_pem = public_key.public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    return KeyPair(
        public_key=base64.b64encode(pub_pem).decode("ascii"),
        private_key=base64.b64encode(priv_pem).decode("ascii"),
        raw_private_key=private_key,
        raw_public_key=public_key,
    )


def load_keypair_from_private(base64_private_key: str) -> KeyPair:
    """Reconstruct a keypair from a saved base64 PKCS8 private key."""
    priv_der = base64.b64decode(base64_private_key)
    private_key = serialization.load_der_private_key(priv_der, password=None)
    public_key = private_key.public_key()

    pub_pem = public_key.public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    return KeyPair(
        public_key=base64.b64encode(pub_pem).decode("ascii"),
        private_key=base64_private_key,
        raw_private_key=private_key,
        raw_public_key=public_key,
    )


def sign_message(message: bytes | str, private_key: Ed25519PrivateKey) -> str:
    """Sign a message with Ed25519, return base64 signature."""
    if isinstance(message, str):
        message = message.encode("utf-8")
    sig = private_key.sign(message)
    return base64.b64encode(sig).decode("ascii")


def verify_signature(message: bytes | str, base64_signature: str, base64_public_key: str) -> bool:
    """Verify an Ed25519 signature."""
    try:
        pub_der = base64.b64decode(base64_public_key)
        public_key = serialization.load_der_public_key(pub_der)
        if isinstance(message, str):
            message = message.encode("utf-8")
        sig = base64.b64decode(base64_signature)
        public_key.verify(sig, message)  # raises on invalid
        return True
    except Exception:
        return False
