# Dashboard Architecture

This app is a Vite React dashboard that consumes the shared `@talelabs/ui` package and the generated `@talelabs/sdk`. Keep the dashboard React-native, feature-oriented, and compatible with both the current Vite app and future Next.js consumers of the UI package.

## Installed Skills

- `vercel-react-best-practices`: primary React performance and async/data-flow guidance.
- `shadcn`: primary UI/component guidance for the shared shadcn package.
- `tanstack-query-best-practices`: primary server-state, cache, mutation, and invalidation guidance.
- `react-flow`: primary Flow canvas, node, edge, viewport, interaction, and
  performance guidance.
- `react-router-declarative-mode`: current routing mode for this app because it uses `BrowserRouter`, `Routes`, and `Route`.

When Codex does not pick up newly installed skills in the current thread, restart Codex before relying on automatic skill activation.

## Current Stack

- React 19.
- Vite for the dashboard app.
- React Router declarative mode for client navigation.
- TanStack Query for server state.
- Zustand for unsaved, high-frequency Flow canvas client state.
- Kubb-generated `@talelabs/sdk` for API clients, query hooks, types, and Zod schemas.
- `@talelabs/ui` for shadcn components built on Base UI with Tabler icons.
- Better Auth client for auth and organization session actions.

Do not introduce a second app framework, state manager, component primitive library, or icon library unless there is a concrete product need.

## Directory Shape

Use this structure as the dashboard grows:

```txt
src/
  app/
    providers.tsx            # QueryClientProvider, router, theme, toaster wiring
    query-client.ts          # QueryClient defaults only
    routes.tsx               # Declarative route tree only

  layouts/
    dashboard-layout.tsx
    app-sidebar.tsx

  routes/
    protected-route.tsx
    public-route.tsx
    create-organization-route.tsx

  features/
    flows/
      browse/
      editor/
      nodes/
      generation/
      runs/
      data/
    assets/
      library/
      viewer/
      folders/
      tags/
      media/
      upload/
      data/
    uploads/
    settings/
    organizations/
    auth/

  shared/
    lib/
      theme.ts
      slugify.ts
    types/
      auth.ts
```

Do not move files only to satisfy this shape. Move code when a feature gains
enough surface area that co-location improves ownership. Follow
`docs/frontend-feature-structure-refactor-plan.md` for the planned mechanical
reorganization of the existing Flow and Asset features.

## Boundaries

- `packages/ui`: reusable UI primitives and composed primitives only. No app routes, API calls, Better Auth calls, product queries, or dashboard-only business logic.
- `src/app/*`: providers, app-wide setup, route tree, query client defaults, and global shell wiring.
- `src/layouts/*`: reusable app layout components such as sidebars, headers, and page chrome.
- `src/routes/*`: route guards and route-level routing decisions.
- `src/features/*`: product workflows, screens, feature-specific components, feature queries, and feature forms.
- `src/shared/*`: small app-local utilities and types that are not product features.
- `@talelabs/sdk`: generated API surface. Prefer generated clients, hooks, query keys, and schemas over handwritten fetch calls.

## Feature Organization And Readability

The dashboard must remain understandable to a good developer without AI
assistance. Optimize the directory tree for locating ownership and tracing
behavior, not for displaying an architectural pattern.

- Preserve the feature-first top level. Inside a large feature, group files by
  cohesive product responsibility or user workflow such as `browse`, `editor`,
  `runs`, `generation`, `library`, `viewer`, or `folders`.
- A feature folder is a navigation surface. A newcomer should be able to locate
  its screen entry point, state owner, server-state boundary, primary
  interactions, and reusable primitives from folder names without scanning a
  large flat list.
- More than 20 directly contained authored files is an ownership-review
  trigger, not an automatic defect. Do not add more flat files to a directory
  already over that threshold without a clear cohesion reason.
- Prefer purpose-bearing names. Do not create catch-all `components`, `hooks`,
  `types`, `utils`, or `helpers` folders when those names do not identify the
  product behavior they support.
- Avoid one-file folders, excessive nesting, numbered fragments, thin wrappers,
  and broad `index.ts` barrels. Reorganization must reduce search and tracing
  cost rather than replace a flat list with trivial indirection.
- Keep explicit dependency direction:

  ```txt
  route/screen -> feature capability -> local state/data/UI primitive
  ```

- Lower-level modules must not import screens or create cycles. Cross-feature
  consumers use small, stable, explicit paths owned by the providing feature;
  they must not reach through arbitrary internals.
- Keep code close to the behavior that owns it. Promote code to `shared` or a
  common feature primitive only after multiple real consumers demonstrate the
  same contract and ownership.
- Apply the root 600-line limit and cohesion rules to authored React and
  TypeScript files. Function count is diagnostic rather than a hard limit;
  split mixed responsibilities, not cohesive state actions, query factories,
  or component families that are easier to understand together.
- Add useful TSDoc to authored modules and exported symbols. Explain ownership,
  contracts, state lifecycle, invariants, and units; do not narrate obvious
  implementation.

## Routing Rules

- Keep React Router in declarative mode until there is a clear need for data/framework mode.
- Keep `BrowserRouter` at the app root and route declarations in one route tree.
- Use nested routes for dashboard shell pages.
- Use `NavLink` for navigation state.
- Use URL params/search params for shareable state such as selected project, selected asset, or modality when it should survive refresh/share.
- Do not put server fetching into ad hoc route effects when an SDK query hook can own it.

## Server-State Rules

- TanStack Query owns server state: user/session-adjacent API data, Flows,
  Assets, runs, model configuration, and upload records.
- Zustand owns the approved unsaved Flow graph, selection, viewport-adjacent,
  and high-frequency canvas state shared across distant canvas components.
- Local component state owns leaf-level ephemeral UI such as an open menu,
  unsaved field draft, or temporary interaction that has one clear owner.
- React Router or nuqs owns shareable URL state that must survive refresh or be
  deep-linkable.
- Use generated Kubb query hooks when they fit directly.
- Add feature `*.queries.ts` files when a workflow needs query composition, custom invalidation, prefetching, or optimistic updates.
- Query keys must include all variables that affect the request.
- Mutations must invalidate the narrowest related query set.
- Prefer `select` for lightweight view data transforms instead of duplicating transformed data in React state.
- Do not duplicate TanStack Query data, URL state, or derivable values in
  Zustand. Each piece of state has one authoritative owner.
- Colocate Zustand actions and selectors with the canvas state shape they
  understand. Components consume narrow selectors instead of subscribing to
  the complete store.

## React Flow Rules

- Keep custom node and edge components memoized or defined outside parent
  renders.
- Keep callbacks, node/edge registries, default options, and configuration
  objects passed to React Flow referentially stable.
- Node dragging changes graph state frequently. Unrelated toolbars, inspectors,
  dialogs, and layout components must not subscribe to complete `nodes` or
  `edges` arrays.
- Store and select focused derived values, such as selected IDs, independently
  when that prevents broad graph subscriptions. Do not duplicate values that
  can be cheaply derived inside the owning selector.
- Keep server state and durable run observation out of the canvas store.
  TanStack Query remains authoritative for Flows, Assets, runs, and provider
  results; Zustand owns only the current unsaved editing session.
- Preserve stable handlers, narrow selectors, autosave reconciliation, and the
  approved React profiling behavior during any structural refactor.

## UI Rules

- Import reusable components from `@talelabs/ui/components/*`.
- Use Tabler icons from `@tabler/icons-react`.
- Keep one React component per `.tsx` file. Move child components into sibling files and import them; keep only non-component constants, schemas, types, and pure helpers in `.ts` modules.
- Keep shadcn/Base UI APIs intact; do not re-wrap primitives unless it removes repeated product-specific composition.
- Use existing components before custom markup: `Tabs`, `Field`, `InputGroup`, `Button`, `Card`, `Sidebar`, `ScrollArea`, `Empty`, `Skeleton`, `Badge`, `Dialog`, `Sheet`, `Tooltip`, `Message`, `MessageScroller`, `Marker`, `Bubble`, and `Attachment`.
- Shared UI package code must stay framework-neutral enough to import from both Vite and Next.js apps.
- Dashboard-specific layout and workflow components belong in `apps/dashboard`, not `packages/ui`.

## Active Product Surface

The active dashboard loop is:

```txt
Assets -> Flows -> Generated Assets -> Continued Iteration
```

- Assets provide durable upload, organization, preview, and reuse.
- Flows are the primary creative workspace and dashboard entry point.
- Model-adaptive Image, Video, LLM, and Audio nodes expose only the inputs and
  settings supported by the selected model.
- Every successful generation output becomes a canonical Asset and remains
  visible after canvas reload.
- Elements are an active dashboard feature (shipped 2026-07-18): a named,
  ordered collection of reference image Assets whose Flow node exposes exactly
  one `references → ImageSet` output. `docs/elements.md` is the source of truth.
  Never reintroduce the retired multi-role/consistency Element architecture
  (asset roles, source/master kinds, readiness, per-kind schemas, or
  multi-output Element nodes) without a new explicit product decision.

The dashboard opens into the usable Flow workspace, not a marketing page or the
retired Generate/Projects product.

## Framework Compatibility

- Keep `packages/ui` free of Vite-only APIs such as `import.meta.env`.
- Keep `packages/ui` free of Next-only APIs such as `next/link`, `next/image`, and server components.
- Put environment reads, routing, auth, and data fetching in the consuming app.
- If a future Next.js app consumes `@talelabs/ui`, add Next-specific adapters in the app, not in the UI package.

## Checks

Before finishing dashboard architecture changes, run:

```bash
npm run lint
npm run build -w dashboard
npm run check-types -w @talelabs/ui
```

If API contracts changed and generated SDK output is affected, also run:

```bash
npm run sdk:generate
```

## Optimistic Updates

https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

Every time you are creating mutations ensure to make the ui have instant feedback by implementing optimistic update, load React Query skills if needed.
