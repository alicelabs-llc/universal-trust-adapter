"use strict";
/**
 * @marketnow/trust-persistence
 * P5-6: Supabase-backed persistence adapters for receipts, nonces, and revocations.
 *
 * Three production-ready persistence backends:
 *   1. SupabaseReceiptStore — stores ActionReceipts in a `receipts` table
 *   2. SupabaseNonceStore — stores PoP challenges in `nonce_challenges` table
 *   3. SupabaseRevocationStore — implements RevocationStore from revocation.ts
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseRevocationStore = exports.SupabaseNonceStore = exports.SupabaseReceiptStore = void 0;
exports.createSupabasePersistence = createSupabasePersistence;
exports.createSupabasePersistenceFromEnv = createSupabasePersistenceFromEnv;
class SupabaseReceiptStore {
    client;
    constructor(opts) {
        if ('client' in opts) {
            this.client = opts.client;
        }
        else {
            // Lazy-load @supabase/supabase-js only if a URL/key was provided
            try {
                const { createClient } = require('@supabase/supabase-js');
                this.client = createClient(opts.url, opts.key);
            }
            catch (e) {
                throw new Error('SupabaseReceiptStore: @supabase/supabase-js is required when using url/key. Install with: npm install @supabase/supabase-js');
            }
        }
    }
    async store(receipt) {
        const result = await this.client
            .from('receipts')
            .insert({
            receipt_id: receipt.receipt_id,
            decision: receipt.decision,
            agent_id: receipt.agent_id,
            credential_id: receipt.credential_id,
            tool_name: receipt.tool_name,
            args_hash: receipt.args_hash,
            trust_score: receipt.trust_score,
            reason: receipt.reason,
            verification_stages: receipt.verification_stages,
            timestamp: receipt.timestamp,
            gateway_version: receipt.gateway_version,
            evidence_hash: receipt.evidence_hash,
            signature: receipt.signature,
        });
        if (result.error)
            throw new Error(`SupabaseReceiptStore.store: ${result.error.message}`);
    }
    async retrieve(receiptId) {
        const result = await this.client
            .from('receipts')
            .select('*')
            .eq('receipt_id', receiptId)
            .maybeSingle();
        if (result.error)
            throw new Error(`SupabaseReceiptStore.retrieve: ${result.error.message}`);
        return result.data || null;
    }
    async list(filter) {
        let query = this.client.from('receipts').select('*');
        if (filter?.agent_id)
            query = query.eq('agent_id', filter.agent_id);
        if (filter?.decision)
            query = query.eq('decision', filter.decision);
        query = query.order('timestamp', { ascending: false });
        const result = await query;
        if (result.error)
            throw new Error(`SupabaseReceiptStore.list: ${result.error.message}`);
        return result.data || [];
    }
    async count() {
        const result = await this.client.from('receipts').select('*', { count: 'exact', head: true });
        if (result.error)
            throw new Error(`SupabaseReceiptStore.count: ${result.error.message}`);
        return result.count || 0;
    }
}
exports.SupabaseReceiptStore = SupabaseReceiptStore;
// ============================================================================
// 2. SupabaseNonceStore — distributed PoP challenge persistence
// ============================================================================
class SupabaseNonceStore {
    client;
    constructor(opts) {
        if ('client' in opts) {
            this.client = opts.client;
        }
        else {
            try {
                const { createClient } = require('@supabase/supabase-js');
                this.client = createClient(opts.url, opts.key);
            }
            catch (e) {
                throw new Error('SupabaseNonceStore: @supabase/supabase-js is required');
            }
        }
    }
    async store(challenge) {
        const result = await this.client
            .from('nonce_challenges')
            .insert({
            nonce: challenge.nonce,
            credential_id: challenge.credential_id,
            audience: challenge.audience,
            issued_at: challenge.issued_at,
            expires_at: challenge.expires_at,
            consumed: false,
        });
        if (result.error) {
            if (result.error.code === '23505') {
                throw new Error(`Nonce already exists (replay attempt?): ${challenge.nonce.slice(0, 16)}...`);
            }
            throw new Error(`SupabaseNonceStore.store: ${result.error.message}`);
        }
    }
    async retrieve(nonce) {
        const result = await this.client
            .from('nonce_challenges')
            .select('*')
            .eq('nonce', nonce)
            .maybeSingle();
        if (result.error)
            throw new Error(`SupabaseNonceStore.retrieve: ${result.error.message}`);
        if (!result.data)
            return null;
        if (new Date(result.data.expires_at) < new Date()) {
            // Best-effort delete
            try {
                await this.client.from('nonce_challenges').delete().eq('nonce', nonce);
            }
            catch { }
            return null;
        }
        return {
            nonce: result.data.nonce,
            credential_id: result.data.credential_id,
            audience: result.data.audience,
            issued_at: result.data.issued_at,
            expires_at: result.data.expires_at,
            consumed: result.data.consumed,
            consumed_at: result.data.consumed_at,
        };
    }
    async consume(nonce) {
        const entry = await this.retrieve(nonce);
        if (!entry)
            return null;
        if (entry.consumed) {
            throw new Error(`Nonce already consumed (replay attack detected): ${nonce.slice(0, 16)}...`);
        }
        if (new Date(entry.expires_at) < new Date()) {
            try {
                await this.client.from('nonce_challenges').delete().eq('nonce', nonce);
            }
            catch { }
            throw new Error(`Nonce expired at ${entry.expires_at}`);
        }
        // Atomic update: only update if consumed is still false
        const result = await this.client
            .from('nonce_challenges')
            .update({ consumed: true, consumed_at: new Date().toISOString() })
            .eq('nonce', nonce)
            .eq('consumed', false)
            .select();
        if (result.error)
            throw new Error(`SupabaseNonceStore.consume: ${result.error.message}`);
        if (!result.data || result.data.length === 0) {
            throw new Error(`Nonce already consumed (race condition): ${nonce.slice(0, 16)}...`);
        }
        return {
            ...entry,
            consumed: true,
            consumed_at: result.data[0].consumed_at,
        };
    }
    async cleanup() {
        const result = await this.client
            .from('nonce_challenges')
            .delete()
            .or(`expires_at.lt.${new Date().toISOString()}`);
        if (result.error)
            throw new Error(`SupabaseNonceStore.cleanup: ${result.error.message}`);
        return result.data?.length || 0;
    }
}
exports.SupabaseNonceStore = SupabaseNonceStore;
// ============================================================================
// 3. SupabaseRevocationStore — implements RevocationStore
// ============================================================================
class SupabaseRevocationStore {
    client;
    constructor(opts) {
        if ('client' in opts) {
            this.client = opts.client;
        }
        else {
            try {
                const { createClient } = require('@supabase/supabase-js');
                this.client = createClient(opts.url, opts.key);
            }
            catch (e) {
                throw new Error('SupabaseRevocationStore: @supabase/supabase-js is required');
            }
        }
    }
    async setStatus(credential_id, status, reason) {
        const result = await this.client
            .from('revocations')
            .upsert({
            credential_id,
            status,
            revoked_at: status === 'revoked' ? new Date().toISOString() : null,
            reason,
            updated_at: new Date().toISOString(),
        });
        if (result.error)
            throw new Error(`SupabaseRevocationStore.setStatus: ${result.error.message}`);
    }
    async getStatus(credential_id) {
        const result = await this.client
            .from('revocations')
            .select('status, revoked_at, reason')
            .eq('credential_id', credential_id)
            .maybeSingle();
        if (result.error)
            throw new Error(`SupabaseRevocationStore.getStatus: ${result.error.message}`);
        if (!result.data)
            return { status: 'unknown' };
        return {
            status: result.data.status,
            revoked_at: result.data.revoked_at,
            reason: result.data.reason,
        };
    }
    async batchGetStatus(credential_ids) {
        if (credential_ids.length === 0)
            return new Map();
        const result = await this.client
            .from('revocations')
            .select('credential_id, status, revoked_at, reason')
            .in('credential_id', credential_ids);
        if (result.error)
            throw new Error(`SupabaseRevocationStore.batchGetStatus: ${result.error.message}`);
        const out = new Map();
        for (const id of credential_ids)
            out.set(id, { status: 'unknown' });
        for (const row of result.data || []) {
            out.set(row.credential_id, {
                status: row.status,
                revoked_at: row.revoked_at,
                reason: row.reason,
            });
        }
        return out;
    }
}
exports.SupabaseRevocationStore = SupabaseRevocationStore;
function createSupabasePersistence(opts) {
    return {
        receipts: new SupabaseReceiptStore(opts),
        nonces: new SupabaseNonceStore(opts),
        revocations: new SupabaseRevocationStore(opts),
    };
}
function createSupabasePersistenceFromEnv() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set');
    }
    return createSupabasePersistence({ url, key });
}
