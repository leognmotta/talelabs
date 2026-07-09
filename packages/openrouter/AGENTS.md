# OpenRouter Package

This package owns server-side OpenRouter client wiring for TaleLabs.

## Rules

- Keep `OPENROUTER_API_KEY` server-side. Never import this package directly into browser-only dashboard code.
- Read API keys from environment at runtime or pass them explicitly from server code.
- Use the installed OpenRouter skills for model, image, and SDK-specific work:
  - `openrouter-typescript-sdk`
  - `openrouter`
  - `openrouter-models`
  - `openrouter-images`
  - `create-agent`
  - `nano-banana-pro-openrouter`
- Prefer the official `@openrouter/sdk` package for model calls.
- Keep product-specific prompts and workflows in consuming apps or services, not in this package.

## Checks

Before finishing changes here, run:

```bash
npm run check-types -w @talelabs/openrouter
npm run build -w @talelabs/openrouter
```
