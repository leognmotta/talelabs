# TaleLabs — MVP API Design

Companion to the DB design document (`db-design-planning.md`). Same scope: the first billable creative loop — **Brands + Products + Characters → Generate → Assets → Projects**. Same exclusions: org/membership management, billing, boards, workflows, voices, studio, public API keys.

This is the **internal product API** consumed by the TaleLabs web app. It is not the future public API; when that ships, it gets its own versioned surface and auth scheme.

---

## Conventions

### Base, auth, tenancy

- Base path: `/api/v1`. All examples below omit the prefix.
- Auth: Better Auth session cookie. Unauthenticated → `401`.
- **Tenancy is implicit.** Every request executes against the session's active organization (Better Auth's `activeOrganizationId`). Organization ids never appear in URLs or bodies. A resource belonging to another org is indistinguishable from a missing one → `404`, never `403` (don't leak existence).

### Wire format

- JSON in/out, `camelCase` keys (matches the JS runtime; the DB layer maps snake_case↔camelCase).
- Ids are cuid2 strings, server-generated. Clients never supply ids on create.
- Timestamps are ISO 8601 UTC strings (`2026-07-09T14:30:00.000Z`).
- Absent optional fields on create/update mean "leave unchanged" (PATCH) or "use default" (POST). Explicit `null` means "clear this field".
- Media access is via **server-issued URLs** (`url`, `thumbnailUrl` on Asset). An asset's storage visibility is decided at write time by **the generation's credit funding source** — promotional-credit outputs go to the public showcase bucket; unmetered (Phase 1) and subscription/top-up outputs and **all uploads** are private — and is recorded per asset. A URL is therefore either a stable public CDN URL or a short-lived signed URL. **Clients treat every URL as opaque and potentially expiring: render it, never persist it** — re-fetch the asset when a URL is needed later. Storage keys are internal and never exposed.

### List responses & pagination

Cursor pagination everywhere. Cursors are opaque strings.

```ts
// every list endpoint
type ListResponse<T> = {
  data: T[]
  nextCursor: string | null   // null = no more pages
}
// query params accepted by every list endpoint
// ?limit=50 (default 50, max 200) &cursor=<opaque>
```

Default sort is `createdAt DESC` unless stated otherwise. Every sort uses `id` as tie-breaker (cursors encode `(sortValue, id)`), so pagination is stable even when many rows share a timestamp or name.

### Errors

```ts
type ApiError = {
  error: {
    code: string        // stable, machine-readable
    message: string     // human-readable, safe to display
    details?: {         // present on validation errors
      field: string
      message: string
    }[]
  }
}
```

| HTTP | code                    | when |
|------|-------------------------|------|
| 400  | `validation_error`      | malformed body/params (details lists each field) |
| 401  | `unauthenticated`       | no/expired session |
| 404  | `not_found`             | missing resource **or** resource in another org |
| 409  | `conflict`              | duplicate (e.g. tag name), link already exists where that matters |
| 409  | `invalid_state`         | e.g. canceling a finished job |
| 402  | `insufficient_credits`  | Phase 2 only; documented now so clients handle it from day one |
| 422  | `unsupported_by_model`  | settings/inputs the chosen model can't accept (from provider catalog validation) |
| 502  | `provider_error`        | upstream generation provider failed synchronously |

Cross-org references inside a body (e.g. attaching another org's `assetId`) → `404` with `code: not_found` and `details` naming the field.

### Deletion semantics (mirrors the DB doc)

- Assets: `DELETE` **archives** (`deletedAt`); restore is explicit. Nothing else soft-deletes.
- Everything else: `DELETE` is a hard delete; link rows cascade away, assets always survive.
- Successful `DELETE` and unlink → `204 No Content`.

---

## Endpoint index

| Area | Endpoints |
|------|-----------|
| Generation | `POST /generations` · `GET /generations` · `GET /generations/:id` · `POST /generations/:id/cancel` · `POST /generations/estimate` (Phase 2) |
| Uploads | `POST /uploads` |
| Assets | `GET /assets` · `POST /assets` · `GET /assets/:id` · `PATCH /assets/:id` · `DELETE /assets/:id` · `POST /assets/:id/restore` · `POST /assets/:id/duplicate` · `GET /assets/:id/download` · `PUT /assets/:id/tags` |
| Folders | `GET /folders` · `POST /folders` · `PATCH /folders/:id` · `DELETE /folders/:id` |
| Tags | `GET /tags` · `POST /tags` · `DELETE /tags/:id` |
| Brands | CRUD + `…/:id/assets` kit + `…/:id/characters` links |
| Products | CRUD + `…/:id/assets` kit |
| Characters | CRUD + `…/:id/assets` kit |
| Projects | CRUD + `…/:id/{assets,brands,products,characters}` links |
| Config | `GET /config/generation` |

---

## Shared resource shapes

Defined once; endpoints reference them.

```ts
type Brand = {
  id: string
  name: string
  description: string | null
  toneOfVoice: string | null
  visualStyle: string | null
  doRules: string | null
  dontRules: string | null
  colors: { name: string; hex: string }[]
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

type Product = {
  id: string
  brandId: string | null
  name: string
  description: string | null
  features: string[]
  benefits: string[]
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

type Character = {
  id: string
  name: string
  role: string | null          // "spokesperson", "brand mascot", ...
  description: string | null
  personality: string | null
  visualNotes: string | null
  brandIds: string[]           // via brand_characters
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

type Project = {
  id: string
  name: string
  description: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

type Folder = {
  id: string
  parentId: string | null
  name: string
  createdAt: string
  updatedAt: string
}

type Tag = {
  id: string
  name: string
}

type MediaType = 'image' | 'video' | 'audio'
type AssetType = MediaType | 'document' | 'font'
type AssetSource = 'upload' | 'generation' | 'export'

// list-item shape — everything the Assets grid needs, nothing more
type Asset = {
  id: string
  name: string
  type: AssetType
  source: AssetSource
  mimeType: string
  sizeBytes: number | null
  width: number | null
  height: number | null
  durationSeconds: number | null
  folderId: string | null
  generationJobId: string | null
  favorite: boolean
  visibility: 'public' | 'private'   // which bucket serves it; public = promotional-credit output, showcase-eligible
  url: string                  // public CDN or short-lived signed — opaque either way
  thumbnailUrl: string | null  // same rules as url
  createdBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

// detail shape — Asset plus everything the detail panel shows
type AssetDetail = Asset & {
  tags: Tag[]
  projectIds: string[]
  // reverse kit memberships, for the relationship chips
  brandLinks: { brandId: string; role: string }[]
  productLinks: { productId: string; role: string }[]
  characterLinks: { characterId: string; role: string }[]
  metadata: Record<string, unknown>
  generation: GenerationJob | null   // null for uploads
}

type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled'
type InputRole = 'reference' | 'first_frame' | 'last_frame' | 'source_image' | 'audio_reference'
type CreditSource = 'unmetered' | 'promotional' | 'subscription' | 'top_up'
// 'unmetered' = Phase 1 (no credit system yet): every job, outputs private

type GenerationJob = {
  id: string
  mediaType: MediaType
  status: JobStatus
  provider: string
  model: string
  appId: string | null
  prompt: string | null          // the user's prompt as typed
  resolvedPrompt: string | null  // final provider prompt, composed at job creation; null only if no text context applies
  settings: Record<string, unknown>
  brandId: string | null
  productId: string | null
  projectId: string | null
  characterIds: string[]                       // via generation_job_characters
  inputs: { assetId: string; role: InputRole }[]
  creditSource: CreditSource     // funding snapshot, server-decided at create; drives output visibility
  creditCost: number | null
  errorCode: string | null       // stable failure class: 'content_policy', 'provider_timeout', ...
  errorMessage: string | null    // safe to display; raw provider diagnostics live in server logs only
  cancelRequestedAt: string | null
  outputs: Asset[]                             // assets produced; [] until succeeded
  createdBy: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}
```

---

## Generation

The core loop. Jobs are asynchronous: create returns immediately, the client polls (SSE/webhooks are a later layer — polling `GET /generations/:id` is the MVP contract).

**Credit phasing — do not build Phase 2 prematurely:**

```txt
Phase 1 (now):   generation executes with NO balance enforcement.
                 creditSource is always 'unmetered', outputs private,
                 creditCost recorded when known, nothing charged or blocked.
Phase 2 (later): /generations/estimate goes live, wallets, reservations,
                 capture/release, 402 enforcement, promotional funding -> public outputs.
```

### `POST /generations` — create a generation job

The operation that becomes billable in Phase 2, so the **`Idempotency-Key` header is required** from day one. The server persists the key and a hash of the request body on the job (`UNIQUE (organization_id, idempotency_key)`):

- same key + same body → `200` with the original job (retry-safe, nothing created or charged twice)
- same key + different body → `409 conflict`
- missing header → `400 validation_error`

Request:

```ts
{
  mediaType: MediaType
  prompt?: string
  model?: string                // required when appId absent; app default otherwise
  appId?: string                // static-config app slug; adapts validation to the app's form
  settings?: Record<string, unknown>   // aspectRatio, duration, seed, quality, ...
  brandId?: string
  productId?: string
  characterIds?: string[]       // multi-character scenes are first-class
  projectId?: string            // output assets auto-attach to this project
  inputs?: { assetId: string; role?: InputRole }[]   // role defaults to 'reference'
}
```

Validation (fail-fast, `400`/`422` before any provider call):

- `model` must exist and be enabled in the resolved config (provider catalog + local overrides).
- `settings` and `inputs` are validated against that model's capabilities (max reference images, allowed durations/aspect ratios, frame-image support) → `422 unsupported_by_model` naming the offending field.
- Every referenced id (`brandId`, `characterIds[*]`, `inputs[*].assetId`, …) must exist in the caller's org → `404` with the field in `details`. This is the service-layer cross-org checklist from the DB doc, enforced at the API boundary.
- Context is explicit — selecting a product never auto-selects its brand. If both `brandId` and `productId` are supplied and the product belongs to a *different* brand → `400 validation_error` (a brandless product with any brand is fine).

The server decides `creditSource` at create — in Phase 1 it is always `'unmetered'` with no balance check. From Phase 2 on: **one credit bucket per job, never split** across promotional and paid; if promotional credits don't cover the job, it runs entirely on paid credits and outputs stay private. `resolvedPrompt` is also composed here, at create: the job snapshots brand/product/character context exactly as the user saw it, so later edits or deletions can't change what runs.

Response: `202 Accepted` → `GenerationJob` (status `pending`, `outputs: []`).

### `GET /generations/:id`

Response: `200` → `GenerationJob`. When `status: 'succeeded'`, `outputs` contains the created assets — the client needs no second call to render results.

### `GET /generations` — list job history

Query: `?status=&mediaType=&projectId=&limit=&cursor=`

Response: `200` → `ListResponse<GenerationJob>`.

### `POST /generations/:id/cancel`

Cancellation is two-phase, because an upstream provider may keep running (and charging) regardless of our intent — `status` never claims `canceled` before it's true:

- `pending` job (worker never started) → `200` → `GenerationJob` with `status: 'canceled'`, immediately.
- `running` job → `202` → `GenerationJob` with `cancelRequestedAt` set and `status` still `'running'`. The worker observes the flag, attempts provider-side cancellation, and writes the terminal status (`canceled`, or `succeeded`/`failed` if the provider finished anyway). The client keeps polling as normal.
- finished job → `409 invalid_state`.

### `POST /generations/estimate` — credit estimate for the Generate form (**Phase 2**)

Documented now so the contract is agreed; **do not implement until the credit system ships.** Phase 1 clients get field-level validation from `POST /generations` itself. Same request body as `POST /generations`. Pure function: validates and prices, creates nothing.

Response: `200`:

```ts
{
  credits: number
  creditSource: CreditSource               // which bucket this job would draw from
  outputVisibility: 'public' | 'private'   // consequence of creditSource — drives the
                                           // "generations made with free promotional credits
                                           //  are public and may be featured" notice
  breakdown: { label: string; credits: number }[]  // e.g. "video 8s @ 1080p", "audio track"
}
```

Invalid input returns the same `400`/`422` shapes as create — so the Generate form gets field-level validation for free by calling estimate as the user edits.

The estimate is **advisory only**. `POST /generations` reprices the same body server-side; the client never submits an amount, so a stale or tampered estimate can't change what gets charged. When billing ships, the reserve→capture/release credit lifecycle attaches to create, not here.

---

## Uploads

Two-step presigned flow: the API never proxies file bytes.

### `POST /uploads` — get a presigned upload target

Request:

```ts
{
  filename: string
  mimeType: string
  sizeBytes: number
}
```

Validation: mime type allow-list, size cap per type. → `400 validation_error`.

Response: `201`:

```ts
{
  uploadUrl: string      // presigned PUT URL, short-lived
  uploadId: string       // signed grant token; pass to POST /assets
}
```

`uploadId` is a **signed, self-contained grant** binding organization, user, generated object key, declared mime type, declared size, and expiry — the server holds no grant state. Tampering or cross-org reuse fails signature/tenancy checks.

**Uploads always target the private bucket.** User-provided media — logos, product shots, references — is never made public by any plan or credit rule. Only generation outputs can be public, decided by the job's `creditSource` (see Generation).

Client `PUT`s the bytes to `uploadUrl`, then registers the asset:

### `POST /assets` — register an uploaded file as an asset

Request:

```ts
{
  uploadId: string       // from POST /uploads; server derives storage key, verifies the object exists
  name?: string          // defaults to original filename
  folderId?: string
  projectId?: string     // auto-attach to a project (upload-inside-project flow)
}
```

Registration verifies before creating anything: signature and expiry of the grant, then a `HEAD` on the object confirming it exists and its actual size/content-type match what the grant declared → `400 validation_error` on any mismatch.

Registration is **idempotent per grant**: `uploadId` is stored on the asset under a unique index, so replaying the same grant returns the already-registered asset (`200`) instead of minting duplicate rows.

Server derives `type` from the verified mime type, extracts dimensions/duration, generates a thumbnail async.

Response: `201` → `Asset` (`source: 'upload'`); `200` → existing `Asset` on replay.

---

## Assets

The global library. **There is exactly one asset listing endpoint**; every product surface (global drive, project tab, brand kit picker, "choose reference" modal) is this endpoint plus filters.

### `GET /assets`

Query params (all optional, combinable — they AND together):

| param | type | notes |
|---|---|---|
| `type` | `AssetType` (repeatable) | `?type=image&type=video` |
| `source` | `AssetSource` | |
| `folderId` | string \| `'root'` | `'root'` = assets in no folder |
| `projectId` | string | via `project_assets` |
| `brandId` | string | via `brand_assets` |
| `productId` | string | via `product_assets` |
| `characterId` | string | via `character_assets` |
| `tagId` | string (repeatable) | AND semantics across tags |
| `favorite` | boolean | |
| `archived` | boolean | default `false`; `true` lists only archived |
| `search` | string | matches `name` (ILIKE for MVP) |
| `sort` | `createdAt` \| `name` \| `sizeBytes` | default `createdAt` |
| `order` | `asc` \| `desc` | default `desc` |

Response: `200` → `ListResponse<Asset>`.

### `GET /assets/:id`

Response: `200` → `AssetDetail`. One call renders the entire detail panel: media, tags, relationship chips, and full generation provenance (prompt, model, settings, inputs, cost) via the embedded `generation` job.

### `PATCH /assets/:id`

Request (all fields optional; `null` clears):

```ts
{
  name?: string
  folderId?: string | null     // move / remove from folder
  favorite?: boolean
}
```

Response: `200` → `Asset`.

### `DELETE /assets/:id` — archive

Sets `deletedAt`. Links and tags are kept, so restore is lossless. Response: `204`.

### `POST /assets/:id/restore`

Clears `deletedAt`. Response: `200` → `Asset`.

### `POST /assets/:id/duplicate`

New asset row pointing at the same storage object and (if any) the same generation job — the "duplicate/copy" cheap-row-copy from the DB doc.

Request: `{ name?: string }` — defaults to `"<original> copy"`.

Response: `201` → `Asset`.

### `GET /assets/:id/download`

Response: `200` → `{ url: string }` — signed URL with `Content-Disposition: attachment`. (Separate from `Asset.url`, which is inline-display.)

### `PUT /assets/:id/tags` — set tags by name

Declarative full replacement; tags are upserted by name so the UI's tag input needs no separate create call.

Request:

```ts
{ names: string[] }   // e.g. ["hero", "q3-campaign"] — [] clears all tags
```

Response: `200` → `{ tags: Tag[] }`.

---

## Folders

Folder trees are small (org-scoped, shallow); the API returns the full flat list and the client builds the tree. No pagination.

### `GET /folders`

Response: `200` → `{ data: Folder[] }` (all folders, sorted by name).

### `POST /folders`

Request: `{ name: string; parentId?: string }`
Response: `201` → `Folder`.

### `PATCH /folders/:id`

Request: `{ name?: string; parentId?: string | null }` — `null` moves to root. Moving a folder under its own descendant → `400 validation_error`.
Response: `200` → `Folder`.

### `DELETE /folders/:id`

**Semantics (mirrors DB FKs):** subfolders are deleted with it (cascade); assets inside any deleted folder are *not* deleted — they drop to no-folder (`folderId: null`). Response: `204`.

---

## Tags

Mostly managed implicitly through `PUT /assets/:id/tags`; these exist for the tag-management UI and filter dropdowns.

- `GET /tags` → `200` `{ data: (Tag & { assetCount: number })[] }` — no pagination, org tag sets are small.
- `POST /tags` → `{ name: string }` → `201` `Tag`. Duplicate name → `409 conflict`.
- `DELETE /tags/:id` → `204`. Removes the tag from all assets (cascade).

---

## Context objects: Brands, Products, Characters

All three follow the same pattern: **plain CRUD on the profile, plus a role-carrying asset-kit subresource.** Uniformity is deliberate DX — learn one, know all three.

Kit links validate the asset's media type against the role: logo roles and `expression_sheet`/`pose_sheet` require `image`, `sample_video` requires `video`, `sample_audio`/`voice_reference` require `audio` → `400 validation_error` on mismatch. The role→type map ships in static config alongside the role vocabularies.

### Brands

#### `GET /brands`

Query: `?search=&limit=&cursor=`
Response: `200` → `ListResponse<Brand>`.

#### `POST /brands`

Request:

```ts
{
  name: string                     // required; everything else optional
  description?: string
  toneOfVoice?: string
  visualStyle?: string
  doRules?: string
  dontRules?: string
  colors?: { name: string; hex: string }[]   // hex validated as #RRGGBB
}
```

Response: `201` → `Brand`.

#### `GET /brands/:id`

Response: `200` → `Brand & { kitCounts: Record<string, number> }` — asset counts per role, so the Brand Kit page can render section headers without fetching every asset.

#### `PATCH /brands/:id`

Request: any subset of the POST fields (`null` clears nullable fields; `colors` is full-replacement).
Response: `200` → `Brand`.

#### `DELETE /brands/:id`

Hard delete. Kit links cascade; assets survive; `products.brandId` becomes `null`; jobs keep history via `ON DELETE SET NULL`. Response: `204`.

#### Brand kit: `GET|POST|DELETE /brands/:id/assets`

```
GET    /brands/:id/assets?role=logo_primary     → 200 ListResponse<Asset & { role: string }>
POST   /brands/:id/assets  { assetId, role }    → 201 { assetId, role }
DELETE /brands/:id/assets/:assetId?role=<role>  → 204
```

`role` ∈ the brand-kit vocabulary from the DB doc (`logo_primary`, `logo_horizontal`, `logo_icon`, `logo_wordmark`, `logo_light`, `logo_dark`, `logo_mono`, `reference`, `approved_output`). Invalid role → `400`. Same (asset, role) pair twice → `409 conflict`. `role` is required on DELETE because the PK is (brand, asset, role) — the same asset may be linked under several roles.

#### Brand characters: `GET|POST|DELETE /brands/:id/characters`

```
GET    /brands/:id/characters                → 200 { data: Character[] }
POST   /brands/:id/characters { characterId } → 201 (idempotent: re-linking is a no-op 201)
DELETE /brands/:id/characters/:characterId   → 204
```

### Products

Identical CRUD pattern:

```
GET    /products?brandId=&search=&limit=&cursor=   → 200 ListResponse<Product>
POST   /products                                   → 201 Product
GET    /products/:id                               → 200 Product & { kitCounts }
PATCH  /products/:id                               → 200 Product
DELETE /products/:id                               → 204
```

`POST /products` request:

```ts
{
  name: string
  brandId?: string
  description?: string
  features?: string[]     // full-replacement on PATCH
  benefits?: string[]
}
```

Product kit — same shape as the brand kit, product role vocabulary (`source_image`, `packaging`, `lifestyle`, `reference`, `approved_output`):

```
GET    /products/:id/assets?role=
POST   /products/:id/assets  { assetId, role }
DELETE /products/:id/assets/:assetId?role=
```

### Characters

```
GET    /characters?brandId=&search=&limit=&cursor=   → 200 ListResponse<Character>
POST   /characters                                   → 201 Character
GET    /characters/:id                               → 200 Character & { kitCounts }
PATCH  /characters/:id                               → 200 Character
DELETE /characters/:id                               → 204
```

`POST /characters` request:

```ts
{
  name: string
  role?: string
  description?: string
  personality?: string
  visualNotes?: string
  brandIds?: string[]     // convenience: creates brand_characters links atomically
}
```

`?brandId=` on the list filters through `brand_characters`. Brand links are managed from the brand side (`/brands/:id/characters`) or via `brandIds` here on create; `Character.brandIds` always reflects current links.

Character kit — same shape, character role vocabulary (`reference_image`, `expression_sheet`, `pose_sheet`, `sample_video`, `sample_audio`, `voice_reference`, `approved_output`):

```
GET    /characters/:id/assets?role=
POST   /characters/:id/assets  { assetId, role }
DELETE /characters/:id/assets/:assetId?role=
```

---

## Projects

Containers and filters — the API keeps them thin, per the vision ("do not overbuild project management").

```
GET    /projects?search=&limit=&cursor=   → 200 ListResponse<Project>
POST   /projects  { name, description? }  → 201 Project
GET    /projects/:id                      → 200 ProjectDetail
PATCH  /projects/:id                      → 200 Project
DELETE /projects/:id                      → 204   // links cascade; assets/brands/etc. all survive
```

```ts
type ProjectDetail = Project & {
  counts: { assets: number; brands: number; products: number; characters: number }
  brands: Brand[]           // linked context, small by nature — embedded, no extra calls
  products: Product[]
  characters: Character[]
}
```

Assets are *not* embedded (unbounded): the project's Assets tab is `GET /assets?projectId=…` — one asset system, filtered, exactly as the vision demands.

### Project links — one uniform pattern for all four relations

```
POST   /projects/:id/assets      { assetId }      → 201
DELETE /projects/:id/assets/:assetId              → 204
POST   /projects/:id/brands      { brandId }      → 201
DELETE /projects/:id/brands/:brandId              → 204
POST   /projects/:id/products    { productId }    → 201
DELETE /projects/:id/products/:productId          → 204
POST   /projects/:id/characters  { characterId }  → 201
DELETE /projects/:id/characters/:characterId      → 204
```

All link POSTs are idempotent (re-linking an existing pair → `201`, no error) — attach flows shouldn't force clients to pre-check. Cross-org target → `404`.

Note the two *implicit* attach paths that don't use these endpoints: `POST /generations` with `projectId` (outputs auto-attach) and `POST /assets` with `projectId` (uploads auto-attach).

---

## Config

### `GET /config/generation`

The resolved generation config the Generate UI renders from: **provider catalog + local overrides + app presets**, merged server-side so the client never talks to providers or reads YAML.

Response: `200`:

```ts
{
  models: {
    id: string                    // 'bytedance/seedance-2.0'
    displayName: string
    mediaType: MediaType
    recommended: boolean
    capabilities: {
      aspectRatios: string[]
      durations?: number[]        // video/audio
      resolutions?: string[]
      maxReferenceImages: number
      supportsFirstLastFrame?: boolean
      supportsSeed: boolean
      supportsAudio?: boolean     // video models
    }
  }[]
  apps: {
    id: string                    // 'scene-builder'
    name: string
    section: MediaType
    steps: {
      id: string
      title: string
      fields: AppFormField[]
      defaultModel: string
    }[]
  }[]
  inputRoles: InputRole[]
  kitRoles: {
    brand: string[]
    product: string[]
    character: string[]
  }
}

// discriminated union — mirrors the static app-config Zod schema; extending it
// is a config-schema change validated at build time, not an API change
type AppFormField =
  | { type: 'textarea'; name: string; label: string; required?: boolean }
  | { type: 'references'; name: string; max: number }
  | { type: 'generated_frame'; name: string }   // consumes a prior step's output asset
  | { type: 'select'; name: string; label: string; options: { value: string; label: string }[] }
  | { type: 'duration' | 'aspect_ratio' | 'resolution'; name: string }  // options come from the selected model's capabilities
```

Cacheable (`ETag`); changes only on deploy or provider-catalog refresh. Serving `kitRoles` here keeps the role vocabularies single-sourced — the UI never hardcodes them.

---

## Cross-cutting design notes

1. **One asset list to rule them all.** Global drive, project tab, kit pickers, and reference-selection modals are all `GET /assets` + filters. No per-surface endpoints, no divergent shapes.
2. **Detail endpoints are render-complete.** `GET /assets/:id` and `GET /generations/:id` each return everything their screen needs in one round trip (embedded generation, embedded outputs). List endpoints stay lean.
3. **Link endpoints are uniform and idempotent.** Every relationship in the DB doc maps to the same `POST {targetId}` / `DELETE /:targetId` subresource pattern; role-carrying kits add `role`. Learn one, know all eleven join tables.
4. **Validation before spend.** `Idempotency-Key` protects the (eventually billable) create from retries in every phase. From Phase 2, `POST /generations/estimate` shares the create-body contract so the Generate form gets provider-aware, field-level validation and live pricing without side effects.
5. **The org check is an API-boundary guarantee.** Every id in every body resolves within the session org or the request fails with `404` — this is where the DB doc's service-layer tenancy checklist lives.
6. **Deferred on purpose:** SSE/webhooks for job progress (polling is fine at MVP volume), bulk operations (multi-select move/tag/archive — add `POST /assets/bulk` when the UI ships multi-select), permanent asset deletion, explicit `POST /assets/:id/publish` / unpublish for opt-in gallery showcasing (the MVP public/private split is credit-source-driven at write time; see the DB doc's `visibility` note), the public landing-gallery read endpoint and `featured_at` curation flow (internal/admin action, outside this authenticated API), public API keys, rate limiting, the credit reserve→capture/release lifecycle and `402 insufficient_credits` activation (documented now, enforced when billing ships).