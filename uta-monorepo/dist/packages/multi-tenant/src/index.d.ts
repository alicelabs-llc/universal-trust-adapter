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
import { type Ed25519KeyPair } from '../core/crypto.js';
import { type RevocationStore } from '../core/revocation.js';
export interface Organization {
    id: string;
    name: string;
    created_at: string;
    ca_key_pair: Ed25519KeyPair;
    admin_api_key: string;
    gateway_key_pair: Ed25519KeyPair;
    allowed_issuers: string[];
    rate_limit_per_minute: number;
    settings: {
        require_pop: boolean;
        min_trust_score: number;
        block_secret_reads: boolean;
        block_shell_exec: boolean;
    };
}
export declare class TenantManager {
    private orgs;
    private apiKeyToOrg;
    /**
     * Create a new organization with auto-generated CA + gateway keys.
     */
    createOrganization(opts: {
        name: string;
        allowed_issuers?: string[];
        rate_limit_per_minute?: number;
        settings?: Partial<Organization['settings']>;
    }): Organization;
    /**
     * Get an organization by ID.
     */
    getOrganization(orgId: string): Organization | null;
    /**
     * Authenticate an API key and return the organization.
     */
    authenticate(apiKey: string): Organization | null;
    /**
     * Delete an organization (and all its keys).
     */
    deleteOrganization(orgId: string): boolean;
    /**
     * List all organizations.
     */
    listOrganizations(): Organization[];
    /**
     * Rotate an organization's admin API key.
     */
    rotateApiKey(orgId: string): string | null;
    /**
     * Rotate an organization's CA key pair.
     * The old key remains valid for verification (overlap period) until
     * explicitly revoked via revokeOldKey().
     */
    rotateCAKey(orgId: string): {
        old_key_id: string;
        new_key_id: string;
    } | null;
}
export declare class MultiTenantRevocationStore {
    private stores;
    getStore(orgId: string): RevocationStore;
    getStatus(orgId: string, credentialId: string): Promise<any>;
    setStatus(orgId: string, credentialId: string, status: 'good' | 'revoked' | 'unknown', reason?: string): Promise<void>;
}
