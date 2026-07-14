# TaleLabs — API Design v2

> **Active MVP override (2026-07-14):** the product API used by the dashboard is
> Assets + Flows. Standalone Element endpoints may remain dormant, but Elements
> are excluded from navigation, global search, Flow graph schemas, Flow
> reference hydration, run planning, and MVP acceptance. See
> `assets-flows-mvp-contract.md`.

Supersedes `api-design-planning.md` (deprecated). Companion to `db-design-planning-v2.md` — every endpoint here maps onto that schema and its contracts; nothing is invented API-side that the DB doc doesn't back.

Scope: the active base features in build order — **Assets → Folders → Flows
(graph sync) → provider-independent mock engine → controlled provider
integration**. M5 accepts node, downstream, upstream, selection, and full-flow
run modes against deterministic provider mocks. Deferred: Tools, Recipes,
credits enforcement (`/runs/estimate`, `402`), bulk operations, collaboration,
and Elements. Narrow Trigger.dev run-status realtime is part of M5; general
collaboration/realtime editing is deferred.

This is the **internal product API** consumed by the TaleLabs web app — not a public API. When a public surface ships, it gets its own versioned contract and auth scheme.

---

## Stack grounding (what the repo already decided)

- **Hono + `@hono/zod-openapi`**: every route declares Zod request/response schemas; the OpenAPI document and Swagger UI are generated from them. The shapes in this document are the source for those Zod schemas — contract-first, one place.
- **Better Auth** is mounted at `/api/auth/*` and owns sessions. All tenant resource routes (`/assets`, `/flows`, …) sit behind the repo's existing **`organizationMiddleware`** — it validates the session, requires an active organization (`403 active_organization_required`), and populates `organizationId`/`userId` for handlers. `authMiddleware + requireAuthMiddleware` alone is not enough: it does not resolve the active organization.
- Organization-scoped product routes share one API-level fixed-window limit of **600 requests per 60 seconds per organization**, mounted after `organizationMiddleware`. The MVP store is intentionally process-local and bounded; each replica has an independent allowance until the store is replaced with shared Redis before horizontal scaling.
- The error middleware already emits `apiError(code, message, details)` — this document's error contract is that helper, extended with the new codes below.
- Route modules follow the existing pattern: `src/routes/<area>/<area>.routes.ts` + `<area>.schemas.ts`, one `register<Area>Routes(app)` per area.

---

## Conventions

### Auth & tenancy

- Session cookie via Better Auth; unauthenticated → `401 unauthenticated`; authenticated but no active organization → `403 active_organization_required` (from `organizationMiddleware`).
- **Tenancy is implicit**: every request executes against the session's `activeOrganizationId`. Organization ids never appear in URLs or bodies. A resource in another org is indistinguishable from a missing one → `404`, never `403`. Cross-org ids _inside a body_ → `404` with `details` naming the field.
- The DB enforces referential tenant integrity (composite org FKs); the API layer owns authorization and the 404 discipline. A missed check can produce a wrong error, never a cross-tenant row.

### Wire format

- JSON, `camelCase` keys — identical to the DB identifiers (no mapping layer; see the DB doc's casing convention).
- Ids are cuid2 strings. Server-generated except **flow node/edge ids, which the client generates** (canvas creates them before any round trip); the server validates format and uniqueness.
- Timestamps: ISO 8601 UTC strings.
- PATCH semantics: absent field = unchanged; explicit `null` = clear.
- **Media access is exclusively server-issued signed URLs** (`url`, `thumbnailUrl`). All storage is private; URLs are short-lived and opaque — render, never persist, re-fetch when needed. Storage keys never leave the server.

### Lists & pagination

```ts
type ListResponse<T> = { data: T[]; nextCursor: string | null };
// ?limit=50 (default 50, max 200) &cursor=<opaque>
```

Cursors are opaque encodings of **`(sort, order, sortValue, id)`** — stable under ties, and self-describing: a cursor replayed with different `sort`/`order` params → `400 validation_error` (the encoded sort wins over nothing; mismatch is a client bug, not a guess). Sort semantics, defined once: `name` compares case-insensitively (`lower(name)`), and the cursor carries that exact PostgreSQL expression selected with the row rather than recomputing it in JavaScript; nullable sort keys (`sizeBytes`) order **nulls last in both directions**; `id` is always the final tiebreaker. Default sort `createdAt desc` unless stated.

### Errors

```ts
type ApiError = {
  error: {
    code: string;
    message: string; // safe to display
    details?: { field: string; message: string }[];
  };
};
```

| HTTP | code                                   | when                                                                         |
| ---- | -------------------------------------- | ---------------------------------------------------------------------------- |
| 400  | `validation_error`                     | malformed body/params (Zod `defaultHook`; `details` per field)               |
| 401  | `unauthenticated`                      | no/expired session                                                           |
| 403  | `active_organization_required`         | session valid but no active organization selected                            |
| 409  | `organization_context_changed`         | request expected a different active organization; retry from current context |
| 404  | `not_found`                            | missing resource **or** another org's resource                               |
| 409  | `conflict`                             | duplicate where uniqueness matters (idempotency key reuse, edge duplicates)  |
| 409  | `revision_conflict`                    | graph sync CAS lost — refetch graph and replay                               |
| 409  | `invalid_state`                        | canceling a finished run, restoring a purging asset, editing element type    |
| 409  | `element_master_role_capacity_reached` | a master attachment/promotion exceeds the registry role capacity             |
| 409  | `element_source_capacity_reached`      | a source attachment/demotion exceeds the Element-wide source cap             |
| 400  | `element_reference_metadata_invalid`   | relationship metadata fails the registry role's strict schema                |
| 400  | `element_source_primary_invalid`       | a request attempts to make a source relationship primary                     |
| 422  | `unsupported_by_model`                 | settings/inputs the selected model cannot accept                             |
| 429  | `rate_limited`                         | admission control (runs) or abuse limits; includes `Retry-After`             |
| 402  | `insufficient_credits`                 | **Phase 2 only** — documented so clients handle it from day one              |
| 500  | `internal_error`                       | unhandled failure (existing error middleware fallback)                       |

### Deletion semantics (mirrors the DB lifecycle: live → archived → purge requested → purged)

- `DELETE /assets/:id` **archives** (reversible). `POST /assets/:id/restore` un-archives — guarded: purge in flight → `409 invalid_state`.
- `POST /assets/:id/purge` is the explicit, confirmed permanent deletion — marks intent, dispatches the durable purge task, returns immediately; `purgedAt` is set only after storage destruction succeeds. Purged assets render as tombstones wherever referenced.
- Everything else: `DELETE` is hard; link rows cascade; assets always survive. Successful `DELETE`/detach → `204`.

---

## Endpoint index

| Area     | Endpoints                                                                                                                                                                                                                                                                                                       |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search   | `GET /search`                                                                                                                                                                                                                                                                                                   |
| Uploads  | `POST /uploads`                                                                                                                                                                                                                                                                                                 |
| Assets   | `GET /assets` · `POST /assets` · `POST /assets/move` · `GET /assets/:id` · `PATCH /assets/:id` · `DELETE /assets/:id` · `POST /assets/:id/restore` · `POST /assets/:id/purge` · `GET /assets/:id/usage` · `GET /assets/:id/download` · `PUT/DELETE /assets/:id/favorite` · `PUT/DELETE /assets/:id/tags/:tagId` |
| Folders  | `GET /folders` · `POST /folders` · `PATCH /folders/:id` · `DELETE /folders/:id`                                                                                                                                                                                                                                 |
| Tags     | `GET /tags` · `POST /tags` · `DELETE /tags/:id`                                                                                                                                                                                                                                                                 |
| Flows    | `GET /flows` · `POST /flows` · `GET /flows/:id` · `PATCH /flows/:id` · `DELETE /flows/:id` · `GET /flows/:id/graph` · `GET /flows/:id/references` · `POST /flows/:id/graph` · `GET /flows/:id/nodes/:nodeId/results`                                                                                            |
| Runs     | `POST /flows/:id/run-plans` · `POST /runs` · `GET /runs` · `GET /runs/:id` · `POST /runs/:id/cancel` · `POST /runs/:id/retry` · `POST /runs/:id/realtime-token`                                                                                                                                                         |
| Config   | `GET /config/generation`                                                                                                                                                                                                                                                                                        |

Dormant Element endpoints are documented in their deferred section for
preservation only. They are intentionally absent from this active MVP index.

---

## Shared resource shapes

```ts
type Folder = {
  id: string;
  parentId: string | null;
  name: string;
  itemCount: number;
  processingItemCount: number; // direct live Assets whose preview may still change
  totalSizeBytes: number; // includes descendant folders
  thumbnailUrls: string[];
  createdAt: string;
  updatedAt: string;
};

type MediaType = "image" | "video" | "audio";
type AssetType = MediaType | "document";
type AssetSource = "upload" | "generation";
type AssetLifecycle = "live" | "archived" | "purging" | "purged"; // derived from the timestamp trio

type Tag = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

// list-item shape — everything the library grid needs, nothing more
type Asset = {
  id: string;
  name: string;
  type: AssetType;
  source: AssetSource;
  mimeType: string;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  folderId: string | null;
  generationJobId: string | null;
  outputIndex: number | null;
  lifecycle: AssetLifecycle;
  processingState: "processing" | "ready" | "failed"; // ingestion, orthogonal to lifecycle
  processingError: string | null; // safe to display; set only when 'failed'
  favorite: boolean; // current user inside the active organization
  tags: Tag[]; // shared organization tags assigned to this Asset
  url: string | null; // signed, short-lived; null once purging/purged
  thumbnailUrl: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

// detail shape — render-complete for the asset panel
type AssetDetail = Asset & {
  metadata: Record<string, unknown>;
  elementLinks: {
    elementId: string;
    role: string;
    referenceKind: "source" | "master";
    referenceMetadata: Record<string, unknown>;
    isPrimary: boolean;
  }[];
  generation: GenerationProvenance | null; // null for uploads
  usedAsInputCount: number; // reverse provenance is unbounded — paginated at GET /assets/:id/usage
};

type GenerationProvenance = {
  jobId: string;
  runId: string;
  mediaType: MediaType;
  provider: string;
  model: string;
  settings: Record<string, unknown>;
  resolvedPrompt: string | null;
  creditCost: number | null;
  sources: JobSource[]; // ordered; the full connected-context snapshot
  inputs: { assetId: string; role: string; sortOrder: number }[]; // exact provider subset
  createdAt: string;
  completedAt: string | null;
};

type JobSource = {
  sortOrder: number;
  sourceType: "text" | "element" | "asset" | "nodeOutput";
  // Active M5 writes text/asset/nodeOutput. element is legacy provenance only.
  nodeId: string;
  elementId: string | null;
  assetId: string | null;
  resolvedText: string | null;
  snapshot: Record<string, unknown>; // frozen candidates/exclusions, display-only
};

type Element = {
  id: string;
  type: string; // registry key: 'character' | 'product' | ... — immutable after create
  name: string;
  assetFolderId: string | null;
  instructions: string | null;
  data: Record<string, unknown>; // shape defined by the registry schema for `type`
  schemaVersion: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type ElementReadiness = {
  state: "empty" | "usable" | "strong";
  missing: string[]; // stable localization/diagnostic IDs, never stored status
  recommendations: string[]; // stable localization/diagnostic IDs
};

type ElementListItem = Element & {
  hasProcessingReferences: boolean; // derived from eligible master links; drives bounded list polling
  previewThumbnailUrl: string | null;
  readiness: ElementReadiness;
};

type ElementDetail = Element & {
  assetCounts: Record<string, number>; // master-link counts by role
  readiness: ElementReadiness;
};

type ElementAssetLink = {
  assetId: string;
  role: string; // fixed registry role, or a validated custom role stored by an Other Element
  referenceKind: "source" | "master";
  referenceMetadata: Record<string, unknown>; // registry-validated link interpretation
  sortOrder: number;
  isPrimary: boolean;
  asset: Asset; // embedded — the element assets tab renders in one call
};

type Flow = {
  id: string;
  name: string;
  revision: number;
  viewport: { x: number; y: number; zoom: number };
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type FlowNode = {
  id: string; // client-generated cuid2
  type: string; // active registry: text/asset/generation/control node types
  positionX: number;
  positionY: number;
  assetId: string | null;
  data: Record<string, unknown>;
  schemaVersion: number;
};

type FlowEdge = {
  id: string; // client-generated cuid2
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle: string | null;
  targetHandle: string | null;
};

type InputSelection = { mode: "auto" } | { mode: "manual"; assetIds: string[] };

// Stored in generation-node data, keyed by the model input-slot ID. Edges remain
// the sole source of connection topology; this stores only consumer-owned choice.
type GenerationNodeData = {
  modelContractVersion: string;
  modelId: string;
  operationId: string; // derived compatibility/snapshot field, never a user mode
  prompt?: string; // preserved inline draft for dedicated Image/Video nodes
  settings: Record<string, unknown>;
  inputSelections: Record<string, InputSelection>;
};

type RunMode =
  | "node"
  | "downstream"
  | "upstream"
  | "selection"
  | "all"
  | "tool"; // Tool remains deferred
type RunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "partial"
  | "failed"
  | "canceled";
type JobStatus = "pending" | "running" | "succeeded" | "failed" | "canceled";

type FlowRun = {
  id: string;
  flowId: string | null;
  mode: RunMode;
  targetNodeId: string | null;
  status: RunStatus;
  creditCost: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  nodes: FlowRunNodeState[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

type FlowRunNodeState = {
  nodeId: string;
  status:
    | "pending"
    | "running"
    | "succeeded"
    | "failed"
    | "skipped"
    | "canceled";
  job: RunJob | null; // filled once the node's job exists
};

type RunJob = {
  id: string;
  mediaType: MediaType;
  status: JobStatus;
  provider: string;
  model: string;
  errorCode: string | null;
  errorMessage: string | null;
  outputs: Asset[]; // [] until succeeded — poll GET /runs/:id and render from here
  createdAt: string;
  completedAt: string | null;
};
```

---

## Global search

### `GET /search`

Compact organization-scoped search for command palettes and other cross-resource
navigation. This endpoint never returns original media URLs, tags, provenance, or
full Folder/Asset records.

Query:

```txt
?q=<2..100 characters>&type=asset&type=folder&limit=5
```

`type` is repeatable and defaults to both resource types. `limit` applies per
resource type, defaults to 5, and has a hard maximum of 10.

Response `200`:

```ts
{
  assets: {
    id: string;
    name: string;
    type: AssetType;
    thumbnailUrl: string | null;
  }
  [];
  folders: {
    id: string;
    name: string;
    path: string;
  }
  [];
}
```

Every database query includes the active `organizationId`. Searches run with a
bounded PostgreSQL statement timeout and use the lower-name trigram indexes from
the database design. Search uses the same centralized organization-scoped API
limit as the other product routes; it has no route-specific limiter.

---

## Uploads

Two-step presigned flow; the API never proxies bytes. Always the private bucket.

### `POST /uploads`

Request:

```ts
{
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksum: {
    algorithm: "sha256" | "md5"; // which algorithms the server accepts is settled by
    value: string; //               the R2 spike; the shape doesn't change either way.
  } //                             (MD5 is not derivable from SHA-256 — the client
} //                                must send the value the server will sign.)
```

Validated against the mime allow-list and per-type size caps → `400`. The
non-sensitive MIME/type/size policy lives in the shared `@talelabs/assets`
registry so the dashboard can reject unsupported or oversized files before
hashing. Client validation is an early UX guard; this API validation remains
authoritative.

**Two independent guards make the stored object immutable-in-practice.** The presigned PUT URL stays valid until it expires — without protection, a client could upload, register (passing the `HEAD` check), then re-PUT different bytes to the same key, leaving DB metadata describing a file that no longer exists.

1. **Create-only PUT**: the presigned URL signs **`If-None-Match: *`** (R2-supported) — the object can be written once; any re-PUT fails with `412` regardless of bytes. This alone closes the overwrite hole.
2. **Content binding**: the grant carries the declared `checksum`, and registration verifies the stored object against it. **R2 caveat, validate before implementation**: R2's S3-compatibility matrix does not support full-object SHA-256 checksums on PUT the way AWS does (it documents `Content-MD5` and `If-None-Match` for `PutObject`) — spike `PutObjectCommand + ChecksumSHA256 + HeadObject` against real R2; if unsupported, bind `Content-MD5` into the signature instead and verify the single-part `ETag` (= MD5) at registration. The contract is "content is cryptographically bound to the grant"; the exact header is an implementation detail the spike settles.

Either guard suffices against overwrite; both together also catch a corrupted first upload. This is content integrity — distinct from the registration-body idempotency semantics below.

Response `201`:

```ts
{
  uploadUrl: string; // presigned PUT, short-lived
  uploadId: string; // signed grant token: binds org, user, object key (uploads/{grantId}),
  // mime, size, expiry. Pass to POST /assets. Server holds no grant state.
}
```

### `POST /assets` — register an uploaded object

The Element-related request members below are retained compatibility fields for
the dormant standalone Element API. Active Asset, Flow, M5, and M6 clients omit
them; no run or graph behavior may depend on them.

Request:

```ts
{
  uploadId: string
  name?: string      // defaults to original filename
  folderId?: string
  elementId?: string // convenience: also attach to an element on registration
  role?: string      //   requires elementId; validated against fixed or stored custom roles
  referenceKind?: "source" | "master" // defaults to master; requires elementId + role
  referenceMetadata?: Record<string, unknown> // defaults to {}; requires elementId + role
  sortOrder?: number //   optional link position; requires elementId + role
  isPrimary?: boolean //  optional role preview priority; requires elementId + role
}
```

Order of operations: verify grant signature + expiry → `HEAD` the object, confirm existence and that actual size/content-type/**checksum** match the grant → derive `type` from verified mime → validate relationship kind/metadata and acquire the same source/master capacity locks used by the Element subresource → insert the Asset **and the optional Element link in one transaction**. When the link is a master, affected persisted-Flow reference budgets are validated before commit. A capacity, metadata, tenancy, or budget failure rolls back both rows, so a crash or rejection cannot produce an attached-but-unregistered or registered-but-unattached half-state.

When `elementId` is present, the Element's stored `assetFolderId` is authoritative and the request's `folderId` is only a client hint. The transaction places the newly uploaded Asset in that folder; if the association was cleared because the folder was deleted, it provisions a new collision-safe child under the workspace's internally identified Elements root and updates the Element first. Linking an existing Asset through the Element reference endpoint never moves or copies that Asset.

The dashboard's global Zustand upload queue uses the atomic path for fresh
Element uploads: it sends `elementId`, `role`, order, and primary intent in this
`POST /assets` request and relies on the server's `master`/`{}` defaults. The
local `registering` and `linking` labels do not represent two server commits. The
queue retains the upload grant and returned Asset ID only as recovery
checkpoints. A lost-response retry can replay the grant and reconcile the
expected link without uploading bytes or registering another Asset. Supplying
`elementId` without `role` remains
available for folder-only registration and backward-compatible recovery, but it
is not the normal Element creation path.

**Ingestion is durable, not fire-and-forget.** Uploads register as `processingState: 'processing'`; a Trigger.dev task (an explicitly global `idempotencyKey` derived from `assetId` for both initial dispatch and reconciliation) probes dimensions/duration, generates the thumbnail, fills `metadata`, and flips to `'ready'` — or to `'failed'` with a safe `processingError` for invalid/corrupt media. A reconciliation sweep redispatches assets stuck in `'processing'` (same pattern as job dispatch and purge — the crash window between insert and trigger is covered, nothing sits with null metadata forever). Generation outputs skip all of this: the generate task already probed and uploaded them, so they insert directly as `'ready'`.

**Ingestion respects the purge lifecycle**: the sweep excludes purge-requested assets (the partial index encodes it), and the task's completing update is guarded with `"purgeRequestedAt" is null` — zero rows means purge won the race, and the task deletes whatever artifacts it just created instead of resurrecting them after the purge task finishes.

**Thumbnails use the deterministic key `thumbnails/{assetId}`**, and the purge task deletes that key **unconditionally** — whether or not `thumbnailKey` was ever persisted. This closes the crash window where ingestion uploads a thumbnail and dies before the DB write: no orphan can outlive its asset's purge, with zero extra bookkeeping.

Registration is **idempotent per grant** (`uploadId` unique index), and replay
returns the original canonical Asset with `200`; it never creates a second Asset
or reapplies name/folder decoration. When the replay includes `elementId` and
`role`, the service also treats it as a recovery checkpoint: it accepts an
already-present link of the expected kind or creates a missing link through the
same centralized capacity, metadata, lock, and Flow-budget policy. An existing
link whose kind no longer matches the replay fails with `409 invalid_state`
instead of silently changing curation state. Replay does not promise to rewrite
metadata/order/primary on an already-present compatible link; intentional
changes use the Element link `PATCH` endpoint.

Concurrent registrations for the same grant converge on that same checkpoint:
the unique-index loser returns replay success only after its requested compatible
Element link already exists or has been reconciled through the centralized link
policy.

Response: `201` → `Asset` (`200` on replay). Grant invalid/expired/object missing → `400`. Registration that also links to an Element may return
`409 element_master_role_capacity_reached`,
`409 element_source_capacity_reached`,
`400 element_reference_metadata_invalid`, or
`400 element_source_primary_invalid` under the same policy as the Element
subresource.

---

## Assets

**One canonical listing endpoint.** The global library, the canvas asset picker, and the reference selector are all `GET /assets` + filters — no per-surface variants. The one deliberate companion is `GET /elements/:id/assets`, which serves a different concern: **reference management** (role, source/master kind, relationship metadata, order, and primary state — link metadata, not asset browsing). Picker and filter use cases stay here; managing an Element's references uses the subresource.

### `GET /assets`

| param       | type                                 | notes                                          |
| ----------- | ------------------------------------ | ---------------------------------------------- |
| `type`      | `AssetType` (repeatable)             | `?type=image&type=video`                       |
| `source`    | `AssetSource`                        |                                                |
| `folderId`  | string \| `'root'`                   | `'root'` = no folder                           |
| `elementId` | string                               | via `elementAssets`; combine with `role`       |
| `role`      | string                               | only with `elementId`                          |
| `favorite`  | boolean                              | current user's favorites only                  |
| `tagId`     | string (repeatable)                  | any selected tag                               |
| `search`    | string                               | `ilike` on name (pg_trgm later; same contract) |
| `archived`  | boolean                              | default `false`; `true` lists archived only    |
| `sort`      | `createdAt` \| `name` \| `sizeBytes` | default `createdAt`                            |
| `order`     | `asc` \| `desc`                      | default `desc`                                 |

Purging/purged assets never appear in listings. Response: `200 ListResponse<Asset>`.

### `GET /assets/:id`

Response: `200 AssetDetail` — render-complete for the panel: media, element links, full generation provenance (sources + exact inputs), and the reverse-usage _count_. The unbounded reverse-usage list itself is paginated at `GET /assets/:id/usage`. Tombstones (`lifecycle: 'purged'`) still return metadata + provenance with `url: null`.

### `PATCH /assets/:id`

```ts
{ name?: string; folderId?: string | null }
```

Response: `200 Asset`.

### `POST /assets/move`

```ts
{ assetIds: string[]; folderId: string | null }
```

Moves up to 100 unique Assets in one organization-scoped transaction. The
server locks and validates the complete selection and destination before any
row changes, so the operation either moves every Asset or none. Response:
`200 { data: Asset[] }` in request order.

### `DELETE /assets/:id` → archive, `204`.

### `POST /assets/:id/restore`

Guarded: `purgeRequestedAt` set → `409 invalid_state` ("permanent deletion in progress"). Response: `200 Asset`.

### `POST /assets/:id/purge` — permanent deletion

Requires the client to have shown explicit confirmation (the endpoint exists so the destructive path is a distinct, auditable call — never an overload of DELETE). Marks intent (archiving if still live), dispatches the durable purge task with an explicitly global `idempotencyKey` derived from `assetId`, and returns without waiting for storage deletion. Reconciliation uses the same scope and key.

**Purge must not destroy media an active generation still needs.** Purge and run creation coordinate through row locks with a fixed ordering (asset row first, always):

- Purge: `select … for update` the asset row, then check `generationJobInputs` joined to jobs in `('pending','running')` — referenced by an active job → `409 invalid_state` ("asset is in use by a running generation"), nothing marked.
- Run creation: locks its selected input asset rows (same order: by asset id) inside the creation transaction and applies the full input rule from the Runs section — `purging`/`purged` → `404` on the field; `processing`/`failed` → `409 invalid_state`. Only `ready` assets reach a provider.

Because both paths take the same lock in the same order, the race has exactly two
serializable outcomes: the run sees a purging asset and rejects, or the purge
sees an active job and rejects. M5 admission snapshots and locks every static
Asset needed by the selected subgraph before any of the five modes is accepted;
same-run dynamic outputs are protected by their producing jobs and canonical
Asset completion transaction.

Response: `202` → `Asset` (`lifecycle: 'purging'`). Already purging/purged → `200`, idempotent.

### `GET /assets/:id/usage`

Reverse provenance, paginated — the runs that consumed this asset as a provider input.

Response: `200 ListResponse<{ jobId: string; runId: string; role: string; createdAt: string }>`.

### `GET /assets/:id/download`

Response: `200 { url: string }` — signed URL with attachment disposition. Purging/purged → `404`.

### Favorites and tags

Favorites are idempotent and scoped to the current user inside the active organization:

```txt
PUT    /assets/:id/favorite             -> 204
DELETE /assets/:id/favorite             -> 204
```

Tags are shared organization vocabulary. Creation returns an existing normalized-name match when one already exists; deleting a tag removes its assignments but never deletes Assets:

```txt
GET    /tags                             -> 200 { data: Tag[] }
POST   /tags { name }                    -> 201 Tag
DELETE /tags/:id                         -> 204
PUT    /assets/:id/tags/:tagId           -> 204
DELETE /assets/:id/tags/:tagId           -> 204
```

Favorite and tag assignment endpoints accept live and archived Assets. Purging or purged Assets reject mutation with `409 invalid_state`. Cross-organization Asset identifiers return `404`; assigning a cross-organization Tag also returns `404`. Removing a tag assignment is idempotent, so an unknown or already-unassigned `tagId` returns `204` without revealing whether that Tag exists elsewhere.

---

## Folders

Small org-scoped tree; full list, client assembles.

```
GET    /folders                          -> 200 { data: Folder[] }   (no pagination)
POST   /folders { name, parentId? }      -> 201 Folder
PATCH  /folders/:id { name?, parentId? } -> 200 Folder   (parentId: null = move to root)
DELETE /folders/:id                      -> 204
```

- Move validation runs the recursive-CTE ancestor walk **inside the write transaction**; a cycle → `400 validation_error`.
- **Operational bounds that keep the MVP's full list, no-pagination response honest:** at most **500 folders per organization** (checked on create) and **32 levels of depth** (checked on create/move by the same ancestor CTE that already guards cycles — no extra query). Exceeding either → `400 validation_error`. Supporting larger trees requires paginated or folder-scoped metadata before raising this cap.
- Delete semantics (mirrors FKs): subfolders cascade; contained assets drop to no-folder, never deleted.

---

## Deferred Elements (not part of the active MVP)

These endpoints document the dormant experiment and may remain implemented for
future reconsideration. The dashboard, global search, Flow graph, run planner,
M5 acceptance, and M6 provider integration must not depend on them.

### `GET /elements`

Query: `?type=&search=&limit=&cursor=` — sorted `updatedAt desc`.

Response: `200 ListResponse<ElementListItem>` — preview = a usable master from the type's registry-designated preview role, with primary/role/order/Asset-ID fallback. Types with validated custom roles use the same deterministic master selection from their custom role set. `readiness` and `hasProcessingReferences` are derived in a batched master-link query; neither is persisted. The dashboard polls a mounted list only while a currently loaded page reports pending master references, so background ingestion completion refreshes previews/readiness without permanent list polling.

### `POST /elements`

```ts
{
  type: string // must exist in the registry
  name: string
  instructions?: string
  data?: Record<string, unknown> // validated by the registry's Zod schema for `type`
}
```

Response: `201 CreatedElement`, which is the full Element representation with a required `assetFolderId: string`. Unknown type or `data` failing the type schema → `400` with field details. The server stamps `schemaVersion` from the current registry.

Creation lazily creates or reuses the internally identified workspace Elements root, creates a non-conflicting child folder from the Element name, and stores its ID as `assetFolderId` in the same transaction as the Element. Two Elements may share a name; their folder names receive deterministic numeric suffixes. Renaming an Element does not rename its folder.

The generic API never trusts dashboard form validation: it selects the registered current Zod schema from `type`, validates the complete `data` payload independently, and persists only the parsed JSONB representation. Dashboard localization and dedicated React form layout are not part of this contract.

### `GET /elements/:id`

Response: `200 ElementDetail` — `assetCounts` contains master-link counts per role so the current References UI does not count hidden sources. `readiness` derives from current usable masters and registry rules; missing/recommendation values are stable localization IDs rather than stored English copy.

### `PATCH /elements/:id`

```ts
{ name?: string; instructions?: string | null; data?: Record<string, unknown> }
```

`type` is **immutable** — its presence in a PATCH body → `409 invalid_state` (the product action for "wrong type" is creating a new element). `data`, when present, is full-replacement and re-validated; the server re-stamps `schemaVersion`.

Response: `200 Element`.

### `DELETE /elements/:id` → `204`

Kit links cascade; Assets and the associated folder survive. Active Flow nodes
cannot reference Elements. Historical provenance rows, if any, retain their
snapshot-compatible nullable Element identifier.

### Element assets — the kit subresource

```
GET    /elements/:id/assets?role=&referenceKind=       -> 200 ListResponse<ElementAssetLink>
POST   /elements/:id/assets                            -> 201 ElementAssetLink
PATCH  /elements/:id/assets/:assetId                   -> 200 ElementAssetLink
DELETE /elements/:id/assets/:assetId?role=<role>       -> 204
```

`POST` body:

```ts
{
  assetId: string;
  role: string;
  referenceKind?: "source" | "master"; // defaults to master
  referenceMetadata?: Record<string, unknown>; // defaults to {}
  sortOrder?: number;
  isPrimary?: boolean;
}
```

`PATCH` body:

```ts
{
  role: string; // identifies the current link in the element+asset+role PK
  targetRole?: string; // moves the link to another validated role atomically
  referenceKind?: "source" | "master";
  referenceMetadata?: Record<string, unknown>;
  sortOrder?: number;
  isPrimary?: boolean;
}
```

Omitted mutable fields preserve their current values. Ordering is normalized
independently within `(organizationId, elementId, role, referenceKind)`; a
role/kind change removes the old sequence gap and inserts at the requested
destination order or at the end. Demoting a primary master clears primary in the
same transaction. Promoting to master validates destination capacity and every
affected persisted Flow budget before commit.

Validation: role must exist in the registry for this Element's type or in the validated custom-role list stored by an `other` Element; relationship metadata must match the registry-owned strict schema; the Asset's media type must be accepted by that role (`voice` → audio only, `other` custom roles → image/video/audio); same-org (else `404`). Every current role accepts the same bounded common shape — optional `view`, `framing`, `background`, and `variant` fields — through its registry-owned schema. Unknown keys and invalid enum values are rejected. Omitted kind/metadata preserve current behavior as `master`/`{}`.

Capacity has two independent policies. Master capacity is enforced per role: by default an image role accepts up to eight masters, while a video or audio role accepts one. Sources use one bounded Element-wide abuse cap. These are reusable-context limits rather than provider/model input limits; Flow consumers select a compatible subset of masters at execution time. Existing-Asset attachment, upload registration, link updates, detach, and future generated-Asset attachment use one centralized transactional policy. The global lock order is organization Flow-reference budget, folder structure when an Element upload may provision a folder, Element, role, then an existing Asset row when attaching or updating it. A mutation acquires only the locks it needs: source-cap mutations lock the Element; master-cap mutations lock the role and first take the organization budget lock when they can increase executable references; promotion takes budget, Element, destination-role, and Asset locks. Existing-Asset attachment and updates read tenant-scoped lifecycle state with `FOR UPDATE` and reject purging or purged Assets after any concurrent purge wait. Upload registration takes the folder lock in its fixed position and keeps Asset insertion, link insertion, budget validation, and rollback atomic; its new Asset row does not exist to lock before insertion. Folder-tree deletion resolves the subtree after taking the folder lock and explicitly locks associated Elements before Assets so foreign-key cleanup follows the same order. Exceeding a limit returns `element_source_capacity_reached` or `element_master_role_capacity_reached`; invalid strict metadata returns `element_reference_metadata_invalid`. A source can never be primary in application policy or PostgreSQL, and an attempt returns `element_source_primary_invalid`. Setting a master `isPrimary: true` atomically clears the previous primary for that role. Duplicate (asset, role) pair → `409 conflict`. Detach never deletes the Asset.

### `GET /elements/:id/usage` — "where is this used?"

Response `200`:

```ts
type ElementUsageFlow = { flowId: string; flowName: string; nodeCount: number };

type ElementUsage = {
  flowCount: number; // the truth — unbounded, so the list below is a bounded preview
  flows: ElementUsageFlow[]; // 20 most recently updated flows using this element
  runCount: number;
  lastUsedAt: string | null;
};
```

If a full paginated usage browser ever proves necessary, it becomes `GET /elements/:id/usage/flows` with the standard `ListResponse` — additive, not a reshape.

### Server-only Element context contract (dormant)

The dormant implementation retains an internal
`buildElementContext(elementId)` service. It is not a public endpoint, is not
called by M5/M6, and does not return browser presentation URLs:

```ts
type BuiltElementContext = {
  elementId: string;
  type: string;
  schemaVersion: number;
  text: string;
  assets: {
    assetId: string;
    role: string;
    sortOrder: number;
    isPrimary: boolean;
    referenceMetadata: Record<string, unknown>;
    mediaType: "image" | "video" | "audio";
    mimeType: string;
  }[];
};
```

The retained service validates and sequentially upcasts stored Element
identity/data, resolves same-organization master links in deterministic
primary/role/order/ID order, and excludes sources plus non-ready or non-readable
Assets. The result contains stable IDs and relationship metadata only: never R2
storage keys and never signed URLs. No active Flow node carries this reference,
and M5 admission resolves only direct Assets, Text, and eligible node outputs.

The authoritative context, preview, budget, graph-validation, and hydration
queries predicate the Element, relationship, and Asset joins by the active
`organizationId` as well as IDs. They never load a broad link set and filter
tenancy or `referenceKind` afterward. A cross-organization identifier behaves as
missing. Context, readiness, and Element-link presentation revalidate stored
role/metadata and fail closed; Flow hydration does not interpret or return
relationship metadata in M4.5 and relies on the centralized validated write
boundary while still enforcing organization, master-kind, and Asset-usability
filters itself. This paragraph describes the dormant implementation only; it is
not an active Flow hydration contract.

---

## Flows

### CRUD

```
GET    /flows?search=&limit=&cursor=  -> 200 ListResponse<Flow>   (sorted updatedAt desc)
POST   /flows { name }                -> 201 Flow                 (revision 0, empty graph)
GET    /flows/:id                     -> 200 Flow                 (meta only — graph is separate)
PATCH  /flows/:id { name?, viewport? }-> 200 Flow                 (viewport saves do not bump revision)
DELETE /flows/:id                     -> 204                      (graph cascades; runs/jobs history survives)
```

### `GET /flows/:id/graph` — open the canvas

Response `200`:

```ts
{
  revision: number
  nodes: FlowNode[]
  edges: FlowEdge[]
  activeRuns: {
    runId: string
    nodeId: string
    nodeStatus: FlowRunNodeState['status']
    jobStatus: JobStatus | null // null: run-node planned, job not yet created (JIT)
  }[] // live badges — shape already covers multi-node runs, where pending/skipped nodes have no job
}
```

Three indexed reads; everything the canvas needs to mount.

### `GET /flows/:id/references` — hydrate the canvas references

Response `200`:

```ts
{
  assets: FlowReferenceAsset[]
}
```

This is the batched hydration contract for direct Asset nodes present in the
Flow graph. It is scoped to the active organization and returns
`404 not_found` both for a missing Flow and for a Flow owned by another
organization. Every referenced canonical Asset is returned once.

Asset records include their current lifecycle and processing state. Initial
hydration returns metadata and signed thumbnails, but leaves original media URLs
null. The editor resolves an original URL from the tenant-scoped Asset detail
endpoint only when playback or another explicit media action needs it. Storage
keys are never exposed. Responses are bounded to 5,000 unique Assets; exceeding
the limit fails explicitly instead of returning a silent partial graph. Graph
sync enforces the same final-state budget under an organization-scoped
transaction lock, so a successfully saved Flow remains eligible for complete
hydration. Because Asset metadata, thumbnails, and processing state can change
independently of graph topology, clients invalidate the organization-scoped
reference cache after relevant Asset mutations. Mounted canvases refetch invalidated references
immediately and retain periodic refresh only for thumbnail renewal and
asynchronous processing transitions. A post-MVP scaling follow-up replaces the
fixed ready-reference refresh with URL-expiration metadata and refreshes close to
expiry, or serves private media through stable authenticated Worker URLs.

### `POST /flows/:id/graph` — the autosave sync (the contract that matters most)

The client is authoritative for graph _shape_ between syncs; the server is authoritative for _ordering_ via compare-and-swap on `revision`. Each debounce tick sends one batched mutation:

```ts
{
  baseRevision: number          // the revision this change set was computed against
  upsertNodes?: FlowNode[]      // insert-or-update by id (client-generated cuid2)
  deleteNodeIds?: string[]      // edges cascade server-side, matching canvas behavior
  upsertEdges?: FlowEdge[]
  deleteEdgeIds?: string[]
}
```

One transaction: `update flows set revision = revision + 1 where id = $1 and revision = $baseRevision` → zero rows → **`409 revision_conflict`**, nothing applied; client refetches `GET /graph` and replays its local changes. Otherwise apply upserts/deletes, touch `updatedAt`, commit.

**Limits, checked before final-state validation** (no request — or accumulation of requests — may buy unbounded memory or DB work):

- per request: at most **500 mutations** (upserts + deletes combined), node `data` at most **32 KB** each, HTTP body capped at **2 MB** (enforced at the server, not just assumed from the platform)
- per flow, enforced against the batch's _final state_: at most **2,000 nodes**, **5,000 edges**, **8 MB of node-`data` bytes**, and **5,000 unique referenced Assets**. The reference budget is shared with hydration. Aggregate node bytes are recomputed inside the sync transaction (`sum(octet_length("data"::text))`) with no counter column to drift. Node `data` is the only unbounded node field; nodes' fixed columns and edges are already bounded by the count caps. These limits bound `GET /graph`, complete reference hydration, and later `graphSnapshot` copies.

Exceeding any → `400 validation_error` naming the limit. A debounced canvas never approaches these; hitting them signals a client bug or abuse.

Response `200 { revision: number }`.

Validation (`400` unless noted): node/edge ids must be well-formed cuid2; node `type` must exist in the active registry and `data` must pass its schema (server re-stamps `schemaVersion`); `assetId` must resolve in-org (`404` + field); edges must connect nodes of this flow (DB composite FK backs it); duplicate edge (same endpoints + handles) → `409 conflict`. There is **no whole-graph replacement endpoint** — replacement is expressible as upserts + deletes, and the batched form keeps writes proportional to what changed.

**Connection semantics are registry-validated, not just referential.** The node registry declares, per node type, its handles (ids, the media/data types each accepts or emits, cardinality) and its payload requirements (an `asset` node must carry `assetId`). Graph sync rejects — evaluated against the batch's _final_ state — edges into unknown handles, incompatible connections (an audio output into an image-only input), cardinality overflow, and type-payload violations. The boundary is deliberate: **incomplete is valid** (a half-built canvas with unconnected required inputs saves fine — that's normal editing), only _contradictory_ graphs are rejected; full executability is checked at run time, where the model's capabilities are known.

For Image, Video, and LLM generation, the server runs the matching shared adaptive
resolver against the final graph, node settings, selected item counts, and
inline prompt or instructions. It rejects invalid input combinations and a stored `operationId`
that differs from the rederived operation. `operationId` is therefore a derived
compatibility and snapshot field, not a user-selected API setting. Image schema
version 6, Video schema version 3, and LLM schema version 1 add the preserved
inline `prompt`; LLM also preserves inline `instructions`. A
connected Text edge to the semantic `prompt` handle is authoritative and is
never implicitly concatenated with it. An explicit Image contract upgrade
atomically rewrites a compatible legacy `references` edge to
`imageReferences`; historical contracts are not mutated.

Direct Asset nodes and same-run upstream outputs supply ordered candidates to the
consuming slot. Input-slot maxima apply across every connected source. The
planner rejects stale, unavailable, incompatible, singular-slot overflow, and
model-limit overflow; it never silently truncates or replaces inputs. Selection
policy for an upstream collection is persisted on the consumer and resolved
inside the immutable run plan, never as future Asset IDs in the draft graph.

### `GET /flows/:id/nodes/:nodeId/results` — node run history

Response: `200 ListResponse<RunJob & { runId: string }>` — newest first, outputs embedded. This is the derived node-result display (results are never stored in node `data`) and the picker for pinning a specific output. Backed by `generationJobsNodeHistoryIdx`.

---

## Runs

The execution surface. One spine: every execution is a run. M5 accepts `node`,
`downstream`, `upstream`, `selection`, and `all` against the same durable
mock-provider engine. `tool` remains unavailable until the versioned Tool
product ships.

### `POST /flows/:id/run-plans` - preflight a canvas command

Request:

```ts
{
  expectedFlowRevision: number;
  command:
    | { mode: "node" | "downstream" | "upstream"; targetNodeId: string }
    | { mode: "selection"; selectedNodeIds: string[] }
    | { mode: "all" };
}
```

The dashboard flushes pending autosave before calling this endpoint. The server
loads and validates that saved revision, then returns a canonical `planHash`,
captured revision, selected/planned executable counts, work-item/job/output
counts, and the inclusion reason for every executable node. It inserts nothing.
The client may immediately admit an obvious one-node plan; it discloses scope
before admission when dependency expansion or multiplicity is larger than the
visible command.

Preflight is advisory, never trusted input. `POST /runs` repeats planning and
requires the same revision and, when supplied, the same plan hash.

### `POST /runs` — execute a node, branch, selection, or Flow

**Admission control comes before credits exist.** Idempotency prevents _duplicate_ runs, not _many_ runs — different keys create unlimited executions, and Trigger.dev concurrency only queues them; every admitted job eventually spends provider money.

The contract, in order and race-safe:

1. **Fast-path replay check** (lock-free): an existing `(organizationId, idempotencyKey)` match returns the original run immediately — a retry must never be counted or rejected as new demand.
2. **`select pg_advisory_xact_lock(hashtext(organizationId))` is the transaction's FIRST statement.** Everything below happens under the lock, which is held until commit (that's what `_xact_` means — run creation is deliberately serialized per organization; acceptable at MVP scale, and the scalable replacement later is an atomic admission-reservation step, i.e. exactly what credit reservation becomes).
3. **Idempotency recheck under the lock** — the authoritative one; the fast path can race.
4. **Active-runs-per-organization cap**: count of runs in `pending`/`running` (served by the partial `flowRunsOrgActiveIdx`); exceeded → `429 rate_limited` + `Retry-After`.
5. **Per-user rate limit** (runs per minute) → `429`.
6. **Emergency daily budget per organization, exposure-aware**: realized spend today (`sum(providerCostUsd)`) **plus a conservative configured worst-case estimate for each active job and for the run being admitted** — pending work is exposure, not zero. Tripped → `429` and an alert fires; this is the runaway-loop backstop, not a pricing feature.

During private development, an organization allowlist gates the endpoint entirely. All values are config, replaced — not removed — when credit reservations arrive (reservation _is_ atomic, exposure-aware admission).

**`Idempotency-Key` header required** (the run-level key; unique per org):

- same key + same body → `200` with the original run
- same key + different body → `409 conflict`
- missing → `400`

Request:

```ts
{
  flowId: string;
  expectedFlowRevision: number;
  expectedPlanHash?: string;
  mode: "node" | "downstream" | "upstream" | "selection" | "all";
  targetNodeId?: string; // required for node/downstream/upstream
  selectedNodeIds?: string[]; // required only for selection; unique and bounded
}
```

Mode semantics are server-owned:

```txt
node        target executable node only; resolve required static sources
downstream  target plus executable descendants
upstream    target plus executable ancestors required to reach it
selection   selected executable nodes plus their minimum required executable
            upstream dependency closure
all         every executable node in the saved Flow
```

Text, Asset, and deterministic control nodes participate in source/dependency
resolution but do not create provider jobs by themselves. `selection` rejects an
empty selection or one containing no executable node and returns both the
explicitly selected count and actual planned executable-node count so the client
can disclose dependency-closure expansion.

There is deliberately **no prompt/model/settings in this body**: node draft
configuration and connected context (Text nodes, Asset nodes, and upstream
outputs) are read server-side and frozen into the run's `graphSnapshot` and job
provenance rows. The server is authoritative for what executes.

Server sequence (admission transaction followed by durable dispatch): verify the
expected Flow revision → select the mode-specific executable subgraph → resolve direct
Asset candidates and static Text inputs through edges → topologically plan
same-run upstream outputs and explicit iteration dimensions → apply deterministic
consumer-slot selection and curated model limits → validate membership,
compatibility, semantic-slot cardinality, cross-field constraints, and aggregate
model limits (`422 unsupported_by_model` names the offending setting/input) →
compose resolved prompts/instructions → lock exact existing Asset inputs in
stable ID order → revalidate the Flow revision → insert run, run-node, run-item,
source, exact-input, and just-in-time initial job records → commit → trigger the
version-pinned orchestration or job task with ID-only payloads. Provider-facing
URLs are resolved only inside the adapter boundary; expiring signed URLs and
media bytes are never snapshot data.

Run creation also **locks its selected input asset rows** (ordered by asset id) and requires every input to be **`lifecycle` live/archived AND `processingState: 'ready'`** — purging/purged inputs are rejected (the purge coordination contract under `POST /assets/:id/purge`), and `processing`/`failed` inputs are rejected with **`409 invalid_state`** naming the field (the request is well-formed; the asset is in an unusable state — the client can distinguish "wait for processing" from bad form data): an asset whose bytes haven't been verified or whose media is invalid must never reach a provider.

**Snapshot consistency — `READ COMMITTED` + Flow revision re-validation,
deliberately not `REPEATABLE READ`.** RR has a trap here: the transaction's
snapshot is taken by its first statement, the advisory-lock call, before a lock
wait completes. Under `READ COMMITTED`, statements after the lock see current
committed state. Coherence is guaranteed explicitly: read `flows.revision`,
resolve and plan, lock selected existing Asset rows in stable ID order, then
re-read `flows.revision` immediately before insertion. A mismatch rolls back and
returns `409 flow_revision_changed`; the server never silently executes a newer
graph than the user clicked. The client may flush, preflight, and submit a new
explicit admission. A changed canonical plan similarly returns
`409 run_plan_changed`. The immutable snapshot records the captured Flow
revision, exact graph/configuration, selected model-contract versions, resolved
candidate and selection decisions, topological plan, and exact static Asset IDs.
Later Flow or Asset edits affect future runs only.

Response: `202 FlowRun` with planned node/item counts and status `pending`.

A Trigger dispatch failure _after_ commit still returns `202` with the persisted pending run — the reconciliation sweep redispatches it using the run's compatible executor deployment. Trigger payloads contain only `{ flowRunId, organizationId }` or `{ generationJobId, organizationId }`; workers load immutable snapshots and exact inputs from PostgreSQL. The application and Trigger tasks are deployed atomically and the resolved executor version is recorded on the run. **Provider failures are never synchronous HTTP errors**: generation happens inside Trigger.dev after this response, so failures surface as `errorCode`/`errorMessage` on the job and run via polling (there is deliberately no `502 provider_error` in this API).

### `GET /runs/:id` — authoritative run detail

Response: `200 FlowRun` — render-complete: run status, per-node states, jobs, and
**outputs embedded once succeeded**. A narrowly scoped Trigger.dev Realtime read
token wakes the client to invalidate/refetch this domain response. Bounded
polling is fallback/recovery; Trigger.dev state is never rendered as product
truth.

### `GET /runs`

Query: `?flowId=&status=&limit=&cursor=` → `200 ListResponse<FlowRunSummary>` — lean by design: node states and outputs are unbounded per run, so lists carry progress counts and the detail endpoint carries the rest.

```ts
type FlowRunSummary = Omit<FlowRun, "nodes"> & {
  nodeCounts: Partial<Record<FlowRunNodeState["status"], number>>;
};
```

### `POST /runs/:id/cancel`

Cancellation is honest about asynchrony (the provider may finish anyway), and it targets the right Trigger run per mode:

- every M5 mode has a parent orchestration run; cancel it and any active child
  tasks, then apply guarded job, item, node, and run transitions;
- remaining pending items and nodes become `canceled`; provider completion that
  wins the race remains an honest terminal success rather than being overwritten;
- run still active → `202 FlowRun` (statuses reflect whatever the guarded writes won; keep polling)
- already terminal → `409 invalid_state`

### `POST /runs/:id/retry`

Retry is a new immutable run, never a transition that reopens the source run.

- require `Idempotency-Key` and scope both the source lookup and new run to the
  active organization;
- accept only terminal `failed`, `partial`, or `canceled` source runs;
- derive work from the source run snapshot, not the current mutable Flow;
- include failed/skipped/canceled work and its required dependency closure;
- freeze every reused successful output and validate that each referenced Asset
  is still tenant-owned and usable;
- store `retryOfRunId`, a new snapshot/hash, and the current compatible executor
  version before dispatching through the ordinary run path;
- source run is never mutated → `202 FlowRun` for the newly admitted run;
- an unsafe partial closure or unavailable compatible snapshot reader →
  `409 retry_not_available`; the user may instead rerun the current Flow.

If partial retry cannot preserve these rules in the first M5 increment, the
endpoint performs a whole-snapshot retry. It must not mix source snapshot data
with the current canvas.

### `POST /runs/:id/realtime-token`

Issue a short-lived Trigger.dev Realtime token authorized for exactly the
tenant-owned parent run being viewed. The token is only a progress-notification
channel: the dashboard refetches `GET /runs/:id` after relevant events and uses
the PostgreSQL-backed response as authoritative state.

---

## Deferred Tool API contract

Tools are not MVP endpoints, but their version semantics are fixed so UI, public
API, and MCP do not invent different execution paths later.

```txt
POST   /tools                              create mutable Tool + draft Flow
PATCH  /tools/:id                          edit mutable metadata/default visibility
POST   /tools/:id/publish                  publish coherent draft as next immutable version
GET    /tools/:id/versions                 list immutable published versions
POST   /tools/:id/runs                     invoke current published version
POST   /tools/:id/versions/:version/runs   invoke concrete version
```

The draft graph uses the ordinary Flow CRUD and graph-sync contract through the
Tool's `draftFlowId`; there is no second graph editor or persistence model.
Publishing applies the same Flow/Asset revision-revalidated snapshot
builder as run admission, validates declared typed input/output contracts, and
inserts a monotonic immutable ToolVersion. It may atomically update the Tool's
current-published-version pointer.

Default invocation resolves that pointer once under admission and stores the
concrete `toolVersionId` on the run. Explicit invocation resolves the requested
version directly. Both paths call the same run service used by canvas Tool nodes;
MCP is an adapter over this contract, not a separate executor. Idempotent replay
returns the originally resolved version even if the Tool default changed between
requests. Tool nodes always store a concrete version ID and require explicit user
upgrade.

---

## Config

### `GET /config/generation`

The resolved public product contract the client renders from. TaleLabs owns this
curated, code-versioned registry; live OpenRouter/provider discovery never drives
the response directly. Discovery is used only by a reviewed manual/CI drift
report. That report compares provider lifecycle, endpoint and parameter manifests,
dated primary-source evidence and freshness, normalized completion/delivery/
cancellation behavior, mock-pricing classification, plus the reviewed public
contract version, output profiles, accepted-media/reference profiles, setting
values/ranges, per-slot and total input limits, required/one-of input rules, and
applicable cross-field constraints. Missing or stale evidence fails closed. The
endpoint is
`ETag`-cacheable and changes only on deployment.

The initial Image catalog is a reviewed seven-model subset of a dated 39-model
OpenRouter discovery capture. Public config exposes stable TaleLabs IDs,
translation keys, semantic slots, safe setting intersections, and output
profiles only. Native model IDs, provider tags, endpoint choice, pricing, and
the wider discovered inventory remain server-only evidence.

Response `200`:

```ts
{
  registryVersion: string
  models: {
    contractVersion: string
    id: string // stable TaleLabs identity, for example 'talelabs/veo-3.1'
    displayName: string // proper model name; UI copy uses labelKey
    labelKey: string
    mediaType: MediaType
    enabled: true // unavailable models are omitted; historical contracts resolve separately
    recommended: boolean
    defaultOperationId: string
    capabilities: {
      operations: {
        id: string // 'textToVideo', 'imageToVideo', 'tts', 'soundEffect', ...
        nodeType: GenerationNodeType // authoritative picker/validation intent
        labelKey: string
        descriptionKey: string
        inputs: Record<string, { required?: true; oneOf?: string[] }>
        inputSlotIds: string[]
        settingIds: string[]
        requiredSettingIds?: string[]
        output: {
          mediaType: MediaType
          count: { default: number; min: number; max: number; settingId?: string }
        }
        referenceLimit: { maxItems: number; slotIds: string[] }
      }[]
      // registry-driven, never fixed booleans: a new provider capability (mask,
      // control image, source video, audio reference) is a new slot/setting
      // entry in the registry — never a new API field
      inputSlots: {
        role: string // from the inputRoles vocabulary: 'references', 'firstFrame', ...
        labelKey: string
        descriptionKey: string
        accepts: AssetType[]
        valueTypes: FlowValueType[]
        min: number
        max: number
        maxConnections: number
        acceptedMedia?: {
          mimeTypes: string[]
          maxBytes?: number
          durationSeconds?: { min: number; max: number }
          framesPerSecond?: number[]
          resolutions?: string[]
          aspectRatios?: string[]
        }
        referenceProfile?: {
          purposes: string[]
          multipleSubjectSupport: 'supported' | 'unsupported' | 'unknown' | 'not-applicable'
          contactSheetPolicy: 'never' | 'supported' | 'preferred' | 'not-applicable'
          recommendedMaxItems?: number
        }
      }[]
      settings: (SettingBase &
        (
          | { kind: 'enum'; options: { value: string; labelKey: string }[]; default: string }
          | { kind: 'number'; min: number; max: number; step: number; default: number }
          | { kind: 'boolean'; default: boolean }
          | { kind: 'string'; maxLength: number; default: string }
        ))[]
      constraints: GenerationConstraint[]
    }
  }[]
  elementTypes: {
    id: string // 'character', 'product'
    previewRole: string | null
    assetRoles: { id: string; accepts: AssetType[] }[]
    // the registries (schemas, roles, capabilities, handle specs) live in a SHARED
    // package (e.g. @talelabs/registry) imported by both API and web — one source
    // of truth for validation on both sides. The web app adds React Form components
    // on top; server-only buildContext implementations stay out of the browser
    // bundle. This endpoint serves the resolved metadata pickers need at runtime.
  }[]
  nodeTypes: string[]  // canvas registry keys the server accepts in graph sync
  inputRoles: string[] // provider input vocabulary ('reference', 'firstFrame', ...)
}

// shared by every setting kind — enough to render a polished control with zero
// frontend mapping tables; new metadata needs are registry additions, not API changes
type SettingBase = {
  id: string
  labelKey: string
  descriptionKey?: string
  advanced?: boolean // collapsed behind "advanced" in the node UI
  visibleWhen?: GenerationCondition[] // shared declarative visibility predicates
}

type GenerationConstraint = {
  id: string
  messageKey: string
  // Stable declarative predicates/actions interpreted by shared client/server
  // validation. Never executable code sent to the browser.
  when: GenerationCondition[]
  require?: GenerationCondition[]
  forbid?: GenerationCondition[]
}
```

`visibleWhen` is presentation metadata only. `operations` and `constraints` are
the authoritative shared validation contract; hiding a control never makes an
otherwise invalid combination executable.

Serving the vocabularies here keeps them single-sourced — the client never hardcodes a role list the server validates against.

Pinned native model IDs/endpoints, provider lifecycle and cancellation behavior,
adapter/route versions, dated evidence and lifecycle freshness, credentials,
fallback policy, mock pricing, negotiated costs, and emergency controls are
deliberately absent. A
server-only route registry resolves the tuple `(productModelId,
modelContractVersion, operationId)` to a concrete provider route during run
admission and snapshots that route/version. Historical contracts remain readable
but are not executable when that exact route is absent; the client must explicitly
upgrade the node contract first. If routing
may choose among endpoints, the public capabilities are the verified intersection
of every eligible endpoint; endpoint-specific capabilities require endpoint
pinning.

---

## Cross-cutting design notes

1. **One asset list for browsing, one subresource for reference management.** Library, pickers, and filters are all `GET /assets` + params; `GET /elements/:id/assets` exists for the distinct concern of managing link metadata (role, source/master kind, relationship metadata, order, and primary). Two purposes, two endpoints, zero shape divergence within each.
2. **Detail endpoints are render-complete; list endpoints are lean.** `GET /assets/:id` carries full provenance; `GET /runs/:id` carries outputs. No screen needs a second round trip; no grid pays for detail weight.
3. **The graph sync is the only stateful client contract.** Mutations within the request limit remain atomic. Larger client diffs advance through revision-CAS batches in dependency order (delete edges, delete nodes, upsert nodes, upsert edges); each accepted batch becomes the next replay baseline. `409 revision_conflict` still means refetch-and-replay. This is also the exact seam a future collaboration layer replaces — nothing else about the API changes.
4. **Results are derived, never duplicated.** Node results come from `/nodes/:nodeId/results` (jobs + assets), not from node `data` — matching the DB rule that draft and provenance never share storage.
5. **The idempotency ladder is client-visible only at the top.** The client supplies one `Idempotency-Key` per run request; everything below (child job keys, dispatch keys, provider submission markers) is server-derived, per the DB doc.
6. **Server-authoritative generation.** Run requests carry _which node_, never _what to generate_ — context resolution, capability validation, and snapshotting happen server-side, so provenance can't be spoofed by a client and the Generate UX can evolve without API churn.
7. **Deferred on purpose:** `POST /runs/estimate` + `402` (credits Phase 2 — costs are already recorded server-side per the DB doc); Tools/Recipes endpoints (new resources, same patterns); realtime push (polling contract stands); bulk asset operations beyond the atomic move endpoint (`POST /assets/bulk` when additional server-side bulk mutation becomes necessary).
