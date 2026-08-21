/**
 * @marketnow/trust-observability
 * P8-5: Structured logging + tracing + metrics.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3, fatal: 4,
};

function consoleSink(entry: LogEntry): void {
  const text = JSON.stringify(entry);
  if (entry.level === 'error' || entry.level === 'fatal') {
    process.stderr.write(text + '\n');
  } else {
    process.stdout.write(text + '\n');
  }
}

export class StructuredLogger {
  private minLevel: LogLevel;
  private context: Record<string, unknown>;
  private sinks: Array<(entry: LogEntry) => void>;

  constructor(opts: { minLevel?: LogLevel; context?: Record<string, unknown>; sinks?: Array<(entry: LogEntry) => void> } = {}) {
    this.minLevel = opts.minLevel || 'info';
    this.context = opts.context || {};
    this.sinks = opts.sinks || [consoleSink];
  }

  child(context: Record<string, unknown>): StructuredLogger {
    return new StructuredLogger({
      minLevel: this.minLevel,
      context: { ...this.context, ...context },
      sinks: this.sinks,
    });
  }

  log(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
    if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[this.minLevel]) return;
    const entry: LogEntry = { timestamp: new Date().toISOString(), level, message, ...this.context, ...fields };
    for (const sink of this.sinks) sink(entry);
  }

  debug(msg: string, fields?: Record<string, unknown>) { this.log('debug', msg, fields); }
  info(msg: string, fields?: Record<string, unknown>) { this.log('info', msg, fields); }
  warn(msg: string, fields?: Record<string, unknown>) { this.log('warn', msg, fields); }
  error(msg: string, fields?: Record<string, unknown>) { this.log('error', msg, fields); }
  fatal(msg: string, fields?: Record<string, unknown>) { this.log('fatal', msg, fields); }
}

export interface Span {
  name: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, unknown>;
  events: Array<{ name: string; timestamp: string; attributes?: Record<string, unknown> }>;
  parent?: Span;
  status: 'unset' | 'ok' | 'error';
}

export class TracingHelper {
  private spans: Span[] = [];
  private currentSpan: Span | null = null;

  startSpan(name: string, attributes?: Record<string, unknown>): Span {
    const span: Span = {
      name, startTime: Date.now(),
      attributes: attributes || {},
      events: [],
      parent: this.currentSpan || undefined,
      status: 'unset',
    };
    this.spans.push(span);
    this.currentSpan = span;
    return span;
  }

  endSpan(span: Span, status: 'ok' | 'error' = 'ok'): void {
    span.endTime = Date.now();
    span.status = status;
    this.currentSpan = span.parent || null;
  }

  addEvent(span: Span, name: string, attributes?: Record<string, unknown>): void {
    span.events.push({ name, timestamp: new Date().toISOString(), attributes });
  }

  setAttribute(span: Span, key: string, value: unknown): void {
    span.attributes[key] = value;
  }

  getSpans(): Span[] { return [...this.spans]; }

  exportTraces(): unknown {
    return {
      resourceSpans: [{
        resource: { attributes: { 'service.name': 'uta-trust-server' } },
        scopeSpans: [{
          scope: { name: 'uta.trust' },
          spans: this.spans.map(s => ({
            name: s.name,
            startTimeUnixNano: (s.startTime * 1_000_000).toString(),
            endTimeUnixNano: ((s.endTime || Date.now()) * 1_000_000).toString(),
            status: { code: s.status === 'ok' ? 1 : s.status === 'error' ? 2 : 0 },
          })),
        }],
      }],
    };
  }
}

export interface MetricCounter {
  name: string;
  value: number;
  labels: Record<string, string>;
}

export interface MetricHistogram {
  name: string;
  count: number;
  sum: number;
  buckets: Record<string, number>;
  labels: Record<string, string>;
}

export class MetricsHelper {
  private counters = new Map<string, MetricCounter>();
  private histograms = new Map<string, MetricHistogram>();

  incrementCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    const key = `${name}:${JSON.stringify(labels)}`;
    let counter = this.counters.get(key);
    if (!counter) {
      counter = { name, value: 0, labels };
      this.counters.set(key, counter);
    }
    counter.value += value;
  }

  observeHistogram(name: string, value: number, labels: Record<string, string> = {}, buckets: number[] = [1, 5, 10, 50, 100, 500, 1000]): void {
    const key = `${name}:${JSON.stringify(labels)}`;
    let hist = this.histograms.get(key);
    if (!hist) {
      hist = {
        name, count: 0, sum: 0,
        buckets: Object.fromEntries(buckets.map(b => [String(b), 0])),
        labels,
      };
      this.histograms.set(key, hist);
    }
    hist.count++;
    hist.sum += value;
    for (const b of buckets) {
      if (value <= b) hist.buckets[String(b)]++;
    }
  }

  toPrometheus(): string {
    const lines: string[] = [];
    for (const counter of this.counters.values()) {
      lines.push(`# TYPE ${counter.name} counter`);
      const labelStr = Object.entries(counter.labels).map(([k, v]) => `${k}="${v}"`).join(',');
      lines.push(`${counter.name}{${labelStr}} ${counter.value}`);
    }
    for (const hist of this.histograms.values()) {
      lines.push(`# TYPE ${hist.name} histogram`);
      const labelStr = Object.entries(hist.labels).map(([k, v]) => `${k}="${v}"`).join(',');
      for (const [bucket, count] of Object.entries(hist.buckets)) {
        lines.push(`${hist.name}_bucket{le="${bucket}",${labelStr}} ${count}`);
      }
      lines.push(`${hist.name}_bucket{le="+Inf",${labelStr}} ${hist.count}`);
      lines.push(`${hist.name}_sum{${labelStr}} ${hist.sum}`);
      lines.push(`${hist.name}_count{${labelStr}} ${hist.count}`);
    }
    return lines.join('\n');
  }
}

export interface ObservabilityBundle {
  logger: StructuredLogger;
  tracer: TracingHelper;
  metrics: MetricsHelper;
}

export function createObservability(opts: { minLevel?: LogLevel; context?: Record<string, unknown> } = {}): ObservabilityBundle {
  return {
    logger: new StructuredLogger({ minLevel: opts.minLevel, context: opts.context }),
    tracer: new TracingHelper(),
    metrics: new MetricsHelper(),
  };
}
