/**
 * P10-5: Production hardening utilities.
 * - Graceful shutdown (drain connections on SIGTERM)
 * - Connection pool
 * - Error recovery
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */

import http from 'node:http';

// ============================================================================
// Graceful Shutdown
// ============================================================================

export interface ShutdownHandler {
  name: string;
  shutdown: () => Promise<void>;
}

export class GracefulShutdown {
  private handlers: ShutdownHandler[] = [];
  private isShuttingDown = false;
  private server?: http.Server;
  private connections = new Set<any>();
  private shutdownTimeoutMs: number;

  constructor(opts: { shutdownTimeoutMs?: number } = {}) {
    this.shutdownTimeoutMs = opts.shutdownTimeoutMs || 10000;
  }

  trackServer(server: http.Server): void {
    this.server = server;
    server.on('connection', (conn) => {
      this.connections.add(conn);
      conn.on('close', () => this.connections.delete(conn));
    });
  }

  addHandler(name: string, shutdown: () => Promise<void>): void {
    this.handlers.push({ name, shutdown });
  }

  installSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
    for (const sig of signals) {
      process.on(sig, () => {
        this.shutdown(sig).catch(console.error);
      });
    }
  }

  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    console.log(`\n[${signal}] Graceful shutdown initiated...`);

    // Stop accepting new connections
    if (this.server) {
      this.server.close();
      console.log('  Server stopped accepting new connections');
    }

    // Wait for active connections to drain (with timeout)
    const drainStart = Date.now();
    while (this.connections.size > 0 && Date.now() - drainStart < this.shutdownTimeoutMs) {
      await new Promise(r => setTimeout(r, 100));
    }
    if (this.connections.size > 0) {
      console.log(`  Force-closing ${this.connections.size} lingering connections`);
      for (const conn of this.connections) conn.destroy();
    }

    // Run shutdown handlers in reverse order (LIFO)
    for (const handler of this.handlers.reverse()) {
      try {
        console.log(`  Shutting down: ${handler.name}`);
        await handler.shutdown();
      } catch (e) {
        console.error(`  Error shutting down ${handler.name}:`, e);
      }
    }

    console.log('Graceful shutdown complete.');
    process.exit(0);
  }

  get isShuttingDownState(): boolean {
    return this.isShuttingDown;
  }
}

// ============================================================================
// Health Check Helper
// ============================================================================

export interface HealthStatus {
  ok: boolean;
  checks: Record<string, { ok: boolean; latency_ms: number; error?: string }>;
  uptime_seconds: number;
}

export class HealthChecker {
  private checks = new Map<string, () => Promise<boolean>>();

  addCheck(name: string, fn: () => Promise<boolean>): void {
    this.checks.set(name, fn);
  }

  async check(): Promise<HealthStatus> {
    const results: HealthStatus['checks'] = {};
    let allOk = true;

    for (const [name, fn] of this.checks) {
      const start = Date.now();
      try {
        const ok = await fn();
        results[name] = { ok, latency_ms: Date.now() - start };
        if (!ok) allOk = false;
      } catch (e) {
        results[name] = { ok: false, latency_ms: Date.now() - start, error: e instanceof Error ? e.message : String(e) };
        allOk = false;
      }
    }

    return {
      ok: allOk,
      checks: results,
      uptime_seconds: Math.floor(process.uptime()),
    };
  }
}
