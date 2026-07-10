# TaleLabs — MVP Database Structure (PostgreSQL)

Scope: the first billable creative loop — **Brands + Products + Characters → Generate → Assets → Projects**.

Assumed to already exist (not modeled here): the Better Auth tables `"organization"` and `"user"` (singular names, as Better Auth creates them — do not rename auth-library-managed tables). All DDL below quotes them; `user` is a reserved keyword in Postgres, so the quotes on `"user"` are mandatory, not style. Every table below is tenant-scoped by `organizationId`; `createdBy` references `"user"` where creator attribution matters.

Deliberately out of scope for this schema (per current direction): organization/membership modeling, billing, credit ledger/reservations, boards, workflows, voices, studio, public gallery, team collaboration. The design leaves clean seams for all of them (see [Future-proofing](#future-proofing)).

Apps, models, presets, and pricing rules are **static config (YAML/TS)**, not database rows. The database only stores *references* to them (slugs/ids as text), per the product's configuration strategy.

---

## Design principles

1. **Assets are global (org-wide), relations are links.** Nothing "owns" an asset except the organization. Projects, brands, products, and characters *relate* to assets through join tables. This directly implements the product rule "Assets should remain global."
2. **Explicit join tables, no polymorphism.** There are only 4 context entities (brand, product, character, project). Four small join tables with real foreign keys beat one polymorphic `entityType/entityId` table that Postgres can't enforce. Fewer bugs, honest constraints, trivial queries.
3. **Generation truth lives on the job, not the asset.** Prompt, model, settings, and context selections are recorded once on `generationJobs`. An asset points at the job that produced it. No duplication, and the "inspect generation settings / copy prompt" feature is a single join.
4. **`jsonb` only where the shape is genuinely provider/model-dependent** (generation settings, asset technical metadata). Everything the product filters or displays on gets a real column.
5. **`text` + `CHECK` instead of Postgres `ENUM` types.** Same integrity, painless to extend in a migration (no `ALTER TYPE` locking dance).
6. **`organizationId` on every table, including join tables' parents.** All list queries lead with the org key; child rows inherit tenancy through their parent FKs, so join tables don't repeat it.

---

## Entity relationship overview

```mermaid
erDiagram
    organization ||--o{ brands : owns
    organization ||--o{ products : owns
    organization ||--o{ characters : owns
    organization ||--o{ projects : owns
    organization ||--o{ folders : owns
    organization ||--o{ assets : owns
    organization ||--o{ tags : owns
    organization ||--o{ generationJobs : owns

    brands ||--o{ products : "usually parent of"
    brands }o--o{ characters : "brandCharacters"

    folders ||--o{ folders : "nests"
    folders ||--o{ assets : "contains"

    generationJobs ||--o{ assets : "produces"
    generationJobs }o--o{ assets : "uses as input (generationJobInputs)"
    generationJobs }o--|| brands : "optional context"
    generationJobs }o--|| products : "optional context"
    generationJobs }o--o{ characters : "generationJobCharacters"
    generationJobs }o--|| projects : "optional context"

    projects }o--o{ assets : "projectAssets"
    projects }o--o{ brands : "projectBrands"
    projects }o--o{ products : "projectProducts"
    projects }o--o{ characters : "projectCharacters"

    brands }o--o{ assets : "brandAssets (role)"
    products }o--o{ assets : "productAssets (role)"
    characters }o--o{ assets : "characterAssets (role)"

    tags }o--o{ assets : "assetTags"
```

---

## Conventions

- Primary keys: `text`, holding cuid2 ids (`@paralleldrive/cuid2`) generated in application code at insert time. No DB-side default — the app always supplies the id. All FK columns are `text` to match. (cuid2's random distribution means b-tree inserts scatter rather than append; a non-issue at MVP scale and an accepted trade-off of the id scheme.)
- All timestamps `timestamptz`, `createdAt`/`updatedAt` on every mutable table (`updatedAt` maintained by app code or one shared trigger).
- `createdBy text REFERENCES "user"(id)` on user-authored entities — the vision's asset metadata explicitly includes "creator". `ON DELETE SET NULL` so departing users never take content with them.
- Migration order matters once: `generationJobs` before `assets` (assets point at their producing job), `assets` before `generationJobInputs` (inputs reference both). Everything else follows the section order below.
- Soft delete (`deletedAt`) **only on `assets`** — it's the one entity with an explicit archive/restore product behavior and irreplaceable content. Everything else hard-deletes; join-table rows disappear via `ON DELETE CASCADE`.
- Naming: quoted `camelCase` identifiers, matching the Better Auth schema; plural table names for TaleLabs domain data. Quoting is required because PostgreSQL folds unquoted identifiers to lowercase.

---

## Schema

### 1. Brands — reusable identity context

MVP fields straight from the vision (name, description, tone, visual style, do/don't rules). Logos and reference images are **assets** linked through `brandAssets` with a `role` — never a single `logoUrl` column, because real brands have many logo variants.

```sql
CREATE TABLE brands (
    id              text PRIMARY KEY,
    "organizationId" text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
    "createdBy"      text REFERENCES "user"(id) ON DELETE SET NULL,
    name            text NOT NULL,
    description     text,
    "toneOfVoice"   text,
    "visualStyle"    text,
    "doRules"        text,   -- "always show the product in daylight"
    "dontRules"      text,   -- "never use competitor colors"
    colors          jsonb NOT NULL DEFAULT '[]',  -- [{ "name": "Primary", "hex": "#FF5A00" }, ...]
    "createdAt"      timestamptz NOT NULL DEFAULT now(),
    "updatedAt"      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "brands_organizationId_idx" ON brands ("organizationId");
```

`colors` is an ordered jsonb array of `{ name, hex }` objects rather than `text[]` of hex codes, because brand palettes are labeled (Primary, Secondary, Accent) and both the UI and prompt assembly want those labels. Validate shape app-side (Zod) on write; nothing filters on colors, so no index.

Later fields (audience, competitors, CTA examples) are plain `ALTER TABLE ... ADD COLUMN` migrations — don't pre-add them.

### 2. Products — reusable product context

Products *usually* belong to a brand, but the FK is nullable so a standalone product doesn't force fake brand creation. Product images are assets linked via `productAssets`.

```sql
CREATE TABLE products (
    id              text PRIMARY KEY,
    "organizationId" text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
    "createdBy"      text REFERENCES "user"(id) ON DELETE SET NULL,
    "brandId"        text REFERENCES brands(id) ON DELETE SET NULL,
    name            text NOT NULL,
    description     text,
    features        text[] NOT NULL DEFAULT '{}',
    benefits        text[] NOT NULL DEFAULT '{}',
    "createdAt"      timestamptz NOT NULL DEFAULT now(),
    "updatedAt"      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "products_organizationId_idx" ON products ("organizationId");
CREATE INDEX "products_brandId_idx" ON products ("brandId");
```

`features`/`benefits` are bullet lists the UI renders and prompts consume — `text[]` is the simplest honest shape. Landing-page URL, audience, positioning: add columns when the feature ships.

### 3. Characters — reusable character identity

Global (org-wide) by default. Never exclusively owned by a brand or project — both linkages are many-to-many (`brandCharacters`, `projectCharacters` below), because the vision says a character can be global, brand-specific, or reused across brands and projects (the agency case: one mascot serving several client brands). Reference images / sample videos / voice refs are assets via `characterAssets`.

Note the deliberate asymmetry with products: `products.brandId` is a single FK because products *belong to* a brand (ownership), while characters *relate to* brands (reuse).

```sql
CREATE TABLE characters (
    id              text PRIMARY KEY,
    "organizationId" text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
    "createdBy"      text REFERENCES "user"(id) ON DELETE SET NULL,
    name            text NOT NULL,
    role            text,   -- "spokesperson", "brand mascot", "AI influencer"
    description     text,
    personality     text,
    "visualNotes"    text,
    "createdAt"      timestamptz NOT NULL DEFAULT now(),
    "updatedAt"      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "characters_organizationId_idx" ON characters ("organizationId");
```

### 4. Projects — workspace/campaign containers

Simple containers and filters for MVP. They group reusable objects without owning them.

```sql
CREATE TABLE projects (
    id              text PRIMARY KEY,
    "organizationId" text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
    "createdBy"      text REFERENCES "user"(id) ON DELETE SET NULL,
    name            text NOT NULL,
    description     text,
    "createdAt"      timestamptz NOT NULL DEFAULT now(),
    "updatedAt"      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "projects_organizationId_idx" ON projects ("organizationId");
```

### 5. Folders — manual asset organization (tree)

Folders are org-wide (one shared drive per organization), matching the Drive-like mental model.

```sql
CREATE TABLE folders (
    id              text PRIMARY KEY,
    "organizationId" text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
    "parentId"       text REFERENCES folders(id) ON DELETE CASCADE,
    name            text NOT NULL,
    "createdAt"      timestamptz NOT NULL DEFAULT now(),
    "updatedAt"      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "folders_organizationId_idx" ON folders ("organizationId");
CREATE INDEX "folders_parentId_idx" ON folders ("parentId");
```

Adjacency list (`parentId`) is enough: folder trees are shallow and small per org; a recursive CTE handles breadcrumbs. No ltree/closure tables until proven necessary.

### 6. Generation jobs — the async work record

One row per generation request. This is where prompt, model, settings, context selections, and cost live. Apps are static config, so `appId` is just the config slug (e.g. `scene-builder`).

```sql
CREATE TABLE "generationJobs" (
    id              text PRIMARY KEY,
    "organizationId" text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
    "createdBy"      text REFERENCES "user"(id) ON DELETE SET NULL,

    "mediaType"      text NOT NULL CHECK ("mediaType" IN ('image', 'video', 'audio')),
    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'canceled')),

    provider        text NOT NULL,           -- 'openrouter', 'fal', 'direct:openai', ...
    model           text NOT NULL,           -- 'bytedance/seedance-2.0'
    "appId"          text,                    -- static-config app slug, NULL for free Generate
    prompt          text,                    -- the user's prompt exactly as typed
    "resolvedPrompt" text,                    -- final provider prompt, composed at job creation (see notes)
    settings        jsonb NOT NULL DEFAULT '{}',  -- aspect_ratio, duration, seed, quality, ...

    -- context selections (all optional; snapshot of what was picked in Generate)
    -- characters are many-per-job via "generationJobCharacters" below
    "brandId"        text REFERENCES brands(id)   ON DELETE SET NULL,
    "productId"      text REFERENCES products(id) ON DELETE SET NULL,
    "projectId"      text REFERENCES projects(id) ON DELETE SET NULL,

    "idempotencyKey" text NOT NULL,           -- client-supplied; unique per org below
    "requestHash"    text NOT NULL,           -- hash of the create body; detects key reuse with a different payload
    "creditSource"   text NOT NULL DEFAULT 'unmetered'
                    CHECK ("creditSource" IN ('unmetered', 'promotional', 'subscription', 'top_up')),
                    -- funding snapshot; drives output visibility (see notes)
    "creditCost"     integer,                 -- final charged cost; ledger comes later
    "errorCode"      text,                    -- stable failure class: 'content_policy', 'provider_timeout', ...
    "errorMessage"   text,                    -- human-readable, safe to display; raw provider payloads go to logs only
    "providerJobId" text,                    -- upstream async job reference for polling/webhooks
    "cancelRequestedAt" timestamptz,         -- set when cancel hits a running job; worker resolves final status

    "createdAt"      timestamptz NOT NULL DEFAULT now(),
    "startedAt"      timestamptz,
    "completedAt"    timestamptz
);

CREATE INDEX "generationJobs_organizationId_createdAt_idx" ON "generationJobs" ("organizationId", "createdAt" DESC);
CREATE INDEX "generationJobs_status_active_idx" ON "generationJobs" (status)
    WHERE status IN ('pending', 'running');
CREATE UNIQUE INDEX "generationJobs_organizationId_idempotencyKey_uidx"
    ON "generationJobs" ("organizationId", "idempotencyKey");
```

Characters are the one context that is genuinely many-per-job — a scene with two characters interacting is a core creative case, not an edge case — so they get a join table instead of a FK:

```sql
CREATE TABLE "generationJobCharacters" (
    "jobId"       text NOT NULL REFERENCES "generationJobs"(id) ON DELETE CASCADE,
    "characterId" text NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    "createdAt"   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("jobId", "characterId")
);

CREATE INDEX "generationJobCharacters_characterId_idx" ON "generationJobCharacters" ("characterId");
```

Notes:

- One brand and one product per job matches the Generate form: a generation runs under a single brand identity and a single product's context. If a real multi-brand/multi-product case ever appears, the promotion path is the same join-table pattern.
- `settings` is the one legitimately polymorphic blob: its shape is defined by provider catalog + app config, validated app-side (Zod) before insert.
- The partial index on active statuses keeps the worker's "what needs polling" query fast forever, no matter how many millions of finished jobs accumulate.
- **Provenance = `resolvedPrompt`, composed at job creation.** `prompt` is the user's raw input; `resolvedPrompt` is the final provider prompt, assembled from brand/product/character context **at `POST /generations` time** and stored on the row. This is deliberate: the user gets exactly the context they saw when they clicked Generate; editing or deleting a brand while the job is queued cannot change what runs; and the worker becomes a dumb executor of a stored payload. Together with `settings` and `generationJobInputs` (image context, pinned to immutable objects), that is the complete provider request. A full `contextSnapshot` jsonb of entity rows was considered and rejected: create-time prompt resolution already snapshots everything the provider will see, without duplicating entity data on every job. If entity edit *history* ever becomes a product need, that's an entity-versioning feature, not a job column.
- **`creditSource` is the funding snapshot, decided server-side at create.** `'unmetered'` is the Phase 1 value: while the core loop ships without a credit system, every job defaults to it and outputs stay **private** — the engineering phase is not coupled to a billing model that doesn't exist yet. When credits launch (Phase 2), welcome-credit generations become `'promotional'` (→ public outputs); `subscription`/`top_up` → private. One credit bucket per job — never split across promotional and paid, or output visibility becomes ambiguous; if promotional credits don't cover a job, it runs entirely on paid credits.
- **Idempotency:** the unique `(organizationId, idempotencyKey)` index makes retried creates return the original job. `requestHash` distinguishes a retry (same body → same job) from key misuse (same key, different body → API `409`).
- **Cancellation is two-phase.** A `pending` job cancels immediately (worker never started). A `running` job only gets `cancelRequestedAt` stamped; the worker observes it, attempts provider-side cancellation, and writes the terminal status — because the upstream model may keep running (and billing) regardless of what our row says. `status` never claims `canceled` before it's true.
- Input reference images are a separate table because a job can use several, each with a meaning:

```sql
CREATE TABLE "generationJobInputs" (
    "jobId"     text NOT NULL REFERENCES "generationJobs"(id) ON DELETE CASCADE,
    "assetId"   text NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    role       text NOT NULL DEFAULT 'reference'
               CHECK (role IN ('reference', 'first_frame', 'last_frame', 'source_image', 'audio_reference')),
    "sortOrder" smallint NOT NULL DEFAULT 0,
    PRIMARY KEY ("jobId", "assetId", role)
);

CREATE INDEX "generationJobInputs_assetId_idx" ON "generationJobInputs" ("assetId");
```

The reverse index answers the asset-detail question "where has this been used as a reference?".

**Why asset-only inputs are enough (brands/characters included):** every piece of media in the system is an asset — brands, products, and characters never own media directly, they only link to assets through their kit tables. So "use this character's reference image as the first frame" is just a `generationJobInputs` row whose `assetId` happens to also appear in `characterAssets`. Entity-level context ("this job used brand X / characters Y and Z") is not an input file and lives on the job's `brandId`/`productId` columns and `generationJobCharacters` rows, where prompt assembly consumes it.

What this table deliberately does not store is provenance — whether an input was auto-attached from a selected character/brand kit or manually added by the user, and (with multiple characters on a job) which character an input belongs to. Both are reconstructable at read time by joining `assetId` against the kit tables for the job's selected entities — a reference image identifies its character through `characterAssets`. Only promote to stored columns (`contextSource`, `characterId`) if the UI needs the distinction and the joins prove awkward.

### 7. Assets — the global media library

The heart of the system. Every generated output and every upload becomes a row here. Generation metadata is *not* duplicated — it lives on the job.

```sql
CREATE TABLE assets (
    id                text PRIMARY KEY,
    "organizationId"   text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
    "createdBy"        text REFERENCES "user"(id) ON DELETE SET NULL,

    name              text NOT NULL,
    type              text NOT NULL
                      CHECK (type IN ('image', 'video', 'audio', 'document', 'font')),
    source            text NOT NULL
                      CHECK (source IN ('upload', 'generation', 'export')),

    "storageKey"       text NOT NULL,      -- R2 object key
    visibility        text NOT NULL DEFAULT 'private'
                      CHECK (visibility IN ('public', 'private')),  -- which bucket; see note
    "thumbnailKey"     text,               -- pre-rendered preview (video poster, image thumb)
    "mimeType"         text NOT NULL,
    "sizeBytes"        bigint,
    width             integer,            -- image/video
    height            integer,            -- image/video
    "durationSeconds"  numeric(10,3),      -- video/audio

    "folderId"         text REFERENCES folders(id) ON DELETE SET NULL,
    "generationJobId" text REFERENCES "generationJobs"(id) ON DELETE SET NULL,
    "uploadId"         text,               -- one-time upload-grant id; unique below → replay-safe registration

    favorite          boolean NOT NULL DEFAULT false,
    "featuredAt"       timestamptz,          -- curated landing-gallery placement; public ≠ featured (see note)
    metadata          jsonb NOT NULL DEFAULT '{}',  -- codec, fps, color profile, exif, ...

    "createdAt"        timestamptz NOT NULL DEFAULT now(),
    "updatedAt"        timestamptz NOT NULL DEFAULT now(),
    "deletedAt"        timestamptz          -- archive; NULL = live
);

CREATE INDEX "assets_organizationId_createdAt_idx" ON assets ("organizationId", "createdAt" DESC)
    WHERE "deletedAt" IS NULL;
CREATE INDEX "assets_organizationId_type_idx" ON assets ("organizationId", type)
    WHERE "deletedAt" IS NULL;
CREATE INDEX "assets_folderId_idx" ON assets ("folderId") WHERE "deletedAt" IS NULL;
CREATE INDEX "assets_generationJobId_idx" ON assets ("generationJobId");
CREATE UNIQUE INDEX "assets_uploadId_uidx" ON assets ("uploadId") WHERE "uploadId" IS NOT NULL;
CREATE INDEX "assets_organizationId_favorite_idx" ON assets ("organizationId")
    WHERE favorite AND "deletedAt" IS NULL;
```

Notes:

- `visibility` records **which bucket the object was written to** — the public showcase bucket or the private bucket behind signed URLs. The rule is driven by **the generation's credit funding source, never the user's plan**:

  ```txt
  Uploads                                  -> always private
  Unmetered generations (pre-credit phase) -> private
  Promotional-credit generations           -> public (workspace-owned, showcase-eligible)
  Subscription-credit generations          -> private
  Top-up-credit generations                -> private
  ```

  It is a write-time snapshot (from `generationJobs.creditSource`), not a live lookup: funding and plans change but objects don't move, so URL construction derives from this column only. Obligations that travel with this design: (1) **the Generate UI must state up front that promotional-credit generations are public and may be featured**, and the ToS must grant TaleLabs display permission while the user keeps ownership — consent, not just infrastructure; (2) privatizing existing public assets (e.g. a courtesy on upgrade) is an explicit background migration (move object, flip column), never implicit. A future opt-in publish/unpublish flow layers on top without changing this column's meaning. Bucket-name mapping per visibility value lives in static config.
- `featuredAt` separates **public from featured**: every promotional output is public and gallery-*eligible*, but landing-page placement is curated — an internal action stamps `featuredAt`, and the gallery queries `WHERE visibility = 'public' AND featuredAt IS NOT NULL AND deletedAt IS NULL` — archiving an asset removes it from the gallery immediately. This keeps low-quality, unsafe, or copyright-risky generations off the landing page by default. If curation ever needs a real review pipeline, a `galleryStatus` value (`pending`/`approved`/`rejected`) replaces this column then — not now.
- `generationJobId` on the asset (rather than `outputAssetId` on the job) is deliberate: one job can produce multiple outputs (n-image batches, video + poster frame), and uploads simply have `NULL`.
- One job → multiple assets also means "duplicate/copy asset" is a plain row copy pointing at the same job.
- `favorite` is org-wide for MVP. If per-user favorites become a requirement, replace the boolean with a `userAssetFavorites(userId, assetId)` table — don't build it speculatively.
- `uploadId` is the durable one-time-use record for the presigned-upload flow. The column stores the **short grant id carried inside the signed token — never the token itself** (no capability tokens at rest). The token is stateless (binds grant id, org, user, object key, mime, size, expiry); the partial unique index on the grant id makes registration replay-safe — re-registering the same grant returns the existing asset instead of minting duplicates. `NULL` for generated/exported assets.
- The `source = 'export'` value is ready for future Studio cuts with zero migration.
- Search for MVP: `ILIKE` on `name` is fine. When it gets slow, add `CREATE EXTENSION pg_trgm;` and a trigram GIN index on `name` — no schema change needed, so don't add it day one.

### 8. Tags

```sql
CREATE TABLE tags (
    id              text PRIMARY KEY,
    "organizationId" text NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
    name            text NOT NULL,
    "createdAt"      timestamptz NOT NULL DEFAULT now(),
    UNIQUE ("organizationId", name)
);

CREATE TABLE "assetTags" (
    "assetId"   text NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    "tagId"     text NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("assetId", "tagId")
);

CREATE INDEX "assetTags_tagId_idx" ON "assetTags" ("tagId");
```

### 9. Relationship tables (the "workspace relationship layer")

These tables are what make projects "organize without owning" and let brands/products/characters carry their own asset kits. Rows cascade away when either side is deleted; the assets themselves survive.

**Known tradeoff — cross-org integrity is service-layer only for MVP.** Nothing at the DB level prevents a `projectAssets` row pairing a project from org A with an asset from org B; every write that links two entities must verify both sides share the caller's `organizationId`. This is acceptable at MVP scale with a single service codepath doing the inserts, but the discipline must be exhaustive. The full checklist of writes needing the org check:

Join-table inserts (both sides same org):

```txt
projectAssets, projectBrands, projectProducts, projectCharacters
brandCharacters, brandAssets, productAssets, characterAssets
assetTags
generationJobInputs, generationJobCharacters
```

Plain FK columns on insert/update (referenced row same org as the new row):

```txt
products.brandId
assets.folderId, assets.generationJobId
generationJobs.brandId, generationJobs.productId, generationJobs.projectId
folders.parentId
```

The DB-enforced upgrade path, when warranted: add `UNIQUE (id, organizationId)` to each parent table, repeat `organizationId` on the join tables, and declare composite FKs like `FOREIGN KEY (projectId, organizationId) REFERENCES projects (id, organizationId)` — then Postgres itself rejects cross-tenant rows (and covers the plain-FK cases the same way). Purely additive migration; don't pay the column/index overhead until there's more than one write path.

```sql
-- Brand ↔ Character: a character can be global, brand-specific, or shared across brands.
CREATE TABLE "brandCharacters" (
    "brandId"     text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    "characterId" text NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    "createdAt"   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("brandId", "characterId")
);
CREATE INDEX "brandCharacters_characterId_idx" ON "brandCharacters" ("characterId");
```

```sql
-- Project ↔ Asset: attach any asset to any number of projects.
CREATE TABLE "projectAssets" (
    "projectId" text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    "assetId"   text NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("projectId", "assetId")
);
CREATE INDEX "projectAssets_assetId_idx" ON "projectAssets" ("assetId");

-- Project ↔ context objects (reusable across projects, so many-to-many).
CREATE TABLE "projectBrands" (
    "projectId" text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    "brandId"   text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("projectId", "brandId")
);
CREATE INDEX "projectBrands_brandId_idx" ON "projectBrands" ("brandId");

CREATE TABLE "projectProducts" (
    "projectId" text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    "productId" text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("projectId", "productId")
);
CREATE INDEX "projectProducts_productId_idx" ON "projectProducts" ("productId");

CREATE TABLE "projectCharacters" (
    "projectId"   text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    "characterId" text NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    "createdAt"   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("projectId", "characterId")
);
CREATE INDEX "projectCharacters_characterId_idx" ON "projectCharacters" ("characterId");
```

```sql
-- Brand ↔ Asset with a role: the multi-logo Brand Kit.
CREATE TABLE "brandAssets" (
    "brandId"   text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    "assetId"   text NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    role       text NOT NULL DEFAULT 'reference'
               CHECK (role IN (
                   'logo_primary', 'logo_horizontal', 'logo_icon', 'logo_wordmark',
                   'logo_light', 'logo_dark', 'logo_mono',
                   'reference', 'approved_output'
               )),
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("brandId", "assetId", role)
);
CREATE INDEX "brandAssets_assetId_idx" ON "brandAssets" ("assetId");

-- Product ↔ Asset with a role.
CREATE TABLE "productAssets" (
    "productId" text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    "assetId"   text NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    role       text NOT NULL DEFAULT 'reference'
               CHECK (role IN ('source_image', 'packaging', 'lifestyle', 'reference', 'approved_output')),
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("productId", "assetId", role)
);
CREATE INDEX "productAssets_assetId_idx" ON "productAssets" ("assetId");

-- Character ↔ Asset with a role.
CREATE TABLE "characterAssets" (
    "characterId" text NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    "assetId"     text NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    role         text NOT NULL DEFAULT 'reference_image'
                 CHECK (role IN (
                     'reference_image', 'expression_sheet', 'pose_sheet',
                     'sample_video', 'sample_audio', 'voice_reference', 'approved_output'
                 )),
    "createdAt"   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("characterId", "assetId", role)
);
CREATE INDEX "characterAssets_assetId_idx" ON "characterAssets" ("assetId");
```

The `role` CHECK lists mirror the vision doc verbatim. Extending a CHECK constraint is a one-line migration; that friction is a feature — it keeps roles a deliberate product vocabulary instead of free-text drift.

---

## How the product flows map to this schema

**Generate an image with brand + product + character context inside a project:**

1. `INSERT INTO generationJobs (..., brandId, productId, projectId, status='pending')` + one `generationJobCharacters` row per selected character
2. Reference uploads → rows in `assets` (`source='upload'`) + `generationJobInputs`
3. Worker runs the job, uploads output to storage
4. `INSERT INTO assets (source='generation', generationJobId=...)`
5. Because the job had `projectId`, also `INSERT INTO projectAssets` — this is the "anything generated inside a project auto-relates to it" rule, enforced in the service layer

**`/assets` (global library):** `SELECT ... FROM assets WHERE organizationId = $1 AND deletedAt IS NULL ORDER BY createdAt DESC` + optional predicates on `type`, `folderId`, `favorite`, `source`, tag join, or context joins.

**`/projects/:id/assets`:** the same query joined through `projectAssets` — one asset system, filtered, exactly as the vision demands.

**Asset detail panel:** `assets` row + join `generationJobs` (prompt/model/settings/cost/context) + `generationJobInputs` (references used) + tag/project/brand/product/character joins for the relationship chips.

**Brand Kit screen:** `brandAssets WHERE brandId = $1` grouped by `role`.

**"Where is this character used?":** `generationJobCharacters WHERE characterId = $1` and `characterAssets WHERE characterId = $1`.

---

## Future-proofing

Seams that are already in place — none require speculative tables today:

- **Credits/billing:** `generationJobs.creditCost` already records spend per job. When billing ships, the lifecycle is: estimate (advisory) → **atomically reserve credits and create the job** → provider execution → capture on success / release on failure or cancel — with reservation and ledger tables attaching to `generationJobs.id`. Price is always computed server-side from the create body; a client-displayed estimate is never the charged amount. Policy needed then (not now): provider-accepted jobs that later fail, cancellation after provider spend, and actual cost diverging from estimate.
- **Apps:** `generationJobs.appId` records which static-config app produced a job; when apps move to DB-managed config, this text slug becomes an FK.
- **Boards / Studio cuts / Workflows:** each becomes a new entity plus one `projectX` join table and (for cuts) `source='export'` assets — the asset and project models absorb them without change.
- **Voices:** a `voices` table + `characterId` FK later; `characterAssets.role='voice_reference'` already stores raw material.
- **Multi-brand/multi-product jobs:** characters are already many-per-job via `generationJobCharacters`; if brand or product ever needs the same, promote the FK with the identical join-table pattern.
- **DB-enforced tenant isolation:** composite-FK recipe documented in the relationship-tables section; apply when write paths multiply.
- **Per-user favorites:** swap `assets.favorite` for a `userAssetFavorites` join table if org-wide favorites prove wrong.

## What was deliberately not built

- No polymorphic `entityLinks` table — Postgres can't FK-check it, and we have exactly four link types.
- No `assetVersions` table — "duplicate" is a new asset row; version trees are a later product idea.
- No DB-stored model/app/preset catalogs — static config + provider APIs, per the configuration strategy.
- No full-text search infrastructure — `ILIKE` first, `pg_trgm` when it hurts, both without schema changes.
- No per-table audit/history tables — `createdAt`/`updatedAt` plus job rows already tell the MVP story.
