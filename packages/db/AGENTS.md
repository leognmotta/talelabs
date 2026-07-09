# Database Package

This package owns the Kysely schema, database connection, migrations, and migration runner for TaleLabs.

## Multi-Tenant Rules

- Any table whose records are scoped to a customer workspace, team, generated asset, board, workflow, project, character, product, brand, invitation-owned resource, or other tenant-owned domain data must include an `organizationId` column.
- Queries against organization-scoped tables must filter by `organizationId` whenever reading, updating, deleting, counting, or joining records. This avoids cross-organization query collisions and accidental data leakage.
- Index organization-scoped tables by `organizationId`, and prefer composite indexes that include the common lookup fields used with that tenant filter.
- Only omit `organizationId` for truly global/system tables, authentication tables managed by Better Auth, join tables whose tenant boundary is already enforced by the joined parent, or reference data that is intentionally shared across all organizations.
- When adding migrations, keep the generated Kysely schema in sync with the table shape and preserve organization scoping in both constraints and query examples.

## Checks

Before finishing database changes, run:

```bash
npm run build -w @talelabs/db
```
