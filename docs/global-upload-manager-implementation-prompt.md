# TaleLabs Global Upload Manager - Deferred Implementation Prompt

> Status: Deferred. Do not implement during the current M2 review. Finish the
> current review, resolve accepted findings, and commit the existing M2 work
> before starting this scope.

## Prompt

Implement persistent, cross-route Asset uploads using Zustand.

Before editing:

1. Read `AGENTS.md`.
2. Read `docs/talelabs-product-vision.md`.
3. Read the M2 Assets section in `docs/mvp-execution-plan.md`.
4. Inspect the complete existing upload implementation before changing it:
   - `apps/dashboard/src/features/assets/use-asset-uploader.ts`
   - `apps/dashboard/src/features/assets/use-asset-folder-upload.ts`
   - `apps/dashboard/src/features/assets/asset-upload.ts`
   - `apps/dashboard/src/features/assets/asset-upload-batch.ts`
   - `apps/dashboard/src/features/assets/asset-upload-selection.ts`
   - `apps/dashboard/src/features/assets/asset-library.tsx`
   - Organization switching in `apps/dashboard/src/app/routes.tsx`.
5. Use the available skill discovery and installer tools to find and install a
   current Zustand skill into this project's `.agents/skills/` directory. Update
   the project skill lock as required by the installer, and read the installed
   Zustand skill before planning or editing the implementation. Do not install
   an unreviewed skill blindly: confirm that it covers modern Zustand stores,
   selectors, vanilla stores, React integration, and avoiding unnecessary
   rerenders.
6. Read the installed TanStack Query and React best-practice skills.
7. Install Zustand in the dashboard workspace using the repository package
   manager.

## Goal

Users must be able to start uploading many files or a complete folder from the
Asset library, navigate to Assets, Elements, Flows, settings, or other dashboard
pages, and continue working while uploads remain active.

Uploads must no longer be owned by the mounted `AssetLibrary` route.

Once an upload has registered an Asset and Trigger.dev processing has started,
processing must continue independently as it does now.

## State Ownership

Use these boundaries:

```txt
TanStack Query = server state such as Assets, folders, and tags
nuqs           = URL state
Zustand        = cross-route upload queue and observable upload progress
Upload manager = files, controllers, hashing, networking, and queue execution
```

Do not copy canonical Asset lists, folders, tags, or Asset details into Zustand.

Do not use Zustand persistence. `File`, `AbortController`, XHR objects, signed
URLs, and upload grants must never be written to local storage or session
storage.

Keep non-serializable runtime objects in private manager-owned maps. Zustand
should expose only the state the UI needs.

## Suggested Structure

Create a focused upload feature boundary, adapting names to existing
conventions:

```txt
apps/dashboard/src/features/uploads/
  upload-manager.ts
  upload-store.ts
  upload-provider.tsx
  upload-indicator.tsx
  upload-panel.tsx
  upload.types.ts
```

Do not create a monolithic application store.

The upload manager must work independently of React component mounts. Zustand
observes the manager but does not implement the networking itself.

## Upload State

Model batches and individual files.

Each file should expose at least:

```ts
type UploadStatus =
  | 'queued'
  | 'hashing'
  | 'uploading'
  | 'registering'
  | 'completed'
  | 'failed'
  | 'canceled'

type UploadItemState = {
  id: string
  batchId: string
  organizationId: string
  filename: string
  mimeType: string
  sizeBytes: number
  destinationFolderId: string | null
  relativePath: string | null
  status: UploadStatus
  progress: number
  errorCode?: string
  assetId?: string
}
```

Store `File`, controllers, grants, and transient request details outside the
Zustand state.

Use selectors so components subscribe only to the state they render. Avoid
having the dashboard rerender for every upload progress event.

Throttle progress-state updates if necessary while keeping the UI responsive.

## Required Behavior

Preserve existing behavior:

- Chunked MD5 calculation.
- Direct browser-to-R2 PUT.
- Upload registration.
- File and folder uploads.
- Folder hierarchy reconstruction.
- Processing-state feedback.
- Existing supported MIME policies.
- Individual cancellation.
- Batch cancellation.
- Existing error mapping.
- Cache updates and invalidation.
- Direct upload destination captured when the batch starts.

Add:

- Uploads survive normal SPA route navigation.
- Queue ownership survives `AssetLibrary` unmounting.
- A user can cancel one file.
- A user can cancel an entire batch.
- Failed files can be retried without retrying successful files.
- Completed and canceled entries can be cleared from visible history.
- Progress distinguishes hashing, upload, and registration.
- Upload work stops cleanly when the dashboard itself unmounts.
- No callbacks update an unmounted route component.
- Folder creation and remaining queued files stop after batch cancellation.
- Navigating into another folder never silently changes an active upload's
  destination.

Keep current sequential behavior unless limited concurrency can be introduced
without changing correctness. Do not add unconstrained parallel uploads.

## Organization Isolation

Fix the organization-switch race as part of this work.

Currently, the server's active organization can change before the React
organization context updates. An upload batch may therefore continue while its
client scope is stale.

Required behavior:

1. Every batch captures its organization ID at enqueue time.
2. Before switching organizations, cancel all uploads and queued work belonging
   to the previous organization.
3. Await cancellation and settlement before calling `activateOrganization`.
4. No request may start after its batch organization becomes inactive.
5. Folder creation must obey the same cancellation boundary.
6. Uploads must never be registered in the destination organization merely
   because the active session changed.
7. If practical within the current SDK boundary, send an expected organization
   identifier with product requests and reject mismatches server-side. Do not
   broaden scope into a public API redesign if this requires major unrelated
   work; cancellation before activation is mandatory regardless.

Expose an imperative upload-manager method such as:

```ts
await uploadManager.cancelOrganization(previousOrganizationId)
```

Organization switching must call it before changing the server session.

## Cache Integration

After successful registration:

- Upsert the returned Asset into the correct organization-scoped Asset cache.
- Invalidate the appropriate Asset and folder queries.
- Never use the currently active organization implicitly; use the organization
  captured by the upload item.
- Do not recreate a removed previous-organization cache during a workspace
  transition.
- Trigger.dev processing polling must continue using the existing Asset query
  behavior when the user later visits the library.

The upload manager may receive or import the application QueryClient, but keep
cache integration behind a small explicit adapter rather than mixing TanStack
Query operations throughout networking code.

## Global UX

Add a restrained global upload control to the dashboard header.

Use a familiar upload or progress icon with:

- Active upload count badge.
- Aggregate progress when uploads are active.
- Success or error indication when a batch finishes.
- Tooltip and accessible label.
- No layout shifting as progress changes.

Clicking it should open a Sheet, Popover, or similarly appropriate existing
component showing:

- File name.
- Current stage.
- Progress.
- Destination when useful.
- Cancel action for active files.
- Retry action for failed files.
- Clear-completed action.
- Batch-level cancellation when multiple files are active.

Keep the panel compact and operational. Do not turn it into a decorative
dashboard or nested-card interface.

Preserve useful completion and failure toasts, but avoid showing a permanent
progress toast for every file if the global panel now provides that information.
A large batch must not flood the screen with dozens of simultaneous toasts.

Use existing icons and UI components. Do not manually draw SVG icons.

## Internationalization

Do not hard-code user-facing text.

Add every new key to English and all supported locale catalogs:

```txt
en
pt-BR
pt-PT
es
fr
de
it
nl
pl
ro
```

Use localized number and percentage formatting and existing terminology from
`packages/i18n/TRANSLATION_GUIDE.md`.

## Scope Constraints

Do not:

- Change the R2 upload protocol.
- Implement multipart or resumable uploads.
- Attempt to survive browser refresh, tab closure, browser crashes, or device
  restart.
- Add local-storage persistence.
- Rewrite Asset APIs unrelated to upload ownership.
- Move Asset server state into Zustand.
- Refactor unrelated dashboard UI.
- Add billing, quotas, credits, or public media.
- Add automated tests as an acceptance requirement.

SPA navigation persistence is the target. Browser-session persistence is
explicitly deferred.

## Maintainability

Keep the code DRY and easy to follow:

- One upload execution implementation.
- One progress model.
- One cancellation mechanism.
- One organization-binding check.
- One cache-integration adapter.
- React components render state and dispatch actions; they do not perform upload
  orchestration.
- Avoid a new oversized provider or store file.
- Remove obsolete route-owned upload orchestration after the global manager is
  working.
- Do not leave parallel legacy and new implementations.

## Acceptance Checks

Manually verify through implementation-level smoke checks:

1. Start a multi-file upload from Assets.
2. Navigate to Elements while hashing or uploading.
3. Confirm progress continues.
4. Navigate back to Assets and confirm progress and state are preserved.
5. Upload a folder and navigate away while nested folders are being created.
6. Confirm folder creation and uploads continue.
7. Cancel one file and confirm the rest continue.
8. Cancel a batch and confirm queued files never start.
9. Retry a failed file.
10. Complete uploads and confirm Assets appear in the correct workspace.
11. Start an upload, switch workspaces, and confirm cancellation settles before
    activation.
12. Confirm no file or folder is created in the destination workspace by the
    canceled old-workspace batch.
13. Confirm registered Assets continue Trigger.dev processing after navigation.
14. Confirm there are no duplicate uploads, stale toasts, or cache leakage.

User-owned UI critique and final product QA remain the user's responsibility.

Run:

```bash
npm run sdk:generate
npm run check-types
npm run lint
npm run i18n:check
npm run build
git diff --check
```

Report:

- Files changed.
- Zustand store and manager boundaries.
- How organization switching is coordinated.
- How cache updates remain organization-scoped.
- Which upload behaviors survive navigation.
- Explicitly state that refresh and tab-close persistence remain unsupported.
- Verification results and any non-blocking build warnings.
