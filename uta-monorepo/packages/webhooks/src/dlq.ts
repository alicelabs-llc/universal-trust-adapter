/**
 * P10-2: Dead-letter queue for failed webhook deliveries.
 * Stores failed deliveries for later retry/admin inspection.
 */

import crypto from 'node:crypto';

export interface DeadLetterEntry {
  id: string;
  subscription_id: string;
  url: string;
  event_id: string;
  event_type: string;
  body: string;
  last_error: string;
  attempts: number;
  created_at: string;
  last_attempt_at: string;
  next_retry_at?: string;
}

export class DeadLetterQueue {
  private entries: DeadLetterEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries = 10000) {
    this.maxEntries = maxEntries;
  }

  add(entry: Omit<DeadLetterEntry, 'id' | 'created_at' | 'last_attempt_at'>): DeadLetterEntry {
    const full: DeadLetterEntry = {
      ...entry,
      id: `dlq_${crypto.randomUUID().slice(0, 12)}`,
      created_at: new Date().toISOString(),
      last_attempt_at: new Date().toISOString(),
    };
    this.entries.push(full);
    if (this.entries.length > this.maxEntries) this.entries.shift();
    return full;
  }

  getPending(): DeadLetterEntry[] {
    const now = Date.now();
    return this.entries.filter(e =>
      !e.next_retry_at || new Date(e.next_retry_at).getTime() <= now
    );
  }

  markRetried(id: string, success: boolean, error?: string): void {
    const entry = this.entries.find(e => e.id === id);
    if (!entry) return;
    if (success) {
      this.entries = this.entries.filter(e => e.id !== id);
    } else {
      entry.attempts++;
      entry.last_error = error || 'retry failed';
      entry.last_attempt_at = new Date().toISOString();
      const backoff = Math.min(3600 * 1000, 60 * 1000 * Math.pow(2, entry.attempts));
      entry.next_retry_at = new Date(Date.now() + backoff).toISOString();
    }
  }

  getAll(): DeadLetterEntry[] { return [...this.entries]; }
  size(): number { return this.entries.length; }
  clear(): void { this.entries = []; }
}
