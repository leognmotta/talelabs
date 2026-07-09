# Dashboard Architecture

This app is a Vite React dashboard that consumes the shared `@talelabs/ui` package and the generated `@talelabs/sdk`. Keep the dashboard React-native, feature-oriented, and compatible with both the current Vite app and future Next.js consumers of the UI package.

## Installed Skills

- `vercel-react-best-practices`: primary React performance and async/data-flow guidance.
- `shadcn`: primary UI/component guidance for the shared shadcn package.
- `tanstack-query-best-practices`: primary server-state, cache, mutation, and invalidation guidance.
- `react-router-declarative-mode`: current routing mode for this app because it uses `BrowserRouter`, `Routes`, and `Route`.

When Codex does not pick up newly installed skills in the current thread, restart Codex before relying on automatic skill activation.

## Current Stack

- React 19.
- Vite for the dashboard app.
- React Router declarative mode for client navigation.
- TanStack Query for server state.
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
    auth/
      auth-screen.tsx
      auth-client.ts
    organizations/
      use-organization-session.ts
      organization-switcher.tsx
    projects/
      projects-screen.tsx
      project-switcher.tsx
      project.queries.ts
    generation/
      generation-screen.tsx
      generation-composer.tsx
      modality-tabs.tsx
      model-picker.tsx
      reference-uploader.tsx
      generation.queries.ts
    assets/
      assets-screen.tsx
      asset-grid.tsx
      asset.queries.ts

  shared/
    lib/
      theme.ts
      slugify.ts
    types/
      auth.ts
```

Do not move files only to satisfy this shape. Move code when a feature gains enough surface area that co-location improves ownership.

## Boundaries

- `packages/ui`: reusable UI primitives and composed primitives only. No app routes, API calls, Better Auth calls, product queries, or dashboard-only business logic.
- `src/app/*`: providers, app-wide setup, route tree, query client defaults, and global shell wiring.
- `src/layouts/*`: reusable app layout components such as sidebars, headers, and page chrome.
- `src/routes/*`: route guards and route-level routing decisions.
- `src/features/*`: product workflows, screens, feature-specific components, feature queries, and feature forms.
- `src/shared/*`: small app-local utilities and types that are not product features.
- `@talelabs/sdk`: generated API surface. Prefer generated clients, hooks, query keys, and schemas over handwritten fetch calls.

## Routing Rules

- Keep React Router in declarative mode until there is a clear need for data/framework mode.
- Keep `BrowserRouter` at the app root and route declarations in one route tree.
- Use nested routes for dashboard shell pages.
- Use `NavLink` for navigation state.
- Use URL params/search params for shareable state such as selected project, selected asset, or modality when it should survive refresh/share.
- Do not put server fetching into ad hoc route effects when an SDK query hook can own it.

## Server-State Rules

- TanStack Query owns server state: user/session-adjacent API data, projects, assets, generations, models, and uploads.
- Local component state owns unsaved drafts: prompt text, selected files before upload, transient composer controls, and pending form UI.
- Use generated Kubb query hooks when they fit directly.
- Add feature `*.queries.ts` files when a workflow needs query composition, custom invalidation, prefetching, or optimistic updates.
- Query keys must include all variables that affect the request.
- Mutations must invalidate the narrowest related query set.
- Prefer `select` for lightweight view data transforms instead of duplicating transformed data in React state.
- Do not add Zustand/Jotai yet. Add a client store only when boards/workflows need complex unsaved editor or canvas state shared across distant components.

## UI Rules

- Import reusable components from `@talelabs/ui/components/*`.
- Use Tabler icons from `@tabler/icons-react`.
- Keep shadcn/Base UI APIs intact; do not re-wrap primitives unless it removes repeated product-specific composition.
- Use existing components before custom markup: `Tabs`, `Field`, `InputGroup`, `Button`, `Card`, `Sidebar`, `ScrollArea`, `Empty`, `Skeleton`, `Badge`, `Dialog`, `Sheet`, `Tooltip`, `Message`, `MessageScroller`, `Marker`, `Bubble`, and `Attachment`.
- Shared UI package code must stay framework-neutral enough to import from both Vite and Next.js apps.
- Dashboard-specific layout and workflow components belong in `apps/dashboard`, not `packages/ui`.

## Product Resources

For the Runway-like dashboard, model the frontend around these product areas:

```txt
Organization
  Project
    Asset
    Generation
    Board
    Workflow
```

Start with these feature surfaces:

```txt
projects
assets
generation
models
uploads
```

Projects are lightweight containers for organizing assets, generation jobs, boards, and later workflows. The primary workspace action is creating a `Generation` from a media modality, model, prompt, reference assets, and params.

## Generation UX

The first product-grade workspace screen should be `features/generation`:

- Media tabs: image, video, audio.
- Model picker filtered by modality.
- Prompt composer with clear submit state.
- Reference uploader for images/video/audio as supported by the selected model.
- Params panel for modality-specific options such as aspect ratio, duration, seed, or quality.
- Generation history/results scoped to the active project.

Do not make the first screen a marketing page. The dashboard should open into the usable workspace.

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
