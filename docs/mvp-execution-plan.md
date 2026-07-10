# TaleLabs MVP Execution Plan

This document turns the approved TaleLabs product, database, and API designs into small implementation sessions. It is an execution checklist, not a replacement for the source-of-truth design documents.

Read these before starting any task:

```txt
AGENTS.md
docs/talelabs-product-vision.md
docs/db-design-planning.md
docs/api-design-planning.md
docs/mvp-execution-plan.md
```

## Goal

Build and validate the first creative loop:

```txt
Brands + Products + Characters
-> Generate
-> Assets
-> Projects
```

The implementation should progress through small, reviewable vertical slices. Each task should fit in one focused AI session, produce a testable result, and stop before pulling in the next task.

## Current Scope

The Phase 1 product navigation remains:

```txt
Generate
Assets
Projects
Brands
Products
Characters
```

Explicitly deferred:

```txt
credit wallets and balance enforcement
subscriptions and Stripe billing
public gallery UI
boards
workflows
studio/editor
agent
voices as a standalone resource
public API and MCP
realtime generation subscriptions
bulk asset operations
```

Database seams for later features may exist, but deferred systems must not be implemented during the core-loop tasks.

## How To Execute A Task

Use one task per AI session unless the task explicitly says otherwise.

For every task:

1. Read the source-of-truth documents and the relevant package `AGENTS.md` files.
2. Inspect the current implementation and dirty worktree before editing.
3. Implement only the task's stated scope.
4. Add validation proportional to the change.
5. Run the listed checks.
6. Review the diff for accidental scope expansion.
7. Manually validate the user-visible behavior when applicable.
8. Record any design decision that changes the API or database documents.
9. Stop when the acceptance criteria are met.

Do not combine an API task, a large UI task, and visual polish into one session. Major screens deliberately use this rhythm:

```txt
backend contract
-> functional UI
-> separate QA and design critique
```

## Definition Of Done

A task is complete only when:

- Its acceptance criteria are satisfied.
- Relevant builds and type checks pass.
- API changes remain represented in OpenAPI.
- SDK output is regenerated when the OpenAPI contract changes.
- Tenant-owned queries are scoped by `organizationId`.
- Loading, empty, error, and success states are handled where relevant.
- No unrelated files or user changes were reverted.
- Deferred features were not pulled into the task.

For UI QA tasks, also verify:

- Desktop and mobile layouts.
- Keyboard navigation and visible focus.
- Empty, loading, error, populated, and destructive-action states.
- Long names, missing thumbnails, failed media, and slow network behavior.
- No text overflow or incoherent overlap.
- Browser console and network requests are clean.

## Milestones

| Milestone | Outcome |
|---|---|
| M0: Data foundation | The full MVP schema migrates successfully and is type-safe in Kysely. |
| M1: Reusable context | Projects, Brands, Products, and Characters work end to end. |
| M2: Asset foundation | Private uploads become reusable assets in the global library. |
| M3: Context relationships | Assets and context objects can be linked and filtered correctly. |
| M4: Image generation loop | An image generation becomes an asset and can attach to a project. |
| M5: Video and audio | The same loop works for supported video and audio models. |
| M6: Internal MVP candidate | The complete loop passes tenancy, reliability, and UI QA. |

---

## M0 - Data And Contract Foundation

### E-001 - Implement And Run The MVP Database Migration

**Status:** Next

This is the first implementation task.

**Scope**

- Create the next Kysely migration, expected to be `packages/db/src/migrations/003_talelabs_mvp.ts`.
- Preserve the applied `003` migration and use `004_camel_case_domain_schema.ts` to align TaleLabs physical identifiers with Better Auth's quoted camelCase convention.
- Implement every table, foreign key, check constraint, index, and delete behavior from `docs/db-design-planning.md`.
- Add the corresponding Kysely table interfaces to `packages/db/src/schema.ts` and register them in `Database`.
- Implement a complete `down` migration in reverse dependency order.
- Run the migration against the development database.

**Required creation order**

```txt
brands
products
characters
projects
folders
generationJobs
assets
generationJobCharacters
generationJobInputs
tags
assetTags
brandCharacters
projectAssets
projectBrands
projectProducts
projectCharacters
brandAssets
productAssets
characterAssets
```

`assets` must exist before `generationJobInputs`, even though inputs are discussed in the generation section of the design document. Migration `003` creates the original identifiers in this order; migration `004` renames them to the final camelCase form without rebuilding tables.

**Naming constraint**

Better Auth and TaleLabs domain tables use quoted camelCase identifiers. Do not add a global Kysely camel-case plugin: Kysely properties should match the physical identifiers directly, and PostgreSQL DDL must quote camelCase table and column names.

**Acceptance criteria**

- A clean database migrates from `001` through `004` successfully.
- Running the migrator again reports no pending migration and changes nothing.
- All planned tables and indexes exist.
- Check constraints reject invalid status, media type, visibility, source, role, and credit-source values.
- Foreign-key delete behavior matches the DB document.
- Existing auth and organization tables still work.
- `Database` contains all new table types without using `any`.
- No API routes, repositories, seed data, or UI are added in this task.

**Validation**

```bash
npm run build -w @talelabs/db
npm run db:migrate
```

Also inspect PostgreSQL metadata for the created tables, indexes, and constraints. Test `down` only against a disposable database, never against shared or production data.

### E-002 - Add Database Test Fixtures And Tenant-Safe Query Conventions

**Status:** Blocked by E-001

**Scope**

- Add a minimal database test strategy for domain queries.
- Create reusable fixtures for two organizations, users, and members.
- Establish helpers that require `organizationId` for tenant-owned reads and writes.
- Document that domain persistence and service objects both use camelCase identifiers.

**Acceptance criteria**

- Tests can prove an organization cannot read or mutate another organization's row through repository/query helpers.
- Tests clean up their data and do not depend on production credentials.
- No resource-specific CRUD is implemented yet.

### E-003 - Harden The Shared API Foundation

**Status:** Blocked by E-001

**Scope**

- Confirm auth middleware resolves the current Better Auth session and active organization.
- Add shared id, error, and cursor-pagination schemas.
- Standardize `401`, tenant-safe `404`, validation errors, and request IDs.
- Add an API test harness using the composed Hono app rather than a live network port.

**Acceptance criteria**

- Protected test route behavior covers unauthenticated, missing active organization, and authenticated organization cases.
- Error responses match `docs/api-design-planning.md`.
- `/openapi.json` remains valid.

**Checks**

```bash
npm run build -w api
npm run lint
```

### E-004 - Verify OpenAPI To SDK Generation

**Status:** Blocked by E-003

**Scope**

- Confirm the API OpenAPI document can generate `@talelabs/sdk` successfully.
- Add one representative authenticated endpoint to prove schemas, client generation, and TanStack Query integration.
- Do not manually edit generated SDK files.

**Acceptance criteria**

- SDK generation is deterministic.
- Generated client types preserve error and pagination shapes.
- Dashboard can import the generated query/client without handwritten fetch code.

**Checks**

```bash
npm run sdk:generate
npm run build -w @talelabs/sdk
```

---

## M1 - Reusable Context Objects

Projects are implemented first because they are the simplest vertical slice and establish the CRUD, tenancy, OpenAPI, SDK, query, form, and routing patterns reused by the richer context resources.

### E-010 - Projects CRUD API

**Status:** Blocked by M0

Implement project list, create, detail, update, and delete endpoints with cursor pagination, organization scoping, OpenAPI schemas, service/data boundaries, and integration tests. Do not implement project relationships or the project Assets tab yet.

### E-011 - Projects Functional UI

**Status:** Blocked by E-010

Implement project list, create, detail, rename/edit, and delete flows using generated SDK hooks. Include loading, empty, error, and populated states. Keep the project detail surface intentionally thin.

### E-012 - Projects UI QA And Design Critique

**Status:** Blocked by E-011

Test the complete Projects flow in the browser, capture desktop/mobile screenshots, critique hierarchy and interaction cost, then make only evidence-backed polish changes. Verify refresh, direct URLs, long names, destructive confirmation, and empty states.

### E-013 - Brands CRUD API

**Status:** Blocked by M0

Implement brand profile CRUD, including color validation and safe nullable PATCH behavior. Exclude Brand Kit asset relationships until Assets exist.

### E-014 - Brands Functional UI

**Status:** Blocked by E-013

Implement brand list, create, detail, and edit surfaces for name, description, tone, visual style, colors, and do/don't rules. Show a disabled or intentional empty Brand Kit area rather than faking asset support.

### E-015 - Brands UI QA And Design Critique

**Status:** Blocked by E-014

Validate form ergonomics, palette controls, long guidance text, unsaved changes, mobile layout, and empty/error behavior. Keep the screen operational rather than marketing-like.

### E-016 - Products CRUD API

**Status:** Blocked by E-013

Implement product CRUD and optional `brandId`, including same-organization validation and list filtering by brand. Exclude product assets until Assets exist.

### E-017 - Products Functional UI

**Status:** Blocked by E-016

Implement product list/create/detail/edit with brand selection, description, features, and benefits. Use field arrays with clear add/remove behavior.

### E-018 - Products UI QA And Design Critique

**Status:** Blocked by E-017

Validate standalone products, branded products, long feature lists, brand deletion effects, mobile forms, and destructive actions.

### E-019 - Characters CRUD API

**Status:** Blocked by E-013

Implement character CRUD, brand filtering, and atomic `brandIds` behavior on creation. Implement the explicit brand-character link endpoints. Exclude character assets until Assets exist.

### E-020 - Characters Functional UI

**Status:** Blocked by E-019

Implement character list/create/detail/edit with role, description, personality, visual notes, and brand relationships. Do not build talking-avatar or voice infrastructure.

### E-021 - Characters UI QA And Design Critique

**Status:** Blocked by E-020

Validate global and brand-linked characters, multi-brand display, long character descriptions, removal from a brand, responsive behavior, and empty states.

**M1 gate**

A user can create and manage Projects, Brands, Products, and Characters in one organization without seeing another organization's data.

---

## M2 - Storage And Global Assets

### E-030 - Harden The R2 Storage Boundary

**Status:** Blocked by M0

**Scope**

- Confirm private/public bucket configuration remains code-level while credentials remain in environment variables.
- Add organization-safe object-key builders.
- Keep bucket selection behind `visibility`.
- Verify upload, inline download, attachment download, copy, and delete primitives.
- Do not expose storage credentials or raw storage keys to the browser.

**Acceptance criteria**

- Private objects require signed URLs.
- Public URL construction is deterministic but unused for Phase 1 unmetered generation.
- Object keys cannot collide across organizations.
- Storage package tests use isolated test prefixes and clean up objects.

### E-031 - Presigned Upload And Asset Registration API

**Status:** Blocked by E-030 and E-003

Implement `POST /uploads` and `POST /assets` for private uploads. The signed grant must bind grant ID, organization, user, key, MIME type, size, and expiry. Registration must verify the object with R2, store only the grant ID, be replay-safe, and optionally attach the asset to a project.

Do not implement thumbnails or media analysis beyond the minimum metadata needed to register the asset; those get a separate task.

### E-032 - Asset Read API

**Status:** Blocked by E-031

Implement global asset list and detail endpoints with signed/public opaque URLs, core filters, stable cursor pagination, and tenant-safe relationship data. Start with filters supported by existing data; do not fake tags or kit relationships before their tasks.

### E-033A - Asset Upload UI

**Status:** Blocked by E-032 and E-004

Implement file selection, upload progress, registration, cancellation, validation errors, and upload-inside-project support using the generated SDK. Stop after newly uploaded assets can appear in a simple result state.

### E-033B - Asset Library List UI

**Status:** Blocked by E-033A

Implement the global Assets screen with grid/list foundation, media-type filter, search, pagination/load-more, selection, and honest placeholders for missing thumbnails or non-previewable assets. Do not build the detail panel in this task.

### E-033C - Asset Detail UI

**Status:** Blocked by E-033B

Implement the asset detail panel with media preview, technical metadata, provenance, relationships available at this phase, download, and clear handling for expired URLs or failed media.

### E-034 - Asset Metadata And Thumbnail Processing

**Status:** Blocked by E-031

Add asynchronous metadata extraction and thumbnail/poster generation for supported image, video, and audio uploads. Persist width, height, duration, thumbnail key, and technical metadata without blocking registration.

### E-035A - Core Asset Actions API

**Status:** Blocked by E-032

Implement rename, favorite, archive, restore, duplicate, and attachment-download contracts. A duplicate must get a new asset row, clear `uploadId` and `featuredAt`, and preserve only intentional provenance fields.

### E-035B - Core Asset Actions UI

**Status:** Blocked by E-035A and E-033C

Connect rename, favorite, archive, restore, duplicate, and download to the asset list/detail UI. Add confirmations and optimistic updates only where rollback behavior is clear.

### E-036A - Folders API

**Status:** Blocked by E-032

Implement folder tree list/create/rename/move/delete, asset move-to-folder, root handling, cycle prevention, and tests proving that deleting a folder returns its assets to root rather than deleting them.

### E-036B - Folders UI

**Status:** Blocked by E-036A and E-033B

Implement folder navigation, breadcrumbs, create/rename/move/delete interactions, move-asset flow, root browsing, and folder-filtered asset URLs.

### E-037A - Tags And Advanced Asset Filter API

**Status:** Blocked by E-032

Implement tag list/create/delete, declarative asset tag replacement, case/whitespace normalization, AND tag filtering, source filtering, favorites, archive filtering, and stable sorting.

### E-037B - Tags And Advanced Asset Filter UI

**Status:** Blocked by E-037A and E-033B

Implement tag editing and URL-backed source, favorite, archive, tag, type, and sort controls. Verify browser back/forward and refresh preserve the selected library view.

### E-038 - Assets UI QA And Design Critique

**Status:** Blocked by E-033A through E-037B

Run a dedicated media-library QA pass with many assets, mixed media, nested folders, missing previews, failed thumbnails, long names, archived assets, slow uploads, mobile layout, and keyboard operation. Critique whether the screen feels like a lightweight media drive rather than a social gallery.

**M2 gate**

A user can upload private media, find it again, inspect it, organize it, and reuse it as a stable asset.

---

## M3 - Context And Project Relationships

### E-040 - Brand Asset Kit API

**Status:** Blocked by M2 and E-013

Implement brand asset list/link/unlink endpoints, role validation, media-type compatibility, idempotency/conflict behavior, and tenant tests.

### E-041 - Brand Kit UI

**Status:** Blocked by E-040

Add asset picking/uploading and role assignment for primary, horizontal, icon, wordmark, light, dark, monochrome, reference, and approved-output assets. Reuse the global asset picker rather than building a second media system.

### E-042A - Product Asset Kit API

**Status:** Blocked by M2 and E-016

Implement product asset list/link/unlink, role validation, media compatibility, organization checks, and tests for source images, packaging, lifestyle, references, and approved outputs.

### E-042B - Product Asset Kit UI

**Status:** Blocked by E-042A

Add product asset picking/uploading, role assignment, unlinking, and grouped kit display by reusing the global asset picker.

### E-043A - Character Asset Kit API

**Status:** Blocked by M2 and E-019

Implement character asset list/link/unlink, role validation, media compatibility, organization checks, and tests for reference images, expression sheets, pose sheets, sample video/audio, voice references, and approved outputs.

### E-043B - Character Asset Kit UI

**Status:** Blocked by E-043A

Add character asset picking/uploading, role assignment, unlinking, and grouped kit display. This is asset organization, not voice cloning or avatar generation.

### E-044 - Project Relationship APIs

**Status:** Blocked by E-010 and M2

Implement idempotent project links for assets, brands, products, and characters. Return project detail counts and small linked context lists. Keep assets unbounded and fetched through `GET /assets?projectId=...`.

### E-045 - Project Context And Assets UI

**Status:** Blocked by E-044

Implement the project detail context sections and Assets tab using the global Assets components with a fixed project filter. Add upload-inside-project and attach-existing-asset flows.

### E-046 - Relationship Integrity QA

**Status:** Blocked by E-040 through E-045, including the split A/B tasks

Test cross-organization rejection for every relationship table, duplicate links, unlink behavior, hard deletion of context objects, archived assets, and shared assets linked to multiple projects or kits.

**M3 gate**

Projects, Brands, Products, and Characters all reuse the same global assets without owning or duplicating media.

---

## M4 - Image Generation Loop

Image generation proves the complete architecture before video and audio multiply provider cost, duration, and failure modes.

### E-050 - Generation Configuration Registry

**Status:** Blocked by M0

Implement validated static model overrides and app/preset config, provider-catalog normalization, and `GET /config/generation`. Start with a deliberately small enabled image-model set. Validate config at startup and expose only capabilities needed by the UI.

### E-051 - Generation Job API Without Provider Execution

**Status:** Blocked by E-050 and M3

Implement create, list, detail, and cancel contracts; idempotency; request hashing; provider/model validation; context resolution; `resolvedPrompt`; input links; and Phase 1 `creditSource = 'unmetered'`. Use a controlled fake executor so job states and outputs can be tested without provider spend.

Do not implement `/generations/estimate`; it remains Phase 2.

### E-052 - Trigger.dev Generation Orchestration

**Status:** Blocked by E-051

Create the durable Trigger.dev task that receives `organizationId` and `generationJobId`, transitions job states, handles retry boundaries, observes cancellation, and records safe failures. Keep provider logic behind an adapter interface.

### E-053 - OpenRouter Image Provider Adapter

**Status:** Blocked by E-052

Implement one production image model through the OpenRouter package. Normalize the request and result behind the provider adapter, preserve provider diagnostics only in logs, and add controlled integration tests that do not run by default without credentials.

### E-054 - Generation Output Ingestion

**Status:** Blocked by E-053 and M2

Download/copy provider outputs into R2, create generation assets, generate thumbnails/metadata, attach outputs to the selected project, and mark the job succeeded only after durable storage and database writes complete. Phase 1 outputs are private because jobs are unmetered.

### E-055 - Generate Image Functional UI

**Status:** Blocked by E-054

Implement the Image tab with model picker, prompt, aspect ratio/quality controls, references, submit state, polling, result display, and saved asset behavior. Use generated SDK hooks and keep drafts local.

### E-056 - Reusable Context In Generate

**Status:** Blocked by E-055

Add brand, product, character, and project selection to Image generation. Show which context and reference assets will be used. Verify the server resolves the prompt at creation and later context edits do not change queued jobs.

### E-057 - Image Generation Failure And UX QA

**Status:** Blocked by E-056

Exercise pending, running, slow, succeeded, failed, canceled, duplicate-submit, unsupported-model, missing-reference, provider-timeout, and output-ingestion-failure paths. Critique the Generate UX separately from implementation and polish only proven problems.

**M4 gate**

A user can select reusable context, generate an image asynchronously, receive a durable private asset, find it in Assets, and see it inside the selected project.

---

## M5 - Video And Audio Generation

### E-060 - Video Model Configuration And Provider Adapter

**Status:** Blocked by M4

Enable a small supported video-model set and implement text-to-video plus image-to-video through the existing provider abstraction. Validate duration, resolution, aspect ratio, first/last frame, audio capability, and reference limits from resolved config.

### E-061 - Generate Video Functional UI

**Status:** Blocked by E-060

Implement the Video tab using the existing generation composer patterns. Support model-dependent inputs without rendering controls the selected model cannot accept.

### E-062 - Video Reliability And UI QA

**Status:** Blocked by E-061

Test long-running polling, browser refresh, cancel requests, provider failures, large downloads, R2 ingestion, poster generation, playback, mobile layout, and project attachment.

### E-063 - Audio Model Configuration And Provider Adapter

**Status:** Blocked by M4

Enable one narrow audio outcome supported by the chosen providers, such as text-to-speech or voiceover. Do not add voice cloning, music generation, or standalone Voice entities unless separately approved.

### E-064 - Generate Audio Functional UI

**Status:** Blocked by E-063

Implement the Audio tab, appropriate text/settings controls, async state, playback, download, asset persistence, and project attachment.

### E-065 - Audio Reliability And UI QA

**Status:** Blocked by E-064

Test playback, duration metadata, failed jobs, cancellation, slow generation, project relationships, mobile behavior, and accessibility of audio controls.

**M5 gate**

Image, video, and audio use the same job, storage, asset, project, and error architecture without modality-specific duplication leaking across layers.

---

## M6 - Internal MVP Candidate

### E-070 - Cross-Surface Project Workflow

**Status:** Blocked by M5

Finish project quick actions for Generate Image, Generate Video, Generate Audio, Upload Asset, and Attach Existing Asset. Ensure project context is preselected and every output still appears globally in Assets.

### E-071 - End-To-End Regression Suite

**Status:** Blocked by E-070

Automate the highest-value paths: create context, upload references, generate, persist output, attach to project, filter Assets, archive/restore, and retry an idempotent request. Cover two organizations in the same suite.

### E-072 - Tenant Isolation And Security Audit

**Status:** Blocked by E-071

Audit every tenant-owned read/write, relationship insertion, signed URL, upload grant, generation payload, Trigger task, and provider callback. Attempt cross-organization IDs systematically and confirm tenant-safe `404` behavior.

### E-073 - Holistic UI And Accessibility Critique

**Status:** Blocked by E-071

Review the complete product as one system rather than isolated screens. Check navigation, terminology, density, consistency, responsive behavior, keyboard access, contrast, focus, media states, destructive actions, and whether the creative loop is obvious without explanatory UI copy.

### E-074 - Operational Reliability

**Status:** Blocked by E-071

Add structured logging, request/job correlation IDs, safe provider diagnostics, Trigger retry/concurrency policy, abandoned-upload cleanup, failed-output cleanup, R2 lifecycle expectations, and a short operations runbook.

### E-075 - Staging Deployment And Acceptance Pass

**Status:** Blocked by E-072 through E-074

Deploy API, dashboard, database migrations, R2, Trigger.dev, and provider credentials to staging. Run the complete acceptance checklist with real models and realistic media sizes. Record defects as new small tasks rather than expanding this session.

**M6 gate**

The core creative loop is stable enough for controlled internal or invited-user testing. It is not yet a paid product.

---

## Phase 2 Productization - Not Yet Scheduled

Only plan these after M6 has been validated:

```txt
credit wallets and ledger
generation estimates
atomic credit reservations
capture and release policy
Stripe subscriptions and top-ups
welcome promotional credits
promotional-output public visibility
gallery moderation and landing-page endpoint
rate limiting and abuse controls
realtime job subscriptions
public API keys
```

When this phase begins, update the DB and API design documents first, then create a separate execution plan for productization.

## Prompt For The First Implementation Session

Use this as the starting request for E-001:

```txt
Implement E-001 from docs/mvp-execution-plan.md and nothing else.

Read AGENTS.md, packages/db/AGENTS.md, docs/talelabs-product-vision.md,
docs/db-design-planning.md, docs/api-design-planning.md, and
docs/mvp-execution-plan.md first.

Create and run the complete MVP database migration, synchronize the Kysely
schema types, verify the migration and constraints, and report the results.
Do not add API routes, repositories, fixtures, seed data, or UI.
```
