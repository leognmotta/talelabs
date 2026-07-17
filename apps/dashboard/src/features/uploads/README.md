# Upload ownership

The dashboard upload feature keeps serializable presentation state in
`upload-store.ts` and browser-only `File`, `AbortController`, and in-flight
promise state in `upload-runtime.ts` plus `queue/upload-queue-state.ts`.

- `queue/` owns enqueueing, single-flight scheduling, tenant lifecycle, retry,
  and settled-item cleanup.
- `execution/` owns one item's upload, registration, dormant Element linking,
  progress, and failure-stage mapping.
- `cancellation/` owns item, batch, target, organization, and teardown
  cancellation, including waits required before destructive mutations.
- `upload-*-cache.ts` modules publish committed work into TanStack Query. Cache
  refresh failures never undo an already registered canonical Asset.
- Root React modules present global progress and notifications. They call the
  explicit owner modules above instead of importing a broad manager facade.

The queue continues across dashboard route changes. Changing organization or
signing out aborts the previous tenant's work before its product caches are
removed.
