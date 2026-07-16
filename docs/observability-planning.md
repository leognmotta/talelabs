# TaleLabs Observability Planning

## Status And Scope

This document defines the intended production observability architecture for
TaleLabs. It is a deferred production-readiness plan, not active M5 scope.

Do not add Sentry, an OpenTelemetry backend, a Run Inspector, or a
`flowRunEvents` table while completing the provider-independent mocked run
engine. Preserve the correlation fields and durable domain records that make
this later work possible. Implement the baseline before beta and before broad
provider/model expansion.

## Core Principle

`flowRunId` is the observability spine across the TaleLabs API, PostgreSQL,
Trigger.dev tasks, generated Assets, application errors, traces, and support
tools.

Trigger.dev telemetry is not the product source of truth. PostgreSQL remains the
durable authority for runs, immutable snapshots, nodes, items, jobs, inputs,
outputs, costs, and safe domain errors. Trigger.dev explains worker execution;
the TaleLabs run model explains what the product admitted and produced.

## Recommended Initial Stack

### PostgreSQL: Product Diagnostics

PostgreSQL stores durable domain state, including:

```txt
flowRuns and immutable graph snapshots
flowRunNodes and flowRunNodeItems
generationJobs and attempt/retry summaries
exact input and output Asset lineage
model contract, provider route, registry, snapshot, and executor versions
creditCost and providerCostUsd
safe error codes and messages
```

Build an internal Run Inspector from these records. Trigger.dev must never be
the only place where support can understand a run.

Later, consider an append-only `flowRunEvents` table for meaningful domain
transitions only:

```txt
admitted
dispatched
job_started
retry_scheduled
output_ingested
completed
failed
canceled
reconciled
```

Do not copy debug logs or high-volume worker telemetry into PostgreSQL.

### Trigger.dev: Worker Execution Telemetry

Use Trigger.dev for task attempts, queues, waits, retries, cancellation,
structured worker logs, custom traces, and execution metrics.

Use Trigger.dev's structured logger rather than parallel `console` logging
conventions. Enable deployment and run-failure alerts through email initially.

References:

- [Trigger.dev logging, tracing, and metrics](https://trigger.dev/docs/logging)
- [Trigger.dev alerts](https://trigger.dev/docs/troubleshooting-alerts)

### Sentry: Application Errors

Use Sentry initially for dashboard crashes, Hono/API exceptions, releases, and
source maps. Attach the correlation fields that exist for the failing boundary:

```txt
requestId
flowRunId
generationJobId
triggerRunId
organizationId
deploymentVersion
```

References:

- [Sentry React](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Sentry Hono source maps](https://docs.sentry.io/platforms/javascript/guides/hono/sourcemaps/troubleshooting_js/)

### OpenTelemetry: Vendor-Neutral Telemetry

Use OpenTelemetry conventions for traces and metrics so TaleLabs can later use
Axiom, Honeycomb, Grafana Cloud, Datadog, or another backend without rewriting
domain instrumentation. Propagate trace context across API, Trigger.dev, and
provider boundaries.

Do not add a separate centralized OpenTelemetry backend until production volume
requires cross-service log and trace search.

Reference:

- [OpenTelemetry traces](https://opentelemetry.io/docs/concepts/signals/traces/)

## Internal Run Inspector

The future internal route `/admin/runs/:runId` should show:

```txt
run status, command, and captured Flow revision
snapshot hash and plan hash
node, item, and job execution timeline
attempt and retry counts
input and output Asset IDs with lineage
model contract and provider route versions
recorded costs and execution durations
safe error codes and messages
triggerRunId with a Trigger.dev link
Sentry issue and trace links when available
reconcile, cancel, and retry diagnostics
```

This is an internal support surface. It must preserve tenant authorization and
must not expose prompts, provider payloads, storage keys, signed URLs,
credentials, or raw personal data in logs or error detail.

Provider telemetry is allowlisted, not redaction-driven. It may record stable
model and operation IDs, reviewed endpoint tags, reference counts and media
types, output settings such as duration or resolution, status classes, timings,
and bounded machine error codes. It must never attach a request body, response
body, prompt, generated text, signed URL, provider message, or a recursively
derived payload shape. Provider messages may be sanitized for an end-user error
surface, but are not log metadata.

## First Observability Implementation Task

When observability becomes active scope:

1. Define one shared event vocabulary and metadata contract used by the API and
   Trigger.dev packages.
2. Add an API `requestId` and return it in response headers and safe error
   responses.
3. Propagate correlation IDs through PostgreSQL records and Trigger task
   payloads without sending graph JSON or secrets to Trigger.dev.
4. Replace duplicate `logRunEngine` implementations with shared structured
   event helpers while keeping API and worker transports independently
   configurable.
5. Use Trigger.dev's structured logger in workers.
6. Add automatic secret and personal-data redaction.
7. Record deployment, snapshot, registry, model-contract, provider-route, and
   executor versions where applicable.
8. Add Sentry with releases and production source maps.

Never log:

```txt
prompts or generated text contents
media contents
signed URLs or storage keys
credentials, tokens, or request authorization
raw provider request or response payloads
personal data that is not required for diagnosis
```

IDs such as `flowRunId` and `generationJobId` belong in logs and trace
attributes. They must not become metric labels because their high cardinality
creates unbounded cost and poor aggregation.

## Before-Beta Metrics And Alerts

Track and alert on:

```txt
admission failure rate and latency
queue delay and total run duration
succeeded, partial, failed, and canceled rates
retry and attempt counts
runs stuck pending or running
provider timeout, rate-limit, and failure rates
Asset ingestion failures and orphan outputs
provider cost anomalies
reconciliation backlog and failures
```

Do not use module-level arrays, objects, or Maps to aggregate metrics. Every API
and worker process must emit raw structured measurements to Trigger.dev or a
shared OpenTelemetry backend that aggregates across instances.

## Recommended Rollout

```txt
now
  preserve durable run/job state and correlation IDs already required by M5

before beta
  PostgreSQL Run Inspector
  shared structured event vocabulary
  requestId and correlation propagation
  Trigger.dev structured telemetry and email alerts
  Sentry with releases and source maps
  essential run/provider/ingestion metrics and alerts

after production volume justifies it
  centralized OpenTelemetry backend
  cross-service trace and log search
  richer cost and reliability dashboards
```

The recommended first production stack is PostgreSQL Run Inspector +
Trigger.dev + Sentry. Add a centralized OpenTelemetry backend only when the
operational need is demonstrated.
