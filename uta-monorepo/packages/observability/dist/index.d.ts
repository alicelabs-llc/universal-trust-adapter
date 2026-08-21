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
export declare class StructuredLogger {
    private minLevel;
    private context;
    private sinks;
    constructor(opts?: {
        minLevel?: LogLevel;
        context?: Record<string, unknown>;
        sinks?: Array<(entry: LogEntry) => void>;
    });
    child(context: Record<string, unknown>): StructuredLogger;
    log(level: LogLevel, message: string, fields?: Record<string, unknown>): void;
    debug(msg: string, fields?: Record<string, unknown>): void;
    info(msg: string, fields?: Record<string, unknown>): void;
    warn(msg: string, fields?: Record<string, unknown>): void;
    error(msg: string, fields?: Record<string, unknown>): void;
    fatal(msg: string, fields?: Record<string, unknown>): void;
}
export interface Span {
    name: string;
    startTime: number;
    endTime?: number;
    attributes: Record<string, unknown>;
    events: Array<{
        name: string;
        timestamp: string;
        attributes?: Record<string, unknown>;
    }>;
    parent?: Span;
    status: 'unset' | 'ok' | 'error';
}
export declare class TracingHelper {
    private spans;
    private currentSpan;
    startSpan(name: string, attributes?: Record<string, unknown>): Span;
    endSpan(span: Span, status?: 'ok' | 'error'): void;
    addEvent(span: Span, name: string, attributes?: Record<string, unknown>): void;
    setAttribute(span: Span, key: string, value: unknown): void;
    getSpans(): Span[];
    exportTraces(): unknown;
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
export declare class MetricsHelper {
    private counters;
    private histograms;
    incrementCounter(name: string, labels?: Record<string, string>, value?: number): void;
    observeHistogram(name: string, value: number, labels?: Record<string, string>, buckets?: number[]): void;
    toPrometheus(): string;
}
export interface ObservabilityBundle {
    logger: StructuredLogger;
    tracer: TracingHelper;
    metrics: MetricsHelper;
}
export declare function createObservability(opts?: {
    minLevel?: LogLevel;
    context?: Record<string, unknown>;
}): ObservabilityBundle;
