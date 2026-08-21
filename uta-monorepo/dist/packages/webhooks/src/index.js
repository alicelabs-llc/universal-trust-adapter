"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookManager = void 0;
exports.createWebhookManager = createWebhookManager;
const node_crypto_1 = __importDefault(require("node:crypto"));
const crypto_js_1 = require("../../core/crypto.js");
// ============================================================================
// Webhook Manager
// ============================================================================
class WebhookManager {
    subscriptions = new Map();
    deliveryLog = [];
    maxLogSize;
    signingKeyPem;
    signingKeyId;
    fetchImpl;
    constructor(opts) {
        this.signingKeyPem = opts.signingKeyPem;
        this.signingKeyId = opts.signingKeyId;
        this.maxLogSize = opts.maxLogSize || 10000;
        this.fetchImpl = opts.fetchImpl || fetch;
    }
    /**
     * Subscribe a URL to receive webhook events.
     * Returns the subscription ID (used for unsubscribing).
     */
    subscribe(opts) {
        const id = `wh_${node_crypto_1.default.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        const sub = {
            id,
            url: opts.url,
            events: opts.events,
            secret: opts.secret || node_crypto_1.default.randomBytes(32).toString('hex'),
            credential_id_filter: opts.credential_id_filter,
            issuer_filter: opts.issuer_filter,
            created_at: new Date().toISOString(),
            active: true,
        };
        this.subscriptions.set(id, sub);
        return id;
    }
    /**
     * Unsubscribe by subscription ID.
     */
    unsubscribe(subscriptionId) {
        return this.subscriptions.delete(subscriptionId);
    }
    /**
     * List all subscriptions.
     */
    listSubscriptions() {
        return Array.from(this.subscriptions.values());
    }
    /**
     * Emit an event to all matching subscribers.
     * Returns the event ID and the number of subscribers notified.
     */
    async emit(event) {
        const eventId = `evt_${node_crypto_1.default.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        const createdAt = new Date().toISOString();
        // Find matching subscriptions
        const matching = this.findMatchingSubscriptions(event);
        const webhookEvent = {
            id: eventId,
            type: event.type,
            credential_id: event.credential_id,
            issuer: event.issuer,
            payload: event.payload,
            created_at: createdAt,
            attempts: [],
            final_status: 'pending',
        };
        let delivered = 0;
        let failed = 0;
        // Deliver to each matching subscription
        for (const sub of matching) {
            // Try up to 3 times with exponential backoff
            const backoffMs = [0, 1000, 5000, 30000];
            let attempt = null;
            for (let i = 0; i < 3; i++) {
                if (i > 0)
                    await sleep(backoffMs[i]);
                attempt = await this.deliverOnce(sub, eventId, event, createdAt);
                webhookEvent.attempts.push(attempt);
                if (attempt.status_code && attempt.status_code >= 200 && attempt.status_code < 300) {
                    // Success
                    delivered++;
                    break;
                }
                if (i === 2) {
                    // Final attempt failed
                    failed++;
                }
            }
        }
        webhookEvent.final_status = failed === 0 ? 'delivered' : (delivered > 0 ? 'delivered' : 'failed');
        // Log the event
        this.deliveryLog.push(webhookEvent);
        if (this.deliveryLog.length > this.maxLogSize) {
            this.deliveryLog.shift();
        }
        return { eventId, delivered, failed };
    }
    findMatchingSubscriptions(event) {
        return Array.from(this.subscriptions.values()).filter(sub => {
            if (!sub.active)
                return false;
            if (!sub.events.includes(event.type))
                return false;
            if (sub.credential_id_filter && !event.credential_id.includes(sub.credential_id_filter))
                return false;
            if (sub.issuer_filter && event.issuer !== sub.issuer_filter)
                return false;
            return true;
        });
    }
    async deliverOnce(sub, eventId, event, createdAt) {
        const start = Date.now();
        const attempt = {
            subscription_id: sub.id,
            url: sub.url,
            attempt_number: 0, // set by caller
            timestamp: new Date().toISOString(),
            duration_ms: 0,
        };
        // Build the delivery payload
        const body = JSON.stringify({
            event_id: eventId,
            type: event.type,
            credential_id: event.credential_id,
            issuer: event.issuer,
            payload: event.payload,
            created_at: createdAt,
            delivered_at: new Date().toISOString(),
        });
        // Compute HMAC-SHA256 signature (per-subscription secret)
        const hmac = node_crypto_1.default.createHmac('sha256', sub.secret).update(body, 'utf-8').digest('hex');
        // Also compute an Ed25519 signature (server-wide, proves authenticity)
        const edSignature = (0, crypto_js_1.sign)({ event_id: eventId, body }, this.signingKeyPem, crypto_js_1.DOMAINS.TRUST_DECISION);
        try {
            const response = await this.fetchImpl(sub.url, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-uta-signature': `sha256=${hmac}`,
                    'x-uta-ed25519-signature': edSignature,
                    'x-uta-signature-key-id': this.signingKeyId,
                    'x-uta-event-id': eventId,
                    'x-uta-event-type': event.type,
                },
                body,
                // 10 second timeout per attempt
                signal: AbortSignal.timeout(10000),
            });
            attempt.status_code = response.status;
            attempt.response_body = await response.text().catch(() => '');
            if (response.status < 200 || response.status >= 300) {
                attempt.error = `HTTP ${response.status}`;
            }
        }
        catch (e) {
            attempt.error = e instanceof Error ? e.message : String(e);
        }
        attempt.duration_ms = Date.now() - start;
        return attempt;
    }
    /**
     * Get the delivery log (for audit / dashboard).
     */
    getDeliveryLog(filter) {
        let log = this.deliveryLog;
        if (filter?.event_type)
            log = log.filter(e => e.type === filter.event_type);
        if (filter?.credential_id)
            log = log.filter(e => e.credential_id === filter.credential_id);
        return log.slice().reverse(); // newest first
    }
    /**
     * Verify a webhook delivery's HMAC signature (used by the receiver).
     */
    static verifyHmacSignature(body, signatureHeader, secret) {
        // signatureHeader format: "sha256=<hex>"
        const match = signatureHeader.match(/^sha256=([a-f0-9]+)$/);
        if (!match)
            return false;
        const expected = match[1];
        const computed = node_crypto_1.default.createHmac('sha256', secret).update(body, 'utf-8').digest('hex');
        // Constant-time comparison
        return node_crypto_1.default.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(computed, 'hex'));
    }
    /**
     * Verify a webhook delivery's Ed25519 signature (proves server authenticity).
     */
    static verifyEd25519Signature(body, eventId, signatureHex, publicKeyPem) {
        return (0, crypto_js_1.verify)({ event_id: eventId, body }, signatureHex, publicKeyPem, crypto_js_1.DOMAINS.TRUST_DECISION);
    }
}
exports.WebhookManager = WebhookManager;
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
// ============================================================================
// Convenience: create a webhook manager from a gateway key pair
// ============================================================================
function createWebhookManager(opts) {
    return new WebhookManager(opts);
}
