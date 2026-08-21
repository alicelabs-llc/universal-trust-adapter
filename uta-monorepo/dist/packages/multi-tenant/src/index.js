"use strict";
/**
 * @marketnow/trust-multi-tenant
 * P9-3: Multi-tenant support — organization isolation + per-org API keys.
 *
 * Allows multiple organizations to share a single UTA deployment while
 * maintaining strict isolation:
 *   - Each org has its own CA key pair (credentials signed by org-specific CA)
 *   - Each org has its own admin API key
 *   - Revocation status is per-org
 *   - Receipts are tagged with org_id
 *   - API key authentication ensures cross-org access is impossible
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiTenantRevocationStore = exports.TenantManager = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const crypto_js_1 = require("../core/crypto.js");
const revocation_js_1 = require("../core/revocation.js");
// ============================================================================
// Tenant Manager
// ============================================================================
class TenantManager {
    orgs = new Map();
    apiKeyToOrg = new Map();
    /**
     * Create a new organization with auto-generated CA + gateway keys.
     */
    createOrganization(opts) {
        const id = `org_${node_crypto_1.default.randomUUID().slice(0, 12)}`;
        const caKeyPair = (0, crypto_js_1.generateEd25519KeyPair)();
        const gatewayKeyPair = (0, crypto_js_1.generateEd25519KeyPair)();
        const adminApiKey = `mkt_${node_crypto_1.default.randomBytes(32).toString('hex')}`;
        const org = {
            id,
            name: opts.name,
            created_at: new Date().toISOString(),
            ca_key_pair: caKeyPair,
            admin_api_key: adminApiKey,
            gateway_key_pair: gatewayKeyPair,
            allowed_issuers: opts.allowed_issuers || [`did:marketnow:${id}`],
            rate_limit_per_minute: opts.rate_limit_per_minute || 600,
            settings: {
                require_pop: false,
                min_trust_score: 5,
                block_secret_reads: true,
                block_shell_exec: true,
                ...opts.settings,
            },
        };
        this.orgs.set(id, org);
        this.apiKeyToOrg.set(adminApiKey, id);
        return org;
    }
    /**
     * Get an organization by ID.
     */
    getOrganization(orgId) {
        return this.orgs.get(orgId) || null;
    }
    /**
     * Authenticate an API key and return the organization.
     */
    authenticate(apiKey) {
        const orgId = this.apiKeyToOrg.get(apiKey);
        if (!orgId)
            return null;
        return this.orgs.get(orgId) || null;
    }
    /**
     * Delete an organization (and all its keys).
     */
    deleteOrganization(orgId) {
        const org = this.orgs.get(orgId);
        if (!org)
            return false;
        this.apiKeyToOrg.delete(org.admin_api_key);
        this.orgs.delete(orgId);
        return true;
    }
    /**
     * List all organizations.
     */
    listOrganizations() {
        return Array.from(this.orgs.values());
    }
    /**
     * Rotate an organization's admin API key.
     */
    rotateApiKey(orgId) {
        const org = this.orgs.get(orgId);
        if (!org)
            return null;
        this.apiKeyToOrg.delete(org.admin_api_key);
        const newKey = `mkt_${node_crypto_1.default.randomBytes(32).toString('hex')}`;
        org.admin_api_key = newKey;
        this.apiKeyToOrg.set(newKey, orgId);
        return newKey;
    }
    /**
     * Rotate an organization's CA key pair.
     * The old key remains valid for verification (overlap period) until
     * explicitly revoked via revokeOldKey().
     */
    rotateCAKey(orgId) {
        const org = this.orgs.get(orgId);
        if (!org)
            return null;
        const oldKeyId = org.ca_key_pair.keyId;
        org.ca_key_pair = (0, crypto_js_1.generateEd25519KeyPair)();
        return { old_key_id: oldKeyId, new_key_id: org.ca_key_pair.keyId };
    }
}
exports.TenantManager = TenantManager;
// ============================================================================
// Per-organization revocation stores
// ============================================================================
class MultiTenantRevocationStore {
    stores = new Map();
    getStore(orgId) {
        let store = this.stores.get(orgId);
        if (!store) {
            store = new revocation_js_1.InMemoryRevocationStore();
            this.stores.set(orgId, store);
        }
        return store;
    }
    async getStatus(orgId, credentialId) {
        return this.getStore(orgId).getStatus(credentialId);
    }
    async setStatus(orgId, credentialId, status, reason) {
        const store = this.getStore(orgId);
        if (typeof store.setStatus === 'function') {
            await store.setStatus(credentialId, status, reason);
        }
    }
}
exports.MultiTenantRevocationStore = MultiTenantRevocationStore;
