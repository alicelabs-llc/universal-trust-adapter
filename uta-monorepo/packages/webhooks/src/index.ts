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

import crypto from 'node:crypto';
import { canonicalize, canonicalHash, sign as ed25519Sign, verify as ed25519Verify, DOMAINS } from '../../core/crypto.js';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Webhook Manager
// ============================================================================

export class WebhookManager {
  private subscriptions = new Map<string, WebhookSubscription>();
  private deliveryLog: WebhookEvent[] = [];
  private maxLogSize: number;
  private signingKeyPem: string;
  private signingKeyId: string;
  private fetchImpl: typeof fetch;

  constructor(opts: {
    /** Ed25519 private key PEM for signing deliveries (proves authenticity) */
    signingKeyPem: string;
    signingKeyId: string;
    /** Max log entries to keep (default 10000) */
    maxLogSize?: number;
    /** Fetch implementation (defaults to global fetch; can be mocked for testing) */
    fetchImpl?: typeof fetch;
  }) {
    this.signingKeyPem = opts.signingKeyPem;
    this.signingKeyId = opts.signingKeyId;
    this.maxLogSize = opts.maxLogSize || 10000;
    this.fetchImpl = opts.fetchImpl || fetch;
  }

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
  }): string {
    const id = `wh_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const sub: WebhookSubscription = {
      id,
      url: opts.url,
      events: opts.events,
      secret: opts.secret || crypto.randomBytes(32).toString('hex'),
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
  unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  /**
   * List all subscriptions.
   */
  listSubscriptions(): WebhookSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Emit an event to all matching subscribers.
   * Returns the event ID and the number of subscribers notified.
   */
  async emit(event: {
    type: WebhookEventType;
    credential_id: string;
    issuer?: string;
    payload: Record<string, unknown>;
  }): Promise<{ eventId: string; delivered: number; failed: number }> {
    const eventId = `evt_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const createdAt = new Date().toISOString();

    // Find matching subscriptions
    const matching = this.findMatchingSubscriptions(event);

    const webhookEvent: WebhookEvent = {
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
      let attempt: WebhookDeliveryAttempt | null = null;

      for (let i = 0; i < 3; i++) {
        if (i > 0) await sleep(backoffMs[i]);
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

  private findMatchingSubscriptions(event: {
    type: WebhookEventType;
    credential_id: string;
    issuer?: string;
  }): WebhookSubscription[] {
    return Array.from(this.subscriptions.values()).filter(sub => {
      if (!sub.active) return false;
      if (!sub.events.includes(event.type)) return false;
      if (sub.credential_id_filter && !event.credential_id.includes(sub.credential_id_filter)) return false;
      if (sub.issuer_filter && event.issuer !== sub.issuer_filter) return false;
      return true;
    });
  }

  private async deliverOnce(
    sub: WebhookSubscription,
    eventId: string,
    event: { type: WebhookEventType; credential_id: string; issuer?: string; payload: Record<string, unknown> },
    createdAt: string
  ): Promise<WebhookDeliveryAttempt> {
    const start = Date.now();
    const attempt: WebhookDeliveryAttempt = {
      subscription_id: sub.id,
      url: sub.url,
      attempt_number: 0,  // set by caller
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
    const hmac = crypto.createHmac('sha256', sub.secret).update(body, 'utf-8').digest('hex');

    // Also compute an Ed25519 signature (server-wide, proves authenticity)
    const edSignature = ed25519Sign(
      { event_id: eventId, body },
      this.signingKeyPem,
      DOMAINS.TRUST_DECISION
    );

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
    } catch (e) {
      attempt.error = e instanceof Error ? e.message : String(e);
    }

    attempt.duration_ms = Date.now() - start;
    return attempt;
  }

  /**
   * Get the delivery log (for audit / dashboard).
   */
  getDeliveryLog(filter?: { event_type?: WebhookEventType; credential_id?: string }): WebhookEvent[] {
    let log = this.deliveryLog;
    if (filter?.event_type) log = log.filter(e => e.type === filter.event_type);
    if (filter?.credential_id) log = log.filter(e => e.credential_id === filter.credential_id);
    return log.slice().reverse();  // newest first
  }

  /**
   * Verify a webhook delivery's HMAC signature (used by the receiver).
   */
  static verifyHmacSignature(body: string, signatureHeader: string, secret: string): boolean {
    // signatureHeader format: "sha256=<hex>"
    const match = signatureHeader.match(/^sha256=([a-f0-9]+)$/);
    if (!match) return false;
    const expected = match[1];
    const computed = crypto.createHmac('sha256', secret).update(body, 'utf-8').digest('hex');
    // Constant-time comparison
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(computed, 'hex'));
  }

  /**
   * Verify a webhook delivery's Ed25519 signature (proves server authenticity).
   */
  static verifyEd25519Signature(body: string, eventId: string, signatureHex: string, publicKeyPem: string): boolean {
    return ed25519Verify({ event_id: eventId, body }, signatureHex, publicKeyPem, DOMAINS.TRUST_DECISION);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ============================================================================
// Convenience: create a webhook manager from a gateway key pair
// ============================================================================

export function createWebhookManager(opts: {
  signingKeyPem: string;
  signingKeyId: string;
  maxLogSize?: number;
  fetchImpl?: typeof fetch;
}): WebhookManager {
  return new WebhookManager(opts);
}
