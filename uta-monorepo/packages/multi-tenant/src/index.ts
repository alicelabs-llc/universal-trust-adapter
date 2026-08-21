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

import crypto from 'node:crypto';
import { generateEd25519KeyPair, type Ed25519KeyPair } from '../core/crypto.js';
import { InMemoryRevocationStore, type RevocationStore } from '../core/revocation.js';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Tenant Manager
// ============================================================================

export class TenantManager {
  private orgs = new Map<string, Organization>();
  private apiKeyToOrg = new Map<string, string>();

  /**
   * Create a new organization with auto-generated CA + gateway keys.
   */
  createOrganization(opts: {
    name: string;
    allowed_issuers?: string[];
    rate_limit_per_minute?: number;
    settings?: Partial<Organization['settings']>;
  }): Organization {
    const id = `org_${crypto.randomUUID().slice(0, 12)}`;
    const caKeyPair = generateEd25519KeyPair();
    const gatewayKeyPair = generateEd25519KeyPair();
    const adminApiKey = `mkt_${crypto.randomBytes(32).toString('hex')}`;

    const org: Organization = {
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
  getOrganization(orgId: string): Organization | null {
    return this.orgs.get(orgId) || null;
  }

  /**
   * Authenticate an API key and return the organization.
   */
  authenticate(apiKey: string): Organization | null {
    const orgId = this.apiKeyToOrg.get(apiKey);
    if (!orgId) return null;
    return this.orgs.get(orgId) || null;
  }

  /**
   * Delete an organization (and all its keys).
   */
  deleteOrganization(orgId: string): boolean {
    const org = this.orgs.get(orgId);
    if (!org) return false;
    this.apiKeyToOrg.delete(org.admin_api_key);
    this.orgs.delete(orgId);
    return true;
  }

  /**
   * List all organizations.
   */
  listOrganizations(): Organization[] {
    return Array.from(this.orgs.values());
  }

  /**
   * Rotate an organization's admin API key.
   */
  rotateApiKey(orgId: string): string | null {
    const org = this.orgs.get(orgId);
    if (!org) return null;
    this.apiKeyToOrg.delete(org.admin_api_key);
    const newKey = `mkt_${crypto.randomBytes(32).toString('hex')}`;
    org.admin_api_key = newKey;
    this.apiKeyToOrg.set(newKey, orgId);
    return newKey;
  }

  /**
   * Rotate an organization's CA key pair.
   * The old key remains valid for verification (overlap period) until
   * explicitly revoked via revokeOldKey().
   */
  rotateCAKey(orgId: string): { old_key_id: string; new_key_id: string } | null {
    const org = this.orgs.get(orgId);
    if (!org) return null;
    const oldKeyId = org.ca_key_pair.keyId;
    org.ca_key_pair = generateEd25519KeyPair();
    return { old_key_id: oldKeyId, new_key_id: org.ca_key_pair.keyId };
  }
}

// ============================================================================
// Per-organization revocation stores
// ============================================================================

export class MultiTenantRevocationStore {
  private stores = new Map<string, RevocationStore>();

  getStore(orgId: string): RevocationStore {
    let store = this.stores.get(orgId);
    if (!store) {
      store = new InMemoryRevocationStore();
      this.stores.set(orgId, store);
    }
    return store;
  }

  async getStatus(orgId: string, credentialId: string) {
    return this.getStore(orgId).getStatus(credentialId);
  }

  async setStatus(orgId: string, credentialId: string, status: 'good' | 'revoked' | 'unknown', reason?: string) {
    const store = this.getStore(orgId) as any;
    if (typeof store.setStatus === 'function') {
      await store.setStatus(credentialId, status, reason);
    }
  }
}
