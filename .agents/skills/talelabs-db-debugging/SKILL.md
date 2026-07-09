---
name: talelabs-db-debugging
description: Use when debugging talelabs database state, validating data, checking API database behavior, or running read-only PostgreSQL queries through the root POSTGRES_URL in this monorepo.
---

# talelabs DB Debugging

Use this skill whenever a task needs database visibility for this repo.

## Sources Of Truth

- Database package: `packages/db`
- Runtime env: root `.env`, key `POSTGRES_URL`
- Kysely guidance: `.agents/skills/kysely/SKILL.md`
- Kysely LLM docs: `https://kysely.dev/llms.txt` and `https://kysely.dev/llms-full.txt`

## Workflow

1. Load the Kysely skill before writing non-trivial Kysely code.
2. Prefer the app's exported `@talelabs/db` client for application changes.
3. For debugging data, run read-only SQL first. Do not print `POSTGRES_URL` or secrets.
4. Keep query output small: add `limit`, project only needed columns, and redact tokens, passwords, cookies, API keys, and PII unless the user explicitly needs a specific value.
5. Before any insert/update/delete/truncate/drop/migration, explain the intended mutation and get explicit user approval.

## Read-Only Query Helper

Use the bundled helper for quick database inspection:

```bash
node .agents/skills/talelabs-db-debugging/scripts/query-db.mjs "select now() as now"
```

The helper loads the root `.env`, connects with `POSTGRES_URL`, blocks obvious write statements, and prints JSON rows.

For multi-line SQL:

```bash
node .agents/skills/talelabs-db-debugging/scripts/query-db.mjs <<'SQL'
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
order by table_name
SQL
```

If the sandbox blocks network access to the database, rerun the same command with escalation and a narrow justification.
