# Stripe Package

This package owns server-side Stripe SDK wiring for TaleLabs.

## Rules

- Keep `STRIPE_SECRET_KEY` server-side. Never import this package directly into browser-only dashboard code.
- `STRIPE_PUBLISHABLE_KEY` is public, but expose it intentionally through server routes or build-time client config instead of reading process env in UI components.
- Use the installed Stripe MCP tools and `stripe-best-practices` skill before adding Checkout, Billing, Connect, invoices, subscriptions, or payment method flows.
- Prefer Stripe Checkout Sessions for the first payment flow unless a product requirement needs lower-level PaymentIntents or Elements.
- Keep product-specific prices, plans, entitlements, and billing policy outside this package. This package should stay a small SDK/client boundary.
- Verify webhook signatures with `constructStripeWebhookEvent`; do not parse Stripe webhook JSON before signature verification.

## Checks

Before finishing changes here, run:

```bash
npm run check-types -w @talelabs/stripe
npm run build -w @talelabs/stripe
```
