# SDK Package

This package exposes the generated `@talelabs/sdk` API clients, React Query hooks, TypeScript types, and Zod schemas.

## Generated Code

- Never manually edit files under `src/gen`.
- `src/gen` is generated output owned by Kubb through `kubb.config.ts`.
- Change API contracts in the API OpenAPI source, or change generation behavior in `kubb.config.ts`, then run:

```bash
npm run generate -w @talelabs/sdk
```

- If generated files change, commit the generated output together with the source contract or Kubb config change that produced it.

## Manual Code

Manual SDK code belongs outside `src/gen`, such as:

```txt
src/client.ts
src/index.ts
scripts/
kubb.config.ts
```

Keep handwritten exports small and focused on wiring generated clients into the package surface.
