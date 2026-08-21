"use strict";
/**
 * @marketnow/trust-observability
 * P8-5: Structured logging + tracing + metrics.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsHelper = exports.TracingHelper = exports.StructuredLogger = void 0;
exports.createObservability = createObservability;
const LOG_LEVEL_ORDER = {
    debug: 0, info: 1, warn: 2, error: 3, fatal: 4,
};
function consoleSink(entry) {
    const text = JSON.stringify(entry);
    if (entry.level === 'error' || entry.level === 'fatal') {
        process.stderr.write(text + '\n');
    }
    else {
        process.stdout.write(text + '\n');
    }
}
class StructuredLogger {
    minLevel;
    context;
    sinks;
    constructor(opts = {}) {
        this.minLevel = opts.minLevel || 'info';
        this.context = opts.context || {};
        this.sinks = opts.sinks || [consoleSink];
    }
    child(context) {
        return new StructuredLogger({
            minLevel: this.minLevel,
            context: { ...this.context, ...context },
            sinks: this.sinks,
        });
    }
    log(level, message, fields) {
        if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[this.minLevel])
            return;
        const entry = { timestamp: new Date().toISOString(), level, message, ...this.context, ...fields };
        for (const sink of this.sinks)
            sink(entry);
    }
    debug(msg, fields) { this.log('debug', msg, fields); }
    info(msg, fields) { this.log('info', msg, fields); }
    warn(msg, fields) { this.log('warn', msg, fields); }
    error(msg, fields) { this.log('error', msg, fields); }
    fatal(msg, fields) { this.log('fatal', msg, fields); }
}
exports.StructuredLogger = StructuredLogger;
class TracingHelper {
    spans = [];
    currentSpan = null;
    startSpan(name, attributes) {
        const span = {
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
    endSpan(span, status = 'ok') {
        span.endTime = Date.now();
        span.status = status;
        this.currentSpan = span.parent || null;
    }
    addEvent(span, name, attributes) {
        span.events.push({ name, timestamp: new Date().toISOString(), attributes });
    }
    setAttribute(span, key, value) {
        span.attributes[key] = value;
    }
    getSpans() { return [...this.spans]; }
    exportTraces() {
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
exports.TracingHelper = TracingHelper;
class MetricsHelper {
    counters = new Map();
    histograms = new Map();
    incrementCounter(name, labels = {}, value = 1) {
        const key = `${name}:${JSON.stringify(labels)}`;
        let counter = this.counters.get(key);
        if (!counter) {
            counter = { name, value: 0, labels };
            this.counters.set(key, counter);
        }
        counter.value += value;
    }
    observeHistogram(name, value, labels = {}, buckets = [1, 5, 10, 50, 100, 500, 1000]) {
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
            if (value <= b)
                hist.buckets[String(b)]++;
        }
    }
    toPrometheus() {
        const lines = [];
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
exports.MetricsHelper = MetricsHelper;
function createObservability(opts = {}) {
    return {
        logger: new StructuredLogger({ minLevel: opts.minLevel, context: opts.context }),
        tracer: new TracingHelper(),
        metrics: new MetricsHelper(),
    };
}
