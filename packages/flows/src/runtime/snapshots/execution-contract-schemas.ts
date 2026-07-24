/** Strict current and historical private provider execution-contract schemas. */

import { CatalogProviderBindingSchema } from '@talelabs/models-catalog'
import { z } from 'zod'

const positiveInteger = z.number().int().positive()
const nonnegativeInteger = z.number().int().nonnegative()

const executionContractFields = {
  adapterVersion: z.string(),
  catalogRevision: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  catalogVersion: positiveInteger,
  modelContractVersion: z.string(),
  modelId: z.string(),
  modelRevision: positiveInteger,
  operationId: z.string(),
  provider: z.string(),
  providerCostEstimate: z.object({
    amountUsd: z.string().regex(/^\d+(?:\.\d+)?$/),
    basis: z.object({
      formulaVersion: z.string().min(1),
      pricingModelId: z.string().min(1),
      pricingRetrievedAt: z.iso.datetime(),
      pricingSource: z.url(),
      unit: z.string().min(1),
      unitPriceUsd: z.string().regex(/^\d+(?:\.\d+)?$/),
    }).strict(),
    currency: z.literal('USD'),
    jobCount: positiveInteger,
    quantity: z.string().regex(/^\d+(?:\.\d+)?$/),
    quoteVersion: z.literal(1),
    status: z.literal('estimated'),
  }).strict().optional(),
  providerEndpoint: z.string(),
  providerEndpointTag: z.string().min(1),
  providerLifecycle: z.discriminatedUnion('submission', [
    z.object({
      cancellation: z.enum(['best-effort', 'supported', 'unsupported']),
      completions: z.tuple([z.literal('response')]),
      deliveries: z.tuple(
        [z.enum(['bytes', 'storage', 'stream', 'text', 'url'])],
        z.enum(['bytes', 'storage', 'stream', 'text', 'url']),
      ),
      submission: z.literal('immediate'),
    }).strict(),
    z.object({
      cancellation: z.enum(['best-effort', 'supported', 'unsupported']),
      completions: z.union([
        z.tuple([z.literal('poll')]),
        z.tuple([z.literal('webhook')]),
        z.tuple([z.literal('poll'), z.literal('webhook')]),
        z.tuple([z.literal('webhook'), z.literal('poll')]),
      ]),
      deliveries: z.tuple(
        [z.enum(['bytes', 'storage', 'stream', 'text', 'url'])],
        z.enum(['bytes', 'storage', 'stream', 'text', 'url']),
      ),
      submission: z.literal('asynchronous'),
    }).strict(),
  ]),
  providerModel: z.string(),
  providerBinding: CatalogProviderBindingSchema,
  providerRouteVersion: z.string(),
  providerSelection: z.object({
    eligibleCandidateCount: positiveInteger,
    estimatedCandidateCount: nonnegativeInteger,
    strategy: z.enum(['estimated_cost', 'priority', 'priority_fallback']),
  }).strict().optional(),
}

/** Current source-neutral private provider execution facts. */
export const executionContractSchema = z.object({
  ...executionContractFields,
  stepId: z.string().min(1),
}).strict()

/** Historical node-addressed execution facts accepted only during upcasting. */
export const legacyExecutionContractSchema = z.object({
  ...executionContractFields,
  nodeId: z.string().min(1),
}).strict()
