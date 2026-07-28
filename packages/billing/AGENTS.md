# Billing Package Instructions

- `@talelabs/billing` is the only maintained source for TaleLabs commercial
  plans, offers, top-up pricing, credit arithmetic, and monthly grant periods.
- Keep this package provider-neutral and infrastructure-free. It must not import
  Stripe, Hono, PostgreSQL, React, or Trigger.dev.
- Use integer minor units and exact rational or decimal-string arithmetic for
  every financial calculation. JavaScript floating point must not decide money,
  credits, contribution margins, or grant allocation.
- Public projections must omit Stripe lookup keys, provider economics, margin
  inputs, and historical private policy.
- Every catalog change is an immutable revision: add new offer codes and lookup
  keys rather than mutating historical commercial facts.

