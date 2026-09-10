# @marketnow/trust-observability

Zero-dependency observability for trust infrastructure: **structured JSON logging, OpenTelemetry-style tracing, and Prometheus metrics** — in 155 lines with no runtime dependencies.

Built for the MarketNow trust stack (gateways, verifiers, sentinels), works anywhere Node runs.

## Install

```bash
npm install @marketnow/trust-observability
```

## Quick start

```js
const { createObservability, StructuredLogger, MetricsHelper, TracingHelper } =
  require('@marketnow/trust-observability');

// All-in-one
const { logger, metrics, tracer } = createObservability({ serviceName: 'trust-gateway' });
logger.info('credential verified', { agent_id: 'a-12', decision: 'ALLOW' });

// Structured logging (one JSON line per event, sink-pluggable)
const log = new StructuredLogger({ serviceName: 'uta' });
log.warn('trust score below threshold', { score: 3, tool: 'exec' });

// Prometheus exposition
const m = new MetricsHelper();
m.incrementCounter('uta_checks_total', { result: 'DENY' });
m.observeHistogram('uta_latency_ms', 42);
console.log(m.toPrometheus());
// # TYPE uta_checks_total counter
// uta_checks_total{result="DENY"} 1
// ...

// Tracing spans
const t = new TracingHelper({ serviceName: 'uta' });
const span = t.startSpan('verify-credential');
span.setLabel('format', 'atc');
span.end(); // duration recorded
```

## Exports

| Export | What it does |
|---|---|
| `createObservability(opts)` | Logger + metrics + tracer, pre-wired |
| `StructuredLogger` | JSON-lines logging with levels and pluggable sinks |
| `MetricsHelper` | Counters + histograms, `toPrometheus()` exposition |
| `TracingHelper` | Span-based tracing with labels and timing |

No dependencies. Node >= 18.

Part of the MarketNow trust stack — see the [universal-trust-adapter repo](https://github.com/alicelabs-llc/universal-trust-adapter) and [marketnow.site](https://www.marketnow.site).

License: AL-1.0 (AliceLabs LLC).
