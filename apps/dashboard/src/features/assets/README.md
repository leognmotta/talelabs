# Asset feature ownership

The Asset feature keeps canonical media behavior grouped by user responsibility:

- `library` owns the Assets screen, reusable picker, filters, view modes,
  selection, pagination, and the actions that compose that browsing workflow.
- `viewer` owns full Asset detail, rename, download, and permanent-delete UI.
- `folders` and `tags` own their respective organization interactions.
- `media` owns stable preview, card, status, playback, and formatting surfaces
  consumed by Flows, Elements, and uploads.
- `upload` owns Asset file policy, selection, registration, and drop UI. The
  global in-flight queue remains in `features/uploads`.
- `drag-and-drop` owns library drag payloads, previews, monitors, and targets.
- `data` owns TanStack Query contracts, query keys, and entity-specific
  Asset/folder/tag queries, mutations, snapshots, and cache updates.

`library` deliberately contains 29 direct authored modules because its screen,
picker, grid/list variants, selection, and browsing actions form one cohesive
workflow. Splitting those modules into generic component or hook folders would
hide that ownership; this is the documented exception to the 20-file review
threshold.

Cross-feature consumers should use explicit owner paths such as
`assets/media/asset-media-preview`, `assets/upload/asset-upload`, and
`assets/data/asset-query-keys`. There is intentionally no feature barrel.
