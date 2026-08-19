//! ATC/1.0 key utilities — Ed25519 keypair generation

use base64::Engine;
use ed25519_dalek::{SigningKey, VerifyingKey};
use ed25519_dalek::pkcs8::{DecodePrivateKey, EncodePrivateKey, EncodePublicKey, spki::Error as SpkiError};
use rand::rngs::OsRng;
use serde::{Serialize, Deserialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum KeyError {
    #[error("base64 decode error: {0}")]
    Base64(#[from] base64::DecodeError),
    #[error("SPKI/PKCS8 error: {0}")]
    Spki(#[from] SpkiError),
    #[error("signature error: {0}")]
    Signature(#[from] ed25519_dalek::SignatureError),
}

/// A CA or agent keypair with Ed25519 keys.
#[derive(Serialize, Deserialize, Clone)]
pub struct KeyPair {
    /// Base64-encoded full SPKI (44 DER bytes → 60 base64 chars)
    pub public_key: String,
    /// Base64-encoded full PKCS8 (48 DER bytes → 64 base64 chars)
    pub private_key: String,
    /// The signing key (for signing operations)
    #[serde(skip)]
    pub raw_signing_key: SigningKey,
    /// The verifying key (for verifying operations)
    #[serde(skip)]
    pub raw_verifying_key: VerifyingKey,
}

/// Generate a new Ed25519 keypair.
pub fn generate_keypair() -> Result<KeyPair, KeyError> {
    let mut csprng = OsRng;
    let signing_key = SigningKey::generate(&mut csprng);
    let verifying_key = signing_key.verifying_key();

    let priv_pem = signing_key.to_pkcs8_der()?;
    let pub_pem = verifying_key.to_public_key_der()?;

    Ok(KeyPair {
        public_key: base64::engine::general_purpose::STANDARD.encode(pub_pem.as_bytes()),
        private_key: base64::engine::general_purpose::STANDARD.encode(priv_pem.as_bytes()),
        raw_signing_key: signing_key,
        raw_verifying_key: verifying_key,
    })
}

/// Reconstruct a keypair from a saved base64 PKCS8 private key.
pub fn load_keypair_from_private(b64_private_key: &str) -> Result<KeyPair, KeyError> {
    let priv_der = base64::engine::general_purpose::STANDARD.decode(b64_private_key)?;
    let signing_key = SigningKey::from_pkcs8_der(&priv_der)?;
    let verifying_key = signing_key.verifying_key();

    let pub_pem = verifying_key.to_public_key_der()?;

    Ok(KeyPair {
        public_key: base64::engine::general_purpose::STANDARD.encode(pub_pem.as_bytes()),
        private_key: b64_private_key.to_string(),
        raw_signing_key: signing_key,
        raw_verifying_key: verifying_key,
    })
}

/// Sign a message with an Ed25519 signing key. Returns base64 signature.
pub fn sign_message(message: &[u8], signing_key: &SigningKey) -> String {
    let sig = signing_key.sign(message);
    base64::engine::general_purpose::STANDARD.encode(sig.to_bytes())
}

/// Verify an Ed25519 signature.
pub fn verify_signature(message: &[u8], b64_signature: &str, b64_public_key: &str) -> bool {
    use ed25519_dalek::Verifier;
    let sig_bytes = match base64::engine::general_purpose::STANDARD.decode(b64_signature) {
        Ok(b) => b,
        Err(_) => return false,
    };
    let sig_array: [u8; 64] = match sig_bytes.as_slice().try_into() {
        Ok(a) => a,
        Err(_) => return false,
    };
    let sig = ed25519_dalek::Signature::from_bytes(&sig_array);

    let pub_der = match base64::engine::general_purpose::STANDARD.decode(b64_public_key) {
        Ok(b) => b,
        Err(_) => return false,
    };
    let verifying_key = match VerifyingKey::from_public_key_der(&pub_der) {
        Ok(k) => k,
        Err(_) => return false,
    };

    verifying_key.verify(message, &sig).is_ok()
}
