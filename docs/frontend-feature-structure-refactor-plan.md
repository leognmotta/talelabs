# TaleLabs Frontend Feature Structure Refactor

Status: implemented on 2026-07-17; user-owned browser UI/E2E QA pending
Scope: `apps/dashboard/src/features/flows` and
`apps/dashboard/src/features/assets`
Behavioral goal: no product, API, state, or runtime behavior changes

## Goal

Keep the existing feature-first React architecture, but make large features
readable without AI assistance. A developer should be able to enter a feature
folder and quickly answer:

1. Where does the screen start?
2. Who owns client state and server state?
3. Where are user interactions implemented?
4. Where are API queries and cache rules?
5. Which components and contracts are intentionally reusable?

The refactor must preserve the approved Zustand canvas behavior, React Flow
performance, TanStack Query ownership, URL state, autosave, run modes, uploads,
and all user-approved UI behavior.

## Current Baseline

Measured on 2026-07-17:

| Feature | Files directly in feature root |
| --- | ---: |
| `flows` | 119 |
| `assets` | 62 |
| `elements` | 30 |
| `settings` | 22 |

`flows` already contains useful node-family and `canvas-state` directories, but
most editor, persistence, run, generation, data, and presentation modules remain
flat at the feature root. `assets` has an organized `drag-and-drop` directory,
while library, viewer, folders, tags, media, upload, and data concerns remain
mixed together.

This is not primarily a line-count problem. The directory paths no longer
communicate ownership, so a developer must scan or search a long alphabetical
list before understanding a change.

## Research Basis

- React recommends decomposing components by separation of concerns, keeping
  the minimum complete state, deriving the rest, and placing state with its
  clear owner. [Thinking in React](https://react.dev/learn/thinking-in-react)
- Redux recommends feature/domain folders and colocating selectors with the
  state shape they understand. TaleLabs applies this principle to Zustand
  without adopting Redux. [Redux code structure](https://redux.js.org/faq/code-structure/)
- React Flow warns that node movement causes frequent updates. Components and
  callbacks passed to React Flow must remain stable, and unrelated UI should
  not subscribe to full node or edge collections. [React Flow performance](https://reactflow.dev/learn/advanced-use/performance)
- Feature-Sliced Design provides useful principles of high cohesion, low
  coupling, discoverability, and purpose-bearing names, while explicitly saying
  projects should add only layers that provide value. TaleLabs borrows those
  principles but does **not** adopt the complete seven-layer architecture.
  [Layers](https://fsd.how/docs/reference/layers/) and
  [slices and segments](https://fsd.how/docs/reference/slices-segments/)

## Refactor Principles

1. Preserve `app`, `features`, `layouts`, `routes`, and `shared` as the top-level
   dashboard architecture.
2. Split large feature folders by product responsibility, not by file extension
   or generic technical type.
3. Keep explicit imports. Do not create broad `index.ts` barrels that hide
   ownership or introduce cycles.
4. Do not add generic `components`, `hooks`, `types`, `utils`, or `helpers`
   dumping grounds. Folder names must explain purpose.
5. Keep a module close to the behavior that owns it. Promote it only after a
   second real consumer demonstrates shared ownership.
6. Preserve one source of truth for canvas state, server state, URL state, query
   keys, validation, and product policy.
7. Keep the primary dependency direction visible:

   ```txt
   route/screen -> feature capability -> local state/data/UI primitive
   ```

8. File moves are mechanical. Do not combine them with behavior changes,
   component rewrites, query changes, or new abstractions.
9. More than 20 direct authored files in one directory triggers an ownership
   review. This is a navigation signal, not a standalone correctness rule.
10. Do not create a folder for one file unless it is an intentional stable
    boundary. Prefer two or three meaningful levels over a deeply nested tree.
11. Remove empty directories, including the current empty
    `flows/flow-canvas-store`, when the migration reaches that area.

## Target Flow Structure

```txt
features/flows/
  browse/
    flows-screen.tsx
    flow-card.tsx
    create-flow-dialog.tsx
    rename-flow-dialog.tsx
    delete-flow-dialog.tsx

  editor/
    flow-editor-screen.tsx
    flow-canvas.tsx
    flow-canvas-header.tsx
    flow-canvas-toolbar.tsx
    flow-canvas-panels.tsx
    canvas-state/
    interactions/
    persistence/

  nodes/
    shared/
    inputs/
    image-generation/
    video-generation/
    llm/
    audio/

  generation/

  runs/
    admission/
    observation/
    realtime/
    mock-runtime/

  data/
    flow.queries.ts
    flow-detail.queries.ts
    flow-list.query.ts
    flow-mutations.ts
    flow-cache.ts
    query-keys/
```

### Flow Ownership

**`browse`** owns the list screen and Flow identity actions. It does not own
query-key definitions or editor behavior.

**`editor`** owns the React Flow surface, canvas chrome, commands, navigation,
selection, keyboard interaction, autosave, viewport persistence, and graph
serialization.

- `editor/canvas-state` contains the approved Zustand store, actions, and narrow
  selectors.
- `editor/interactions` contains canvas command handling, React Flow callbacks,
  context menus, shortcuts, selection, and node creation.
- `editor/persistence` contains autosave, save/reconcile, serialization,
  navigation guards, search parameters, and viewport persistence.

**`nodes`** owns node rendering. Family-specific behavior stays with its family;
common shells, ports, toolbars, connection rows, media previews, and settings
primitives belong in `nodes/shared` only when multiple families use the same
contract.

**`generation`** owns model-adaptive configuration, compatibility, operation
selection, settings, and output history/projection that are shared by multiple
generation node families. It must not become a second model catalog.

**`runs`** owns run admission, availability, observation, realtime recovery,
status projection, and deterministic mock-runtime UI orchestration. Provider
execution remains outside the dashboard.

**`data`** owns Flow server-state queries, mutations, cache invalidation, and
query keys. It must not contain Zustand canvas state or presentation code.

## Target Asset Structure

```txt
features/assets/
  library/
    assets-screen.tsx
    asset-library.tsx
    asset-grid.tsx
    asset-list.tsx
    asset-library-toolbar.tsx
    asset-library-selection.ts
    asset-library-pagination.tsx

  viewer/
    asset-viewer-dialog.tsx
    asset-viewer-actions.tsx
    asset-name-dialog.tsx
    asset-purge-dialog.tsx

  folders/
    folder-card.tsx
    folder-list-row.tsx
    folder-preview.tsx
    folder-action-menu.tsx
    folder-delete-dialog.tsx
    move-to-folder-dialog.tsx

  tags/
    asset-tag-badges.tsx
    asset-tag-picker.tsx

  media/
    asset-media-preview.tsx
    asset-media-card.tsx
    asset-video-preview.tsx
    asset-status-badge.tsx
    asset-formatters.ts

  upload/
    asset-upload.ts
    asset-upload-files.ts
    asset-upload-menu.tsx
    asset-upload-selection.ts
    asset-file-drop-overlay.tsx

  drag-and-drop/

  data/
    asset.queries.ts
    asset-query-keys.ts
    asset-query-cache.ts
    folder-query-cache.ts
```

### Asset Ownership

`library` owns browsing, view modes, filters, selection, pagination, and library
dialogs. `viewer` owns the full-screen Asset detail interaction. `folders` and
`tags` own their respective organization behavior. `media` is the stable visual
surface consumed by Flows, Elements, and uploads. `upload` owns Asset-specific
file validation and registration, while the global in-flight queue remains in
`features/uploads`. `data` owns server-state contracts and cache policy.

Cross-feature consumers should import explicit stable paths such as:

```txt
features/assets/media/asset-media-preview
features/assets/data/asset-query-keys
features/flows/data/query-keys/flow-query-keys
```

Add a focused `public.ts` only when repeated external imports prove that a small
public seam is clearer. Do not create one broad feature barrel.

## Execution Plan

### 1. Record the behavioral baseline

- Confirm the user-approved canvas, node, run, Asset, upload, and viewer flows.
- Retain the existing React profiling baseline: 46 commits for the combined
  selection, drag, connection, and autosave scenario.
- Record current import-cycle and directory-count results.

### 2. Move Flow browse and data modules

- Use `git mv`; change imports only.
- Move list/identity UI to `browse` and query/cache modules to `data`.
- Update app routes and cross-feature query-key imports explicitly.
- Do not change query keys, request behavior, or cache invalidation.

### 3. Move run and generation modules

- Move realtime, run observation/admission, preview projection, and mock runtime
  into `runs`.
- Move model-adaptive dashboard behavior into `generation`.
- Preserve all public types, runtime behavior, and translation keys.

### 4. Move the editor without redesigning it

- Move the existing eight `canvas-state` files intact.
- Classify canvas modules into editor root, `interactions`, or `persistence`.
- Preserve memoized node/edge registries, React Flow handlers, selectors,
  autosave conflict behavior, and navigation guards.
- Delete the empty `flow-canvas-store` directory.

### 5. Consolidate node-family ownership

- Keep existing family directories.
- Move only proven cross-family components into `nodes/shared`.
- Do not create a generic node engine, boolean-prop super-component, or second
  registry during this structural pass.

### 6. Reorganize Assets

- Move library, viewer, folder, tag, media, upload, and data modules to their
  purpose folders.
- Update Flows, uploads, dormant Elements, layouts, and global search to use the
  explicit stable paths.
- Preserve global upload-manager ownership and every cache invalidation path.

### 7. Document and verify the final boundaries

- Add a short `README.md` to `flows` and `assets` describing each subdomain and
  dependency direction.
- Recount direct files and inspect every cross-feature import.
- Reject cycles and deep imports that bypass the documented owner.
- Re-run the React profile and investigate a meaningful regression from the
  46-commit baseline.

Use micro commits by ownership boundary. Run the full verification after the
complete mechanical refactor, and focused type/lint checks after each move.

## Acceptance Gates

- No observable UI, run, upload, cache, or persistence behavior changes.
- `flows` and `assets` roots contain only clear feature entry points and
  responsibility folders.
- No directory has more than 20 direct authored files without an explicit,
  documented cohesion reason.
- No new global state, React context, duplicate query key, duplicate registry,
  or derived-state source is introduced.
- No circular dependency or broad root barrel is introduced.
- React Flow components/configuration remain stable and high-frequency state is
  consumed through narrow Zustand selectors.
- Cross-feature imports target documented stable ownership paths.
- Authored files remain below 600 lines and retain cohesive responsibilities;
  function count alone is not an acceptance failure.
- TSDoc, TypeScript, i18n validation, lint, production build, and
  `git diff --check` pass.
- User-owned UI/E2E QA confirms the approved behavior after all moves complete.

## Non-goals

- No full Feature-Sliced Design adoption.
- No route, API, schema, model-catalog, provider, or Trigger.dev changes.
- No state-management rewrite.
- No UI redesign or component restyling.
- No new generic component library.
- No dormant Elements reactivation.
- No behavior refactor disguised as file movement.
