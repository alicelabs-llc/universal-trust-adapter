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
import type { ActionReceipt } from '../../gateway/receipts.js';
import type { NonceStore, StoredChallenge } from '../../core/nonce-store.js';
import type { RevocationStore, RevocationStatus } from '../../core/revocation.js';
interface SupabaseQueryResponse<T = any> {
    data: T | null;
    error: {
        message: string;
        code?: string;
    } | null;
    count?: number | null;
}
interface SupabaseQueryBuilder {
    select(columns?: string): any;
    insert(values: any): any;
    update(values: any): any;
    delete(): any;
    upsert(values: any): any;
    eq(column: string, value: any): any;
    in(column: string, value: any[]): any;
    or(filter: string): any;
    order(column: string, opts?: {
        ascending?: boolean;
    }): any;
    maybeSingle(): Promise<SupabaseQueryResponse>;
}
interface SupabaseClientLike {
    from(table: string): SupabaseQueryBuilder;
}
type Client = SupabaseClientLike;
export interface ReceiptStore {
    store(receipt: ActionReceipt): Promise<void>;
    retrieve(receiptId: string): Promise<ActionReceipt | null>;
    list(filter?: {
        agent_id?: string;
        decision?: string;
    }): Promise<ActionReceipt[]>;
    count(): Promise<number>;
}
export declare class SupabaseReceiptStore implements ReceiptStore {
    protected client: Client;
    constructor(opts: {
        client: Client;
    } | {
        url: string;
        key: string;
    });
    store(receipt: ActionReceipt): Promise<void>;
    retrieve(receiptId: string): Promise<ActionReceipt | null>;
    list(filter?: {
        agent_id?: string;
        decision?: string;
    }): Promise<ActionReceipt[]>;
    count(): Promise<number>;
}
export declare class SupabaseNonceStore implements NonceStore {
    protected client: Client;
    constructor(opts: {
        client: Client;
    } | {
        url: string;
        key: string;
    });
    store(challenge: StoredChallenge): Promise<void>;
    retrieve(nonce: string): Promise<StoredChallenge | null>;
    consume(nonce: string): Promise<StoredChallenge | null>;
    cleanup(): Promise<number>;
}
export declare class SupabaseRevocationStore implements RevocationStore {
    protected client: Client;
    constructor(opts: {
        client: Client;
    } | {
        url: string;
        key: string;
    });
    setStatus(credential_id: string, status: RevocationStatus, reason?: string): Promise<void>;
    getStatus(credential_id: string): Promise<{
        status: RevocationStatus;
        revoked_at?: string;
        reason?: string;
    }>;
    batchGetStatus(credential_ids: string[]): Promise<Map<string, {
        status: RevocationStatus;
        revoked_at?: string;
        reason?: string;
    }>>;
}
export interface SupabasePersistenceBundle {
    receipts: SupabaseReceiptStore;
    nonces: SupabaseNonceStore;
    revocations: SupabaseRevocationStore;
}
export declare function createSupabasePersistence(opts: {
    client: Client;
} | {
    url: string;
    key: string;
}): SupabasePersistenceBundle;
export declare function createSupabasePersistenceFromEnv(): SupabasePersistenceBundle;
export {};
