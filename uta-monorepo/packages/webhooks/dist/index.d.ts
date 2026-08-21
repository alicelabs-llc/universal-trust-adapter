/**
 * @marketnow/trust-webhooks
 * P6-5: Webhook system for real-time revocation notifications.
 *
 * When a credential is revoked, subscribers receive an HTTP POST with the
 * revocation event. This allows downstream systems (gateways, caches,
 * dashboards) to invalidate their caches and refuse the credential without
 * polling the OCSP responder.
 *
 * Features:
 *   - Subscribe/unsubscribe webhook URLs for revocation events
 *   - HMAC-SHA256 signature on each webhook delivery (header: X-UTA-Signature)
 *   - Automatic retry with exponential backoff (3 attempts: 1s, 5s, 30s)
 *   - Configurable event types (revocation, issuance, gateway_decision)
 *   - Delivery audit log (status code + body + timestamp)
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
export type WebhookEventType = 'revocation' | 'issuance' | 'gateway_decision' | 'key_rotation';
export interface WebhookSubscription {
    id: string;
    url: string;
    events: WebhookEventType[];
    /** HMAC secret for signing deliveries (caller generates, both sides share) */
    secret: string;
    /** Optional: filter by credential_id pattern */
    credential_id_filter?: string;
    /** Optional: filter by issuer DID */
    issuer_filter?: string;
    created_at: string;
    /** Whether the subscription is currently active */
    active: boolean;
}
export interface WebhookEvent {
    id: string;
    type: WebhookEventType;
    credential_id: string;
    issuer?: string;
    payload: Record<string, unknown>;
    created_at: string;
    /** Delivery attempts */
    attempts: WebhookDeliveryAttempt[];
    /** Final delivery status */
    final_status?: 'delivered' | 'failed' | 'pending';
}
export interface WebhookDeliveryAttempt {
    subscription_id: string;
    url: string;
    attempt_number: number;
    status_code?: number;
    response_body?: string;
    error?: string;
    timestamp: string;
    duration_ms: number;
}
export declare class WebhookManager {
    private subscriptions;
    private deliveryLog;
    private maxLogSize;
    private signingKeyPem;
    private signingKeyId;
    private fetchImpl;
    constructor(opts: {
        /** Ed25519 private key PEM for signing deliveries (proves authenticity) */
        signingKeyPem: string;
        signingKeyId: string;
        /** Max log entries to keep (default 10000) */
        maxLogSize?: number;
        /** Fetch implementation (defaults to global fetch; can be mocked for testing) */
        fetchImpl?: typeof fetch;
    });
    /**
     * Subscribe a URL to receive webhook events.
     * Returns the subscription ID (used for unsubscribing).
     */
    subscribe(opts: {
        url: string;
        events: WebhookEventType[];
        secret?: string;
        credential_id_filter?: string;
        issuer_filter?: string;
    }): string;
    /**
     * Unsubscribe by subscription ID.
     */
    unsubscribe(subscriptionId: string): boolean;
    /**
     * List all subscriptions.
     */
    listSubscriptions(): WebhookSubscription[];
    /**
     * Emit an event to all matching subscribers.
     * Returns the event ID and the number of subscribers notified.
     */
    emit(event: {
        type: WebhookEventType;
        credential_id: string;
        issuer?: string;
        payload: Record<string, unknown>;
    }): Promise<{
        eventId: string;
        delivered: number;
        failed: number;
    }>;
    private findMatchingSubscriptions;
    private deliverOnce;
    /**
     * Get the delivery log (for audit / dashboard).
     */
    getDeliveryLog(filter?: {
        event_type?: WebhookEventType;
        credential_id?: string;
    }): WebhookEvent[];
    /**
     * Verify a webhook delivery's HMAC signature (used by the receiver).
     */
    static verifyHmacSignature(body: string, signatureHeader: string, secret: string): boolean;
    /**
     * Verify a webhook delivery's Ed25519 signature (proves server authenticity).
     */
    static verifyEd25519Signature(body: string, eventId: string, signatureHex: string, publicKeyPem: string): boolean;
}
export declare function createWebhookManager(opts: {
    signingKeyPem: string;
    signingKeyId: string;
    maxLogSize?: number;
    fetchImpl?: typeof fetch;
}): WebhookManager;
