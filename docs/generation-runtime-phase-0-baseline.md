# Generation Runtime Phase 0 Baseline

Status: captured before the 2026-07-16 cutover. This preserves the mechanical
before-state for `generation-runtime-simplification-plan.md`; the temporary
parity implementation described below has now been removed.

## Measured surface

| Area | TypeScript files | Physical lines |
| --- | ---: | ---: |
| `packages/flows/src/generation` | 72 | 9,422 |
| `packages/flows/src/runtime` | 39 | 2,786 |
| `packages/openrouter/src/routes` | 19 | 1,593 |
| `packages/openrouter/src/transport` | 10 | 516 |
| `packages/trigger/src/generation` | 43 | 2,589 |
| `packages/trigger/src/flow-runs` | 40 | 3,655 |
| **Total** | **223** | **20,561** |

## Current behavior inventory

- 43 selectable model records.
- 83 current model-operation routes.
- 341 total current and historical route records.
- Four shared OpenRouter protocols: image, video, speech, and chat.
- Five Flow run modes remain covered by the existing deterministic planner
  scenarios.
- Image, video, speech, chat, webhook wake-up, polling recovery, and stream
  behavior remain covered by fake-HTTP provider scenarios.

The exact active model capabilities, settings, operations, lifecycle facts,
request profiles, evidence, and bindings were captured mechanically in the
checked-in JSON sources under `packages/models-catalog`. Phase 1 used a temporary parity command;
Phase 7 removed it with the duplicated TypeScript registries.

## Baseline commands

```bash
npm run generation:check -w @talelabs/flows
npm run catalog:check -w @talelabs/models-catalog
npm run providers:verify -w @talelabs/trigger
npm run run:check -w @talelabs/flows
```
