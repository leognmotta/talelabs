# TaleLabs — API Design v2

Supersedes `api-design-planning.md` (deprecated). Companion to `db-design-planning-v2.md` — every endpoint here maps onto that schema and its contracts; nothing is invented API-side that the DB doc doesn't back.

Scope: the base features in build order — **Assets → Folders → Elements → Flows (graph sync) → Run one node**. Deferred, with the API shape already prepared for them: multi-node run modes (`downstream`/`all`), Tools, Recipes, credits enforcement (`/runs/estimate`, `402`), realtime push, bulk operations, collaboration.

This is the **internal product API** consumed by the TaleLabs web app — not a public API. When a public surface ships, it gets its own versioned contract and auth scheme.

---

## Stack grounding (what the repo already decided)

- **Hono + `@hono/zod-openapi`**: every route declares Zod request/response schemas; the OpenAPI document and Swagger UI are generated from them. The shapes in this document are the source for those Zod schemas — contract-first, one place.
- **Better Auth** is mounted at `/api/auth/*` and owns sessions. All tenant resource routes (`/assets`, `/flows`, …) sit behind the repo's existing **`organizationMiddleware`** — it validates the session, requires an active organization (`403 active_organization_required`), and populates `organizationId`/`userId` for handlers. `authMiddleware + requireAuthMiddleware` alone is not enough: it does not resolve the active organization.
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

Cursors are opaque encodings of **`(sort, order, sortValue, id)`** — stable under ties, and self-describing: a cursor replayed with different `sort`/`order` params → `400 validation_error` (the encoded sort wins over nothing; mismatch is a client bug, not a guess). Sort semantics, defined once: `name` compares case-insensitively (`lower(name)`); nullable sort keys (`sizeBytes`) order **nulls last in both directions**; `id` is always the final tiebreaker. Default sort `createdAt desc` unless stated.

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

| HTTP | code                           | when                                                                        |
| ---- | ------------------------------ | --------------------------------------------------------------------------- |
| 400  | `validation_error`             | malformed body/params (Zod `defaultHook`; `details` per field)              |
| 401  | `unauthenticated`              | no/expired session                                                          |
| 403  | `active_organization_required` | session valid but no active organization selected                           |
| 404  | `not_found`                    | missing resource **or** another org's resource                              |
| 409  | `conflict`                     | duplicate where uniqueness matters (idempotency key reuse, edge duplicates) |
| 409  | `revision_conflict`            | graph sync CAS lost — refetch graph and replay                              |
| 409  | `invalid_state`                | canceling a finished run, restoring a purging asset, editing element type   |
| 422  | `unsupported_by_model`         | settings/inputs the selected model cannot accept                            |
| 429  | `rate_limited`                 | admission control (runs) or abuse limits; includes `Retry-After`            |
| 402  | `insufficient_credits`         | **Phase 2 only** — documented so clients handle it from day one             |
| 500  | `internal_error`               | unhandled failure (existing error middleware fallback)                      |

### Deletion semantics (mirrors the DB lifecycle: live → archived → purge requested → purged)

- `DELETE /assets/:id` **archives** (reversible). `POST /assets/:id/restore` un-archives — guarded: purge in flight → `409 invalid_state`.
- `POST /assets/:id/purge` is the explicit, confirmed permanent deletion — marks intent, dispatches the durable purge task, returns immediately; `purgedAt` is set only after storage destruction succeeds. Purged assets render as tombstones wherever referenced.
- Everything else: `DELETE` is hard; link rows cascade; assets always survive. Successful `DELETE`/detach → `204`.

---

## Endpoint index

| Area     | Endpoints                                                                                                                                                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Uploads  | `POST /uploads`                                                                                                                                                                                                        |
| Assets   | `GET /assets` · `POST /assets` · `GET /assets/:id` · `PATCH /assets/:id` · `DELETE /assets/:id` · `POST /assets/:id/restore` · `POST /assets/:id/purge` · `GET /assets/:id/usage` · `GET /assets/:id/download`         |
| Folders  | `GET /folders` · `POST /folders` · `PATCH /folders/:id` · `DELETE /folders/:id`                                                                                                                                        |
| Elements | `GET /elements` · `POST /elements` · `GET /elements/:id` · `PATCH /elements/:id` · `DELETE /elements/:id` · `GET/POST /elements/:id/assets` · `PATCH/DELETE /elements/:id/assets/:assetId` · `GET /elements/:id/usage` |
| Flows    | `GET /flows` · `POST /flows` · `GET /flows/:id` · `PATCH /flows/:id` · `DELETE /flows/:id` · `GET /flows/:id/graph` · `POST /flows/:id/graph` · `GET /flows/:id/nodes/:nodeId/results`                                 |
| Runs     | `POST /runs` · `GET /runs` · `GET /runs/:id` · `POST /runs/:id/cancel`                                                                                                                                                 |
| Config   | `GET /config/generation`                                                                                                                                                                                               |

---

## Shared resource shapes

```ts
type Folder = {
  id: string;
  parentId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type MediaType = "image" | "video" | "audio";
type AssetType = MediaType | "document";
type AssetSource = "upload" | "generation";
type AssetLifecycle = "live" | "archived" | "purging" | "purged"; // derived from the timestamp trio

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
  url: string | null; // signed, short-lived; null once purging/purged
  thumbnailUrl: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

// detail shape — render-complete for the asset panel
type AssetDetail = Asset & {
  metadata: Record<string, unknown>;
  elementLinks: { elementId: string; role: string; isPrimary: boolean }[];
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
  instructions: string | null;
  data: Record<string, unknown>; // shape defined by the registry schema for `type`
  schemaVersion: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type ElementAssetLink = {
  assetId: string;
  role: string; // registry-defined per element type
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
  type: string; // registry key: 'text' | 'asset' | 'element' | 'imageGeneration' | ...
  positionX: number;
  positionY: number;
  elementId: string | null;
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

type RunMode = "node" | "downstream" | "all" | "tool"; // only 'node' accepted initially
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

Validated against the mime allow-list and per-type size caps → `400`.

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

Request:

```ts
{
  uploadId: string
  name?: string      // defaults to original filename
  folderId?: string
  elementId?: string // convenience: also attach to an element on registration
  role?: string      //   required with elementId; validated against the registry
}
```

Order of operations: verify grant signature + expiry → `HEAD` the object, confirm existence and that actual size/content-type/**checksum** match the grant → derive `type` from verified mime → insert the asset **and the optional element link in one transaction** (a crash can't produce an attached-but-unregistered or registered-but-unattached half-state).

**Ingestion is durable, not fire-and-forget.** Uploads register as `processingState: 'processing'`; a Trigger.dev task (`idempotencyKey = assetId`) probes dimensions/duration, generates the thumbnail, fills `metadata`, and flips to `'ready'` — or to `'failed'` with a safe `processingError` for invalid/corrupt media. A reconciliation sweep redispatches assets stuck in `'processing'` (same pattern as job dispatch and purge — the crash window between insert and trigger is covered, nothing sits with null metadata forever). Generation outputs skip all of this: the generate task already probed and uploaded them, so they insert directly as `'ready'`.

**Ingestion respects the purge lifecycle**: the sweep excludes purge-requested assets (the partial index encodes it), and the task's completing update is guarded with `"purgeRequestedAt" is null` — zero rows means purge won the race, and the task deletes whatever artifacts it just created instead of resurrecting them after the purge task finishes.

**Thumbnails use the deterministic key `thumbnails/{assetId}`**, and the purge task deletes that key **unconditionally** — whether or not `thumbnailKey` was ever persisted. This closes the crash window where ingestion uploads a thumbnail and dies before the DB write: no orphan can outlive its asset's purge, with zero extra bookkeeping.

Registration is **idempotent per grant** (`uploadId` unique index), and the replay semantics are deliberate: **replay returns the original registration result (`200`) and ignores the request's metadata entirely** — the grant binds the object, not the name/folder/element fields. A replay is a network retry; if the client actually wants different metadata, that's `PATCH /assets/:id` and the element link endpoints, after the fact. (The alternative — hashing the body and returning `409` on mismatch, as runs do — was considered and rejected: it costs a stored hash for a divergence that is always a client bug, and the ignored fields are all trivially correctable post-registration. Runs get the strict variant because their body determines an _execution_; here it only decorates a row.)

Response: `201` → `Asset` (`200` on replay). Grant invalid/expired/object missing → `400`.

---

## Assets

**One canonical listing endpoint.** The global library, the canvas asset picker, and the reference selector are all `GET /assets` + filters — no per-surface variants. The one deliberate companion is `GET /elements/:id/assets`, which serves a different concern: **kit management** (role, order, primary state — link metadata, not asset browsing). Picker and filter use cases stay here; managing an element's kit uses the subresource.

### `GET /assets`

| param       | type                                 | notes                                          |
| ----------- | ------------------------------------ | ---------------------------------------------- |
| `type`      | `AssetType` (repeatable)             | `?type=image&type=video`                       |
| `source`    | `AssetSource`                        |                                                |
| `folderId`  | string \| `'root'`                   | `'root'` = no folder                           |
| `elementId` | string                               | via `elementAssets`; combine with `role`       |
| `role`      | string                               | only with `elementId`                          |
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

### `DELETE /assets/:id` → archive, `204`.

### `POST /assets/:id/restore`

Guarded: `purgeRequestedAt` set → `409 invalid_state` ("permanent deletion in progress"). Response: `200 Asset`.

### `POST /assets/:id/purge` — permanent deletion

Requires the client to have shown explicit confirmation (the endpoint exists so the destructive path is a distinct, auditable call — never an overload of DELETE). Marks intent (archiving if still live), dispatches the durable purge task (`idempotencyKey = assetId`), returns without waiting for storage deletion.

**Purge must not destroy media an active generation still needs.** Purge and run creation coordinate through row locks with a fixed ordering (asset row first, always):

- Purge: `select … for update` the asset row, then check `generationJobInputs` joined to jobs in `('pending','running')` — referenced by an active job → `409 invalid_state` ("asset is in use by a running generation"), nothing marked.
- Run creation: locks its selected input asset rows (same order: by asset id) inside the creation transaction and applies the full input rule from the Runs section — `purging`/`purged` → `404` on the field; `processing`/`failed` → `409 invalid_state`. Only `ready` assets reach a provider.

Because both paths take the same lock in the same order, the race has exactly two serializable outcomes: the run sees a purging asset and rejects, or the purge sees an active job and rejects. (Multi-node runs create downstream jobs later — that phase needs run-level input leases or copied static references; noted as a seam in the DB doc, deliberately not built now.)

Response: `202` → `Asset` (`lifecycle: 'purging'`). Already purging/purged → `200`, idempotent.

### `GET /assets/:id/usage`

Reverse provenance, paginated — the runs that consumed this asset as a provider input.

Response: `200 ListResponse<{ jobId: string; runId: string; role: string; createdAt: string }>`.

### `GET /assets/:id/download`

Response: `200 { url: string }` — signed URL with attachment disposition. Purging/purged → `404`.

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
- **Operational bounds that keep "full list, no pagination" honest:** at most **10,000 folders per organization** (checked on create) and **32 levels of depth** (checked on create/move by the same ancestor CTE that already guards cycles — no extra query). Exceeding either → `400 validation_error`. These also bound what cascade deletion and tree assembly can ever cost.
- Delete semantics (mirrors FKs): subfolders cascade; contained assets drop to no-folder, never deleted.

---

## Elements

### `GET /elements`

Query: `?type=&search=&limit=&cursor=` — sorted `updatedAt desc`.

Response: `200 ListResponse<Element & { previewThumbnailUrl: string | null }>` — preview = the primary asset of the type's registry-designated preview role.

### `POST /elements`

```ts
{
  type: string // must exist in the registry
  name: string
  instructions?: string
  data?: Record<string, unknown> // validated by the registry's Zod schema for `type`
}
```

Response: `201 Element`. Unknown type or `data` failing the type schema → `400` with field details. The server stamps `schemaVersion` from the current registry.

### `GET /elements/:id`

Response: `200 Element & { assetCounts: Record<string, number> }` — counts per role so the assets tab renders section headers without fetching everything.

### `PATCH /elements/:id`

```ts
{ name?: string; instructions?: string | null; data?: Record<string, unknown> }
```

`type` is **immutable** — its presence in a PATCH body → `409 invalid_state` (the product action for "wrong type" is creating a new element). `data`, when present, is full-replacement and re-validated; the server re-stamps `schemaVersion`.

Response: `200 Element`.

### `DELETE /elements/:id` → `204`

Kit links cascade; assets survive; flow nodes referencing it become visibly unresolved (`elementId: null`); job provenance keeps its snapshot.

### Element assets — the kit subresource

```
GET    /elements/:id/assets?role=                      -> 200 ListResponse<ElementAssetLink>
POST   /elements/:id/assets                            -> 201 ElementAssetLink
PATCH  /elements/:id/assets/:assetId                   -> 200 ElementAssetLink
DELETE /elements/:id/assets/:assetId?role=<role>       -> 204
```

`POST` body:

```ts
{ assetId: string; role: string; sortOrder?: number; isPrimary?: boolean }
```

`PATCH` body: `{ role: string; sortOrder?: number; isPrimary?: boolean }` (role identifies which link — the PK is element+asset+role).

Validation, all `400` with field details: role must exist in the registry for this element's type; the asset's media type must be accepted by that role (`voice` → audio only); same-org (else `404`). Setting `isPrimary: true` atomically clears the previous primary for that role (the partial unique index backs it). Duplicate (asset, role) pair → `409 conflict`. Detach never deletes the asset.

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
- per flow, enforced against the batch's _final state_: at most **2,000 nodes**, **5,000 edges**, and **8 MB of node-`data` bytes** (`sum(octet_length("data"::text))`, **recomputed inside the sync transaction** — one index-backed aggregate over ≤ 2,000 rows, no counter column to drift). Node `data` is the only unbounded field; nodes' fixed columns and edges are already bounded by the count caps. This byte cap is what actually bounds `GET /graph` responses and `graphSnapshot` copies, since runs snapshot subsets of this same graph. A canvas near any of these is unusable long before it is expensive, so the caps cost no real user anything

Exceeding any → `400 validation_error` naming the limit. A debounced canvas never approaches these; hitting them signals a client bug or abuse.

Response `200 { revision: number }`.

Validation (`400` unless noted): node/edge ids must be well-formed cuid2; node `type` must exist in the registry and `data` must pass its schema (server re-stamps `schemaVersion`); `elementId`/`assetId` must resolve in-org (`404` + field); edges must connect nodes of this flow (DB composite FK backs it); duplicate edge (same endpoints + handles) → `409 conflict`. There is **no whole-graph replacement endpoint** — replacement is expressible as upserts + deletes, and the batched form keeps writes proportional to what changed.

**Connection semantics are registry-validated, not just referential.** The node registry declares, per node type, its handles (ids, the media/data types each accepts or emits, cardinality) and its payload requirements (an `element` node must carry `elementId`, an `asset` node `assetId`). Graph sync rejects — evaluated against the batch's _final_ state — edges into unknown handles, incompatible connections (an audio output into an image-only input), cardinality overflow, and type-payload violations. The boundary is deliberate: **incomplete is valid** (a half-built canvas with unconnected required inputs saves fine — that's normal editing), only _contradictory_ graphs are rejected; full executability is checked at run time, where the model's capabilities are known.

### `GET /flows/:id/nodes/:nodeId/results` — node run history

Response: `200 ListResponse<RunJob & { runId: string }>` — newest first, outputs embedded. This is the derived node-result display (results are never stored in node `data`) and the picker for pinning a specific output. Backed by `generationJobsNodeHistoryIdx`.

---

## Runs

The execution surface. One spine: every execution is a run; only `mode: 'node'` is accepted initially — the request shape already carries the future (`downstream`, `all` → `400 validation_error` "mode not yet available" until they ship, so enabling them is a validator change, not an API change).

### `POST /runs` — run one generation node

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
  mode: "node";
  targetNodeId: string; // must be a generation-type node of this flow
}
```

There is deliberately **no prompt/model/settings in this body**: the node's draft config and its connected context (text nodes, asset nodes, element nodes, upstream outputs) are read server-side and frozen into the run's `graphSnapshot` and the job's provenance rows — the server is authoritative for what executes (vision: "generation must remain server-authoritative").

Server sequence (one transaction + dispatch, per the DB doc's integration contract): resolve upstream context via edges → resolve elements through the registry's `buildContext` → apply model capability limits (`422 unsupported_by_model` naming the offending setting/input) → compose `resolvedPrompt` → insert run + run-node + job + sources + inputs → commit → trigger the generate task.

Run creation also **locks its selected input asset rows** (ordered by asset id) and requires every input to be **`lifecycle` live/archived AND `processingState: 'ready'`** — purging/purged inputs are rejected (the purge coordination contract under `POST /assets/:id/purge`), and `processing`/`failed` inputs are rejected with **`409 invalid_state`** naming the field (the request is well-formed; the asset is in an unusable state — the client can distinguish "wait for processing" from bad form data): an asset whose bytes haven't been verified or whose media is invalid must never reach a provider.

**Snapshot consistency — `READ COMMITTED` + revision re-validation, deliberately not `REPEATABLE READ`.** RR has a trap here: the transaction's snapshot is taken by its _first statement_ — which is the advisory-lock call — _before_ the lock wait completes, so a queued transaction would evaluate the admission limits against a stale snapshot and the whole point of the lock evaporates. Under `READ COMMITTED`, every statement after the lock sees the latest committed state, which is exactly what admission needs. Graph consistency is then guaranteed by the revision, not the isolation level: read `flows.revision` before resolving, resolve (each individual read is internally consistent), **re-read the revision just before inserting** — changed → rollback and retry (rare; autosave collided). The captured `revision` is recorded inside `graphSnapshot` so every run states exactly which graph version it executed. Element edits between reads simply yield the newer element — each element+kit is read in one self-consistent statement, and "the context as of the click" is what provenance promises.

Response: `202 FlowRun` — `nodes[0].job` embedded with status `pending`.

A Trigger dispatch failure _after_ commit still returns `202` with the persisted pending run — the reconciliation sweep redispatches it. **Provider failures are never synchronous HTTP errors**: generation happens inside Trigger.dev after this response, so failures surface as `errorCode`/`errorMessage` on the job and run via polling (there is deliberately no `502 provider_error` in this API).

### `GET /runs/:id` — the polling endpoint

Response: `200 FlowRun` — render-complete: run status, per-node states, jobs, and **outputs embedded once succeeded**. The client polls this (Trigger.dev Realtime is an optional push upgrade later; the DB row remains the truth either way).

### `GET /runs`

Query: `?flowId=&status=&limit=&cursor=` → `200 ListResponse<FlowRunSummary>` — lean by design: node states and outputs are unbounded per run, so lists carry progress counts and the detail endpoint carries the rest.

```ts
type FlowRunSummary = Omit<FlowRun, "nodes"> & {
  nodeCounts: Partial<Record<FlowRunNodeState["status"], number>>;
};
```

### `POST /runs/:id/cancel`

Cancellation is honest about asynchrony (the provider may finish anyway), and it targets the right Trigger run per mode:

- **mode `'node'`**: there is no parent orchestration run — the server cancels the **child job's** `triggerRunId` and applies the guarded transitions to job, run-node, and run together.
- **multi-node modes (later)**: cancel the **parent** orchestration run _and_ any active children's runs, then the same guarded transitions; remaining pending run-nodes go `'canceled'`.
- run still active → `202 FlowRun` (statuses reflect whatever the guarded writes won; keep polling)
- already terminal → `409 invalid_state`

---

## Config

### `GET /config/generation`

The resolved, product-controlled configuration the client renders from — model catalog + code registries, merged server-side. `ETag`-cacheable; changes only on deploy or catalog refresh.

Response `200`:

```ts
{
  models: {
    id: string // 'provider/model'
    displayName: string
    mediaType: MediaType
    enabled: boolean
    recommended: boolean
    capabilities: {
      // registry-driven, never fixed booleans: a new provider capability (mask,
      // control image, source video, audio reference) is a new slot/setting
      // entry in the registry — never a new API field
      inputSlots: {
        role: string // from the inputRoles vocabulary: 'reference', 'firstFrame', ...
        label: string // presentation ships with the data — no frontend id->label mapping tables
        description?: string
        accepts: AssetType[]
        min: number
        max: number
      }[]
      settings: (SettingBase &
        (
          | { kind: 'enum'; options: { value: string; label: string }[]; default?: string }
          | { kind: 'number'; min: number; max: number; step?: number; unit?: string; default?: number }
          | { kind: 'boolean'; default?: boolean }
        ))[]
    }
  }[]
  elementTypes: {
    id: string // 'character', 'product'
    label: string
    previewRole: string
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
  label: string
  description?: string
  advanced?: boolean // collapsed behind "advanced" in the node UI
  visibleWhen?: { settingId: string; equals: unknown } // simple dependent visibility
}
```

Serving the vocabularies here keeps them single-sourced — the client never hardcodes a role list the server validates against.

---

## Cross-cutting design notes

1. **One asset list for browsing, one subresource for kit management.** Library, pickers, and filters are all `GET /assets` + params; `GET /elements/:id/assets` exists for the distinct concern of managing link metadata (role, order, primary). Two purposes, two endpoints, zero shape divergence within each.
2. **Detail endpoints are render-complete; list endpoints are lean.** `GET /assets/:id` carries full provenance; `GET /runs/:id` carries outputs. No screen needs a second round trip; no grid pays for detail weight.
3. **The graph sync is the only stateful client contract.** Batched mutations + revision CAS + `409 revision_conflict` → refetch-and-replay. This is also the exact seam a future collaboration layer replaces — nothing else about the API changes.
4. **Results are derived, never duplicated.** Node results come from `/nodes/:nodeId/results` (jobs + assets), not from node `data` — matching the DB rule that draft and provenance never share storage.
5. **The idempotency ladder is client-visible only at the top.** The client supplies one `Idempotency-Key` per run request; everything below (child job keys, dispatch keys, provider submission markers) is server-derived, per the DB doc.
6. **Server-authoritative generation.** Run requests carry _which node_, never _what to generate_ — context resolution, capability validation, and snapshotting happen server-side, so provenance can't be spoofed by a client and the Generate UX can evolve without API churn.
7. **Deferred on purpose:** `POST /runs/estimate` + `402` (credits Phase 2 — costs are already recorded server-side per the DB doc); `downstream`/`all` modes (validator flip when the orchestrator ships); Tools/Recipes endpoints (new resources, same patterns); realtime push (polling contract stands); bulk asset operations (`POST /assets/bulk` when multi-select ships); tags/favorites (deliberately absent from the vision).
