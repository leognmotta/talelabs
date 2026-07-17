# Flow feature ownership

The Flow feature follows one visible dependency direction:

```txt
browse/editor screens -> Flow capabilities -> canvas state, server data, and node primitives
```

- `browse` owns the Flow list and create, rename, and delete interactions.
- `editor` owns the React Flow surface and canvas composition. `canvas-state`
  owns the scoped Zustand store, `interactions` owns commands and React Flow
  callbacks, and `persistence` owns autosave, reconciliation, serialization,
  non-blocking navigation handoff, URL state, and viewport persistence.
- `nodes` owns node rendering. Input and family-specific nodes stay distinct;
  `shared` is limited to primitives with multiple current node-family consumers.
  `nodes/flow-node-metadata.ts` is the canonical non-component definition for
  picker, inspector, and toolbar capabilities; React node registration is a
  stable derived projection in `nodes/flow-dashboard-node-registry.ts`.
- `generation` owns model-adaptive configuration, compatibility, settings, and
  preview projection without defining a second model catalog.
- `runs` separates admission, durable observation, realtime recovery, and the
  deterministic mock runtime.
- `data` owns only Flow server-state queries, mutations, cache policy, and query
  keys. Persistence, generation configuration, run observation, and realtime
  subscriptions stay with their owning capabilities; there is no data facade.

Cross-feature consumers should use explicit owner paths such as
`flows/data/query-keys/flow-query-keys` and
`flows/runs/realtime/flow-run-realtime-subscriptions`. There is intentionally no
feature barrel.
