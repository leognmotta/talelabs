---
name: kubb
description: Use Kubb 5.x to generate TypeScript API clients, types, schemas, hooks, and MCP tooling from OpenAPI specs.
---

# Kubb

Use this skill when working with Kubb, OpenAPI-driven code generation, `kubb.config.ts`, `kubb generate`, `kubb validate`, or the Kubb MCP server.

## Sources

- Start with Kubb's official 5.x AI docs:
  - MCP: https://kubb.dev/docs/5.x/ai/mcp
  - Skills: https://kubb.dev/docs/5.x/ai/skills
  - LLMS.txt: https://kubb.dev/docs/5.x/ai/llmstxt
- If a page says it has a Markdown version, prefer that Markdown URL for dense implementation details.
- Official Kubb-specific AI coding skills are not published yet; this repo-local skill bridges that gap.

## Workflow

1. Inspect the installed Kubb versions before changing config:

   ```shell
   node -e "for (const p of ['@kubb/cli','@kubb/mcp']) console.log(p, require(p + '/package.json').version)"
   ```

2. Look for existing project config and OpenAPI inputs:

   ```shell
   rg --files | rg '(^|/)(kubb\.config\.(ts|mts|cts|js)|openapi|swagger|api\.(ya?ml|json))$'
   ```

3. Validate specs before generation when a spec path exists:

   ```shell
   npx kubb validate path/to/openapi.yaml
   ```

4. Generate through the project config when available:

   ```shell
   npx kubb generate
   ```

5. Use the MCP server for assistant-driven generation:

   ```shell
   npx kubb mcp
   ```

## Repo Rules

- Prefer repo-local `kubb.config.ts` and existing generated-code locations.
- Do not invent generated files. Run Kubb and inspect the output.
- Keep generated clients in package or app boundaries that match their consumers.
- Commit generated output only when the user asks for the API client to be generated or regenerated.
- After changing Kubb config or generated output, run lint, typecheck, and production build for affected workspaces.
