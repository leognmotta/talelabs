# TaleLabs Managed BYOK — Key Custody and Provider Gateway Plan

Status: research and architecture plan. Not approved for implementation. This
document refines Mode 3 of `docs/provider-execution-modes.md` into a concrete,
buildable strategy. Approving it moves the stable contracts into the
source-of-truth design documents per `docs/feature-research/README.md` rules.

Last researched: 2026-07-17.

## The Requirement

Managed BYOK stores a user's provider API key on TaleLabs infrastructure so
durable managed execution can run with the user's own provider account. The
non-negotiable constraint is:

```txt
Trigger.dev must never load, decrypt, transport, or use the user's provider
key — not from a task payload, not from a secret environment variable, not by
fetching it from a vault inside a task, and not by decrypting database
ciphertext with a key TaleLabs put in the Trigger.dev environment.
```

Consequence: the credential-bearing provider HTTP request must move out of
Trigger.dev workers into TaleLabs-controlled infrastructure. Trigger.dev keeps
orchestration (queues, retries, waitpoints, cancellation, aggregation); it loses
only the ability to hold the secret while doing so.

This plan answers three questions:

1. Where and how are keys stored ("database or key store")?
2. Is a Provider Gateway the right execution boundary, or is there a better
   alternative?
3. What exactly do we build, in what order, with what acceptance criteria?

## Current-State Findings (Codebase Research)

These facts were verified in the repository on 2026-07-17 and are load-bearing
for the design.

### How managed execution works today

1. The API admits a run, persists an immutable snapshot and generation jobs,
   then dispatches `flow-run-orchestrator` to Trigger.dev Cloud with **IDs
   only** (`apps/api/src/domain/runs/dispatch.service.ts` sends
   `{ flowRunId, organizationId }` with `idempotencyKey: runId`). Payloads are
   already secret-free.
2. Each generation job row persists the canonical normalized request:
   `generationJobs.requestPayload`, `requestHash`, plus the exact pinned
   binding (`provider`, `providerModel`, `providerEndpoint`, `adapterVersion`,
   `providerRouteVersion`, `providerLifecycle`) — `packages/db/src/schema.ts`.
   The worker never invents the request; it re-materializes it from PostgreSQL.
3. The worker resolves the platform credential from its own environment:
   `resolveProviderRuntimeCredential` in
   `packages/providers/src/server/credentials.ts` returns
   `resolveApiKey: () => process.env.OPENROUTER_API_KEY`. The OpenRouter
   transport injects `Authorization: Bearer` in
   `packages/providers/src/openrouter/transport/requests/execute.ts`.
4. The transport is already fully seam-injected: the client takes a
   non-serializable `credential.resolveApiKey()` resolver, an overridable
   `baseUrl`, and an overridable `fetch`
   (`packages/providers/src/openrouter/transport/contracts.ts`). Protocol
   adapters never touch the key directly.
5. Provider webhooks already terminate at the TaleLabs API, not at Trigger.dev
   (`apps/api/src/routes/provider-callbacks/openrouter-video-callback.routes.ts`,
   verified with `OPENROUTER_WEBHOOK_SECRET`). Callbacks resolve durable
   waitpoints by run/job identifiers.
6. Provider cost reconciliation is credential-bearing today: it fetches
   OpenRouter generation accounting with the platform key from inside Trigger
   (`packages/trigger/src/flow-runs/reconciliation/provider-accounting.ts`).
   Managed BYOK must relocate this call too, or user accounting facts cannot be
   fetched without violating the boundary.
7. A durable one-shot submission boundary already exists for the browser
   runtime (`begin-submission` compare-and-set, `browserSubmissionState`,
   `generationProviderResults` checkpoints). The gateway reuses this exact
   pattern rather than inventing a second idempotency model.

### Coupling risks that must be fixed regardless of design choice

These are current facts that would silently defeat any "Trigger.dev cannot
decrypt" claim if left as-is:

1. **Shared environment file.** `trigger.config.ts` loads the repository root
   `.env`, which contains `OPENROUTER_API_KEY`, `APP_SECRET`, `POSTGRES_URL`,
   and R2 credentials. Any decryption secret added to that file becomes
   available to Trigger.dev workers in development, and habits formed there
   leak into production env configuration.
2. **Full database access from workers.** Trigger tasks use `@talelabs/db`
   with the same `POSTGRES_URL` role as the API. If encrypted credentials live
   in PostgreSQL, workers can read the ciphertext. The security boundary is
   therefore **never** the database row — it is exclusively the decryption
   authority. Ciphertext readable by a worker plus a worker-reachable
   decryption key equals plaintext in the worker.
3. **Env-var encryption is explicitly out.** Encrypting keys with `APP_SECRET`
   (or any static app-level env key) fails the requirement twice: the same
   env value is reachable from the Trigger environment today, and a static
   symmetric env key offers no per-decrypt authorization, no audit trail, and
   no revocation story.

### Trigger.dev trust facts (external research)

- Task payloads are logged and visible in the Trigger.dev dashboard; their
  docs explicitly warn "Never pass secrets in the task payload."
- Secret environment variables are hidden in the dashboard after creation, but
  are fetched and injected into the worker process (`process.env`) before runs
  begin. "Hidden in the UI" is not "unavailable to the runtime."
- Self-hosting moves the worker onto TaleLabs infrastructure but the task
  runtime still holds the plaintext while executing, so it does not satisfy
  the requirement as stated, and it transfers Trigger.dev's entire
  reliability/scaling surface to TaleLabs.

## Options Evaluated

The user asked whether a gateway is actually the best option. Six designs were
evaluated against: the hard requirement, tenant authorization strength, blast
radius under component compromise, protocol coverage (text, image, audio,
video, async polling, authenticated output download, accounting), operational
cost, and honesty of the resulting marketing claim.

### Option A — Deliver the key into the worker (payload, secret env var, or vault fetch inside the task)

Rejected. All three variants place plaintext in the Trigger.dev runtime.
Payloads are additionally logged and dashboard-visible. Secret env vars are
project-wide, not per-tenant, so they cannot represent per-organization keys at
all. Fetching from a vault inside a task authenticates the *worker* to the
vault — exactly the trust we are told not to extend. This option is the
literal thing the requirement forbids.

### Option B — Self-host Trigger.dev

Rejected. The worker becomes TaleLabs-operated, but the task runtime still
sees plaintext, so "Trigger.dev never loads or decrypts the key" holds only in
the corporate sense, not the runtime sense the requirement describes. It also
adds the largest possible operational surface (queue infrastructure, workers,
upgrades, incident response) to solve a problem that a thin gateway solves with
a fraction of the code. `docs/provider-execution-modes.md` already reached the
same conclusion.

### Option C — Third-party key-injection gateway (Cloudflare AI Gateway BYOK, Evervault Relay, Basis Theory Proxy)

Cloudflare AI Gateway now supports BYOK backed by Cloudflare Secrets Store:
provider keys are stored with Cloudflare, requests carry only a
`cf-aig-authorization` token, and Cloudflare injects the provider key at its
edge. Evervault/Basis Theory offer the same shape with enclave-hardened
infrastructure.

Attractive properties: near-zero TaleLabs key-handling code, workers never see
plaintext (requirement letter satisfied), managed encryption and rotation.

Rejected as the primary design for four reasons:

1. **Custody claim.** User keys would be stored by a third party. The claim
   becomes "your key is stored with Cloudflare," which is weaker than "your
   key is encrypted in TaleLabs' vault and decrypted only inside
   TaleLabs-controlled infrastructure" — the claim
   `provider-execution-modes.md` commits to.
2. **Authorization granularity.** Any caller holding the gateway token can
   invoke any stored key alias. There is no per-job, per-run, per-tenant
   authorization tied to TaleLabs' persisted run state. A compromised worker
   could spend any customer's provider credits arbitrarily.
3. **Protocol coverage.** TaleLabs needs async submit/poll/cancel lifecycles,
   authenticated media output downloads up to 512 MB, and provider accounting
   lookups. Edge AI gateways cover chat-completion-shaped traffic well and the
   rest partially or not at all; every gap would need a first-party path
   anyway.
4. **Blast-radius shape.** TaleLabs' persisted `requestPayload`/`requestHash`
   allows a first-party gateway to refuse everything except already-admitted
   work. A pass-through injection proxy cannot express that rule.

Worth keeping on file as a hardening path (enclave execution) or as an interim
for chat-only protocols, but not the strategy.

### Option D — First-party raw header-injection forward proxy

A TaleLabs proxy that accepts provider-shaped HTTP from workers, swaps a
placeholder header for the real key, and forwards. Satisfies the plaintext
requirement and keeps custody first-party, but the worker still authors the
full request. The proxy must then defend with path allowlists against misuse
(for example OpenRouter's `/api/v1/keys` management endpoints) and cannot bind
requests to admitted jobs without parsing and understanding every body — at
which point it has become Option E with worse ergonomics. Rejected in favor of
Option E.

### Option E — First-party thin Provider Gateway executing persisted-job operations (recommended)

Trigger.dev sends **identifiers only**. The gateway loads the canonical
request, binding, and lifecycle from PostgreSQL, authorizes the operation
against run/job state, decrypts the tenant key in its own memory, executes the
single provider operation through the existing `@talelabs/providers` server
transport, and returns a sanitized result. Orchestration stays in Trigger.dev.

This is Mode 3 from `provider-execution-modes.md` with one material
improvement discovered during codebase research: because
`generationJobs.requestPayload` and `requestHash` are already persisted at
admission, the worker does not need to send the normalized request at all. The
gateway reads it from the database. A fully compromised Trigger.dev
environment can then, at worst, cause the gateway to execute *legitimate,
already-admitted, tenant-priced jobs* slightly earlier or more often than the
orchestrator would — never an arbitrary provider call, and never key
disclosure.

### Option F — Ephemeral scoped provider keys (OpenRouter provisioning / OAuth PKCE)

OpenRouter supports programmatic key management: a provisioning key can mint
runtime keys with spend limits, and OAuth PKCE can issue an app-scoped,
user-revocable runtime key. Neither eliminates the gateway: any key delivered
to a Trigger.dev worker — however scoped — still violates the requirement.
These are **blast-radius reducers and UX improvements layered on Option E**,
not alternatives:

- OAuth PKCE is the preferred acquisition flow: the user connects their
  OpenRouter account, TaleLabs receives a runtime key scoped to the TaleLabs
  app, and the user can revoke it from OpenRouter at any time.
- Provisioning-key custody (minting per-run limited keys) is deferred: the
  provisioning key is strictly more powerful than a runtime key, so storing it
  raises stakes rather than lowering them for V1.

### Verdict

The gateway is validated as the correct architecture. The refinement over the
existing Mode 3 sketch: the gateway is **IDs-in, sanitized-results-out**, and
the persisted job row is the only source of the provider request.

## Recommended Architecture

```mermaid
sequenceDiagram
  participant D as Dashboard
  participant A as TaleLabs API
  participant DB as PostgreSQL
  participant K as KMS
  participant T as Trigger.dev worker
  participant G as Gateway module (in API)
  participant P as AI Provider
  participant R as R2

  D->>A: Store provider key (TLS, once)
  A->>K: Encrypt(plaintext, encryptionContext)
  A->>DB: providerCredentials ciphertext + metadata
  Note over A: Credential CRUD is encrypt-only; decrypt is confined to the gateway module

  A->>DB: Admit run, snapshot captures credentialId
  A->>T: Dispatch IDs only (unchanged)
  T->>G: op=submit { organizationId, flowRunId, generationJobId, attemptKey }
  G->>DB: Load job, binding, requestPayload, credential row; authorize; begin-submission CAS
  G->>K: Decrypt(ciphertext, encryptionContext)
  G->>P: Authenticated provider request
  P-->>G: Output or provider job ID
  G->>DB: Record submission checkpoint
  G-->>T: Sanitized result { status, providerJobId, pollAfterMs }
  T->>T: Durable waits, retries, aggregation (unchanged)
  T->>G: op=poll / op=cancel / op=fetch-output / op=accounting-facts
  G->>P: Credential-bearing call
  G->>R: Stream authenticated output to generated-output object
  G-->>T: Sanitized result { storageKey, metadata }
  P-->>A: Webhook (unchanged, terminates at API)
```

### Component responsibilities

| Component          | Gains                                                                 | Explicitly must not                                             |
| ------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| Dashboard          | Managed-key entry/status UI in existing Secure Store settings          | Ever receive or display the stored plaintext                    |
| API (non-gateway)  | Credential CRUD (encrypt-only), admission capture of credential mode   | Invoke decrypt outside the gateway module; return plaintext on any endpoint |
| PostgreSQL         | `providerCredentials` ciphertext + metadata, audit rows                | Be treated as the security boundary                             |
| Gateway module (in `apps/api` for V1) | Decrypt-and-execute for five ops; egress allowlist; redaction | Own queues, retries, graph traversal, run aggregation |
| Trigger.dev        | Gateway client (IDs only); everything else unchanged                   | Receive key material or raw provider credentials in any form    |
| KMS                | KEK custody, per-decrypt authorization + audit                         | Be replaced by an env var                                       |

### Gateway topology: in-API module now, extractable service later (decided 2026-07-17)

The gateway ships as a **module inside `apps/api`**: a separate internal Hono
sub-app mounted at `/internal/provider-ops/*`, living in its own domain
directory, reusing `@talelabs/providers/server` and `@talelabs/storage`. No
extra deployable for V1.

This does not weaken the hard requirement — the boundary that matters is
"never inside Trigger.dev," and that is unchanged. What it costs, stated
honestly: the API deployment identity holds KMS `Decrypt`, so the custody
claim rests on the API's entire attack surface instead of a minimal dedicated
one. The claim language in this document remains truthful (it promises
"TaleLabs-controlled infrastructure," not a separate service).

Guardrails that make the in-API topology acceptable and keep later extraction
a pure deployment change:

1. **Token-only internal routes.** `/internal/provider-ops/*` authenticates
   exclusively with the gateway service token — never session or user auth —
   is excluded from the public OpenAPI document and generated SDK, and is
   rejected at public ingress where the hosting platform allows it.
2. **Module-level decrypt confinement.** Only
   `apps/api/src/domain/provider-gateway/` may import the `CredentialCipher`
   decrypt path; credential CRUD uses an encrypt-only surface. Enforce with a
   dependency gate the same way the providers package enforces its
   browser-bundle boundary. This is a code boundary, not an IAM boundary —
   the doc must never claim otherwise while in-API.
3. **Bounded resource policy.** Provider ops are long-lived (60 s request
   timeouts, media downloads up to 512 MB). Streams to R2 are never buffered
   in memory, `fetch-output` concurrency is capped code-owned, and gateway
   routes carry their own timeouts so they cannot starve interactive API
   latency.
4. **Environment and role rules unchanged.** The Trigger.dev environment
   gains only `PROVIDER_GATEWAY_URL` and `PROVIDER_GATEWAY_TOKEN`; KMS
   configuration never enters the root `.env`; the worker database role is
   still denied all credential tables.
5. **Extraction trigger.** Before any compliance/enterprise-grade custody
   claim — or when ops capacity allows — the same module deploys as its own
   service and KMS `Decrypt` moves exclusively to that identity. Schema,
   operation contract, and the Trigger-side client do not change.

## Key Custody Design

### Where keys live: PostgreSQL ciphertext + external KMS (recommended)

Store ciphertext in PostgreSQL; anchor decryption in a managed KMS invoked
only from the gateway module (V1: the API deployment identity, decrypt-gated
to the module; post-extraction: a dedicated gateway identity).

```txt
plaintext key
  -> encrypted under a KMS-held key (KEK), with authenticated context
  -> ciphertext + key metadata persisted in providerCredentials
  -> decrypt possible only by identities granted kms:Decrypt on that KEK
  -> V1: API deployment identity, confined by the module dependency gate
  -> extracted: only the standalone gateway identity holds that grant
```

Provider API keys are tiny (well under 4 KB), so V1 uses **direct KMS
encrypt/decrypt per operation** rather than envelope DEK caching:

- every decrypt is an authorized, individually audited KMS API call
  (CloudTrail/Cloud Audit Logs give a per-credential-access trail for free);
- no data-key caching or zeroing logic to get wrong;
- latency (single-digit to low-double-digit ms) is irrelevant next to
  provider request time;
- `EncryptionContext` (AWS) / AAD (GCP, Vault transit) cryptographically binds
  each ciphertext to `{ schemaVersion, organizationId, credentialId, provider,
  keyVersion }`, so a leaked DB row cannot be decrypted under another tenant's
  context and rows cannot be swapped between tenants. This mirrors the AAD
  design already shipped in the browser Secure Store.

Envelope encryption with cached data keys is a later optimization behind the
same interface if decrypt volume ever makes it worthwhile; nothing in the
schema below precludes it.

### Crypto-agility interface

All call sites use one narrow interface so the KMS binding is swappable and
testable:

```ts
interface CredentialCipher {
  /** Encrypts plaintext bound to immutable tenant context. */
  encrypt: (input: {
    plaintext: Uint8Array
    context: CredentialEncryptionContext
  }) => Promise<{ ciphertext: Uint8Array, keyId: string, algorithm: string }>
  /** Decrypts only when the stored context matches exactly. */
  decrypt: (input: {
    ciphertext: Uint8Array
    keyId: string
    algorithm: string
    context: CredentialEncryptionContext
  }) => Promise<Uint8Array>
}
```

Bindings:

```txt
production   -> managed KMS of the gateway's hosting platform
               (AWS KMS or GCP Cloud KMS; Vault/OpenBao transit or Infisical
                if the team prefers self-hosted — same interface)
development  -> local AES-256-GCM cipher keyed by a dev-only env value,
               clearly named, never accepted in production builds
tests        -> deterministic in-memory fake
```

The hosting platform for `apps/api` is an open product decision (see Open
Decisions); the KMS choice follows the hosting choice. The design does not
depend on which one is picked.

Rejected storage designs, for the record:

| Design                                   | Why rejected                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| `APP_SECRET`-encrypted DB column         | Static env key; reachable habits from shared `.env`; no per-op audit/authz      |
| Trigger.dev secret env vars              | Delivered to workers; project-wide, not per-tenant                              |
| Cloudflare Secrets Store / AI Gateway    | Third-party custody, no per-job authorization, protocol gaps (Option C)         |
| Plaintext column, "network is private"   | Not seriously considered                                                        |
| External vault server as V1 requirement  | OpenBao/Vault transit is fine but adds stateful infra now; adoptable later behind `CredentialCipher` |

### `providerCredentials` table

```txt
providerCredentials
  id                    text pk
  organizationId        text not null -> organization
  createdBy             text null -> user
  provider              text not null            -- 'openrouter'
  acquisition           text not null            -- 'manual' | 'oauth_pkce'
  ciphertext            bytea not null
  keyId                 text not null            -- KMS key identifier
  algorithm             text not null            -- cipher/version tag
  contextVersion        integer not null         -- AAD schema version
  keyFingerprint        text not null            -- HMAC-SHA-256 of plaintext under a
                                                 -- gateway-only pepper; duplicate detection,
                                                 -- never reversible
  lastFour              text not null            -- display only
  status                text not null            -- 'active' | 'revoked'
  lastUsedAt            timestamptz null
  lastVerifiedAt        timestamptz null
  createdAt / updatedAt / revokedAt
  unique (organizationId, provider) while status = 'active'
```

Rules:

- the API writes rows using an **encrypt-only** path (KMS `Encrypt` permission
  without `Decrypt`); replacing a key writes a new row and revokes the old one
  — ciphertext is never updated in place;
- key validation on save is performed by the gateway (`op=verify-credential`,
  a non-spending provider identity call such as OpenRouter `GET /api/v1/key`),
  so plaintext never needs to exist in the API after the encrypt call returns;
- revocation is immediate: the gateway re-reads credential status inside every
  operation, so a revoked key fails closed for in-flight runs with a stable
  `managed_byok_credential_revoked` error;
- deletion is revocation plus ciphertext erasure after terminal-run
  bookkeeping completes; KMS key deletion is never user-triggered.

### Access audit

```txt
providerCredentialAccessLog
  id, organizationId, credentialId, flowRunId, generationJobId
  operation      -- submit | poll | cancel | fetch-output | accounting | verify
  outcome        -- ok | denied | provider_error
  createdAt
```

Written only by the gateway. KMS audit logs remain the tamper-evident source;
this table exists so the product can eventually show users when their key was
used without granting anyone log-plane access.

## Hard Isolation Requirements

These are release blockers for the security claim, independent of feature
completeness:

1. **KMS decrypt identity.** Trigger.dev never holds any KMS permission, and
   no KMS configuration value ever appears in the Trigger.dev environment or
   in the root `.env` consumed by `trigger.config.ts`. V1 (in-API topology):
   the API deployment identity holds `Decrypt`, but the decrypt path is
   callable only from the gateway module, enforced by the dependency gate;
   credential CRUD uses an encrypt-only surface. On extraction, `Decrypt`
   moves exclusively to the standalone gateway identity.
2. **Split database roles.** Create a `worker` PostgreSQL role for Trigger.dev
   with no grant on `providerCredentials` or
   `providerCredentialAccessLog`. This converts "workers can read ciphertext"
   from a standing fact into a revoked one. The API role carries the gateway
   grants (SELECT on credentials plus the job/run tables its operations need)
   until extraction introduces a distinct `gateway` role.
3. **Environment hygiene.** Gateway secrets (KMS binding, service-token
   verification value) live only in the API deployment for V1 — never in the
   root `.env` — and move with the module on extraction. The Trigger.dev
   environment gains exactly two values:
   `PROVIDER_GATEWAY_URL` and `PROVIDER_GATEWAY_TOKEN` (a caller token that
   authorizes operation requests, grants no key access, and is rotatable
   without touching stored credentials).
4. **Egress allowlist.** The gateway makes outbound requests only to the exact
   provider origins in the captured binding (for OpenRouter:
   `https://openrouter.ai` plus verified output-download hosts) and to R2. Any
   other host — including one appearing in a provider response — is refused.
5. **Redaction.** Authorization headers, plaintext keys, prompts, request
   payloads, signed URLs, and output bytes never enter gateway logs, error
   messages, traces, or the access log. Error surfaces reuse the existing
   normalized provider error vocabulary. Plaintext lives only in a local
   variable scoped to the single provider call; JavaScript cannot guarantee
   memory zeroing and the design must not pretend otherwise.
6. **No plaintext egress endpoint.** The gateway exposes no operation that
   returns credential material, under any authentication.

## Gateway Contract

### Authentication and authorization

Two layers, both required:

1. **Transport auth:** static bearer service token (constant-time compare) or
   mTLS/private networking where the hosting platform allows. This only proves
   "a TaleLabs runtime is calling."
2. **State authorization (the real control):** every operation loads the job
   and run rows and verifies — organization matches, run is a managed BYOK
   run, snapshot captured this `credentialId`, job status makes the operation
   legal, and the submission CAS holds. The worker's request body contributes
   identifiers only; nothing it says is trusted.

### Operations

```txt
POST /internal/provider-ops/verify-credential   { organizationId, credentialId }
POST /internal/provider-ops/submit              { organizationId, flowRunId, generationJobId, attemptKey }
POST /internal/provider-ops/poll                { organizationId, flowRunId, generationJobId }
POST /internal/provider-ops/cancel              { organizationId, flowRunId, generationJobId }
POST /internal/provider-ops/fetch-output        { organizationId, flowRunId, generationJobId, outputIndex }
POST /internal/provider-ops/accounting-facts    { organizationId, flowRunId, generationJobId }
```

Behavior:

- **submit** performs the durable one-shot submission boundary itself:
  compare-and-set `begin submission` on the job row (same semantics as the
  existing browser `begin-submission` service), then loads
  `requestPayload`, materializes Asset inputs to short-lived signed URLs via
  `@talelabs/storage`, decrypts, executes through the existing
  `@talelabs/providers/server` adapter, records the submission checkpoint, and
  returns `{ status, providerJobId, pollAfterMs, facts }`. Replays of the same
  `attemptKey` return the recorded result instead of resubmitting; a lost
  in-flight submit leaves the job in the existing
  `provider_submission_uncertain` posture rather than double-spending.
- **poll / cancel** wrap the corresponding lifecycle operations for async
  bindings; Trigger.dev keeps owning when to poll (durable waits) — the
  gateway only performs the credential-bearing call when asked.
- **fetch-output** downloads the authenticated provider output and streams it
  directly to the canonical generated-output object in R2 (existing
  generated-storage key policy), returning `{ storageBucket, storageKey,
  mimeType, byteSize }`. Output bytes never transit Trigger.dev. Ingestion,
  thumbnails, metadata, and Asset registration continue in the existing
  Trigger pipeline reading from R2.
- **accounting-facts** replaces the in-worker credential-bearing cost
  reconciliation for BYOK jobs, returning normalized provider cost/generation
  facts for the existing reconciliation writer.
- every response is sanitized: normalized statuses, safe provider error codes,
  no headers, no raw provider payloads beyond the schema-validated fields the
  adapters already emit.

Stable error vocabulary (extends the existing run error space):

```txt
managed_byok_credential_missing
managed_byok_credential_revoked
managed_byok_credential_invalid
managed_byok_operation_not_ready
managed_byok_submission_uncertain
managed_byok_gateway_unavailable
```

`managed_byok_gateway_unavailable` is retryable by Trigger.dev's existing
backoff; credential errors are terminal for the job and surface actionable UI
copy. A gateway failure never falls back to the platform credential —
credential mode is captured at admission and is immutable for the run.

### What the gateway must never do

Unchanged from `provider-execution-modes.md`, restated as law: no queues, no
retries-as-policy (it executes one bounded operation per request), no graph
traversal, no run aggregation, no waitpoints, no source-of-truth state beyond
the submission checkpoint and access log, no credential retrieval API.

## Execution-Path Changes

### Run model

Managed BYOK is not a third execution runtime. It is the existing `managed`
runtime with a different credential source:

```ts
type ProviderCredentialMode = 'platform' | 'byok'
```

- `flowRuns.providerCredentialMode` (default `'platform'`) plus the captured
  `credentialId` in the immutable snapshot envelope;
- admission for `byok` fails closed with `managed_byok_credential_missing`
  unless the organization holds an active credential for every captured
  binding's provider;
- never inferred from credential presence, never silently switched, mirroring
  the browser-runtime rules.

### Trigger.dev integration

The seam is exactly where the codebase already put it. For BYOK jobs the
adapter registry receives, instead of the env-backed credential, a
**gateway-backed lifecycle client**: an implementation of the same provider
adapter/lifecycle contract whose submit/poll/cancel/fetch/accounting calls are
HTTP calls to the gateway with IDs. Orchestration code
(`generationJobProviderLifecycleOptions`, waits, checkpoints, error handling)
does not change shape. Platform-credential execution is byte-for-byte
untouched.

## Threat Model Summary

| Compromise                            | Exposure                                                                                 | Mitigations                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Trigger.dev (vendor or worker code)   | IDs, run metadata, gateway caller token. **No key material.**                             | Can only invoke ops on persisted, admitted jobs; CAS blocks resubmission; token rotation         |
| PostgreSQL dump / backup theft        | Ciphertext + metadata only                                                                | KMS-held KEK; encryption context binds rows to tenant identity; fingerprint is peppered HMAC     |
| API server (V1 in-API topology)       | **Primary key-exposure risk until extraction**: a code-execution compromise of the API process can reach the decrypt path and the plaintext of keys used while compromised | Module dependency gate limits accidental exposure (not a malicious-code boundary); per-decrypt KMS audit + anomaly alerting; incident runbook = revoke API KMS grant, rotate caller token, revoke affected credentials, notify; extraction restores the IAM split |
| Gateway module                        | Same as above while in-API; post-extraction, worst case shrinks to the standalone service's minimal surface | Token-only internal routes rejected at public ingress; egress allowlist; redaction; extraction trigger defined in the topology section |
| Gateway caller token leak             | Ability to drive admitted-job ops                                                          | State authorization caps blast radius to legitimate jobs; rotate token; rate limits per org      |
| Insider with DB access                | Ciphertext only; decrypt attempts hit KMS audit                                            | IAM separation, alerting on anomalous decrypt volume                                            |
| User account takeover                 | Same as today's product surface; key value itself still not retrievable                    | Existing auth controls; key is write-only in the product UI                                     |

Honest residual risk, per the modes doc: TaleLabs infrastructure *must* be able
to decrypt these keys to use them. The claim is strict custody and
runtime-boundary control, never "cryptographically impossible for TaleLabs."
User-side mitigations we actively enable: OAuth PKCE acquisition (revocable
upstream), and recommending provider-side spend limits on the submitted key.

## Security Claim

Shipped copy must match `provider-execution-modes.md`:

> Provider keys are encrypted in a dedicated secrets vault and decrypted only
> during execution inside TaleLabs-controlled infrastructure. They are never
> stored in plaintext, included in Trigger.dev payloads, or written to logs.

## UX Contract

Under **Providers → Secure Store**, alongside the existing browser key:

- managed key entry (write-only field), provider validation on save via
  `verify-credential`, stored-state display as `••••` + `lastFour` +
  `lastVerifiedAt`;
- explicit copy distinguishing the two BYOK modes: browser key never leaves
  this browser; managed key is encrypted on TaleLabs servers so runs continue
  when the browser is closed;
- replace and revoke actions; revoke warns about failing in-flight BYOK runs;
- OAuth PKCE "Connect OpenRouter" as the preferred acquisition path when
  implemented;
- no plaintext ever returned to the dashboard; no durability or
  "we can't read it" over-claims.

## Implementation Phases

### Phase 0 — Decisions and isolation groundwork

1. User decides the API hosting platform (fixes the KMS choice). Topology is
   already decided (2026-07-17): the gateway ships as an in-API module;
   extraction to its own service is a later hardening step.
2. Split PostgreSQL roles (`api`, `worker`) and move Trigger.dev to the
   `worker` role; a distinct `gateway` role arrives with extraction.
3. Remove the root-`.env` sharing habit for gateway-destined secrets; document
   the environment matrix.
4. Reconcile `provider-execution-modes.md` Mode 3 with this plan (IDs-only
   request shape; fetch-output-to-R2; accounting op).

Acceptance: worker role provably cannot select from a (placeholder)
credentials table; managed platform execution unchanged.

### Phase 1 — Credential vault

1. `providerCredentials` + access-log migrations.
2. `CredentialCipher` interface, production KMS binding, dev/test bindings.
3. API credential routes (store, replace, revoke, status) — encrypt-only.
4. Secure Store settings UI for the managed key.
5. Gateway module skeleton (internal sub-app, excluded from the public
   OpenAPI document and SDK) with `verify-credential` only, service-token
   auth, redaction, egress allowlist, and the decrypt-confinement dependency
   gate.

Acceptance: key can be stored, verified, replaced, revoked end-to-end; the
decrypt path is importable only from the gateway module (dependency gate
fails the build otherwise); no route outside `/internal/provider-ops/*` can
trigger a KMS decrypt; plaintext appears in no response, log, or trace
(grep-level audit + code review checklist).

### Phase 2 — Gateway execution operations

1. `submit` with begin-submission CAS, canonical request loading, Asset input
   materialization, adapter execution.
2. `poll`, `cancel`, `fetch-output` (streamed to R2), `accounting-facts`.
3. Idempotency/replay behavior and the stable error vocabulary.
4. Fake-provider verification: reuse
   `packages/trigger/scripts/openrouter-provider-verifier` patterns against
   the gateway so the full matrix runs without paid requests.

Acceptance: every operation is replay-safe, state-authorized, and covered by
fake-provider scenarios including duplicate submit, poll-after-terminal,
cancel races, oversized outputs, and revoked-credential mid-run.

### Phase 3 — Run integration

1. `providerCredentialMode` persistence, snapshot capture, admission
   validation (fail closed), run responses.
2. Gateway-backed lifecycle client in the Trigger adapter registry for BYOK
   jobs; platform path untouched.
3. Cost reconciliation via `accounting-facts` for BYOK jobs.
4. Run UI: credential-mode provenance and credential error states.

Acceptance: the existing debug-mode command matrix (all five run commands)
passes for `managed + byok` against the fake provider; managed platform
regression suite unchanged; no Trigger.dev payload, log, or env var contains
key material (verified by inspection of dashboard-visible data in a staging
project).

### Phase 4 — Security verification and rollout

1. Audit pass: logs, traces, error serialization, source maps, KMS/IAM
   policies, DB grants.
2. Kill switches: code-owned flag stopping new BYOK admissions; credential
   revocation drill; gateway token rotation drill.
3. Incident-response runbook for gateway compromise and provider-side abuse
   reports.
4. Claim language review; pricing/entitlement wiring per product policy
   (managed BYOK is a paid convenience per `provider-execution-modes.md`).
5. Optional fast-follow: OpenRouter OAuth PKCE acquisition.

Acceptance: user-owned QA of the full lifecycle with one real key and an
explicitly approved paid smoke test; rollback flag verified to preserve
in-flight run inspection/cancellation.

## Engineering Verification

Additions to the repository's standard gates (types, lint, i18n, TSDoc, SDK
generation, forced build):

```txt
credential cipher round-trip + context-mismatch rejection scenarios
decrypt-confinement gate (decrypt path importable only from the gateway module)
worker-role grant test (credentials tables unreadable)
gateway state-authorization matrix (wrong org, wrong run, wrong status, replay)
submission CAS race and uncertain-submission recovery scenarios
fake-provider lifecycle matrix for submit/poll/cancel/fetch-output/accounting
egress allowlist rejection scenarios
redaction audit (no secret-shaped values in any log fixture)
managed platform regression + trigger deploy dry run
```

No verification step makes a paid provider request without explicit user
approval.

## Open Decisions (user-owned)

1. **Hosting platform for `apps/api`** — determines the KMS binding (AWS
   KMS vs GCP Cloud KMS vs self-hosted OpenBao/Infisical transit). The design
   is identical across them; pick where the API will live.
2. **Extraction trigger** — topology is decided (in-API module for V1,
   2026-07-17); decide what event forces extraction to a standalone gateway
   service (compliance/enterprise custody claim, security review, or ops
   capacity).
3. **OAuth PKCE in V1 or fast-follow** for OpenRouter key acquisition.
4. **Pricing/entitlement** — modes doc positions managed BYOK as paid
   convenience; billing wiring is out of scope here and belongs to
   `docs/credits-planning.md` sequencing.
5. **Access-log user visibility** — store-only now versus a user-facing "key
   usage" panel later.

## References

Repository:

- `docs/provider-execution-modes.md` — trust-boundary contract this plan implements
- `docs/browser-execution-mode-execution-plan.md` — browser BYOK runtime and the begin-submission/idempotency precedents
- `packages/providers/src/openrouter/transport/` — injectable credential/fetch/baseUrl seams
- `packages/providers/src/server/credentials.ts` — current env-based platform credential
- `packages/db/src/schema.ts` — persisted `requestPayload`/`requestHash` and provider lifecycle columns
- `apps/api/src/domain/runs/dispatch.service.ts` — IDs-only Trigger dispatch

External (verified 2026-07-17):

- [Trigger.dev: environment variables](https://trigger.dev/docs/deploy-environment-variables) — secret env vars are dashboard-hidden but injected into workers; payloads are logged; "never pass secrets in the task payload"
- [Trigger.dev: self-hosting overview](https://trigger.dev/docs/self-hosting/overview)
- [OpenRouter: provisioning API keys](https://openrouter.ai/docs/features/provisioning-api-keys) — programmatic runtime keys with spend limits
- [OpenRouter: per-user keys with spending limits](https://openrouter.zendesk.com/hc/en-us/articles/51680687417499-Can-I-create-one-API-key-per-user-with-its-own-spending-limit-Management-API-keys)
- [OpenRouter: OAuth PKCE](https://openrouter.ai/docs/guides/overview/auth/oauth)
- [Cloudflare AI Gateway: BYOK](https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/) and [Secrets Store integration](https://developers.cloudflare.com/changelog/post/2025-08-25-secrets-store-ai-gateway/) — evaluated and not selected (Option C)
- [AWS KMS: encryption context](https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html#encrypt_context)
- [Google Cloud KMS: additional authenticated data](https://cloud.google.com/kms/docs/additional-authenticated-data)
- [OpenBao / Vault: transit secrets engine](https://openbao.org/docs/secrets/transit/)
