/** Public source, execution-policy, and admission schemas for durable runs. */

import { z } from '@hono/zod-openapi'
import { PromptTemplateSchema } from '@talelabs/flows'

import { Cuid2Schema } from '../../schemas/common.js'

/** Supported Flow graph-selection modes. */
export const FlowRunModeSchema = z.enum([
  'node',
  'downstream',
  'upstream',
  'selection',
  'all',
])

/** Persisted run modes across Flow selection and direct generation. */
export const RunModeSchema = z.enum([
  'node',
  'downstream',
  'upstream',
  'selection',
  'all',
  'direct',
])

/** Immutable source of admitted execution work. */
export const RunSourceSchema = z.enum(['flow', 'create'])

/** Provider execution mode selected for a run. */
export const FlowRunExecutionModeSchema = z.enum(['live', 'debug'])

/** Environment responsible for provider lifecycle execution. */
export const FlowRunExecutionRuntimeSchema = z.enum(['managed', 'browser'])

/** Account source responsible for provider spend on an admitted run. */
export const FlowRunFundingSourceSchema = z.enum(['credits', 'byok'])

const CreateDirectRunInputSchema = z.object({
  assetId: Cuid2Schema,
  slotId: z.string().min(1).max(100),
}).strict()

const CreateDirectRunBaseSchema = z.object({
  audioIntent: z.enum([
    'speechGeneration',
    'musicGeneration',
    'soundEffectGeneration',
    'voiceChanger',
    'voiceIsolation',
  ]).optional(),
  byokProviders: z.array(z.enum(['fal', 'openrouter'])).max(8).optional(),
  executionMode: FlowRunExecutionModeSchema.default('live'),
  executionRuntime: FlowRunExecutionRuntimeSchema.default('managed'),
  fundingSource: FlowRunFundingSourceSchema,
  inline: z.record(
    z.string().min(1).max(100),
    z.string().max(16_000),
  ).refine(value => Object.keys(value).length <= 8),
  inputs: z.array(CreateDirectRunInputSchema).max(32),
  mediaMode: z.enum(['audio', 'image', 'video']),
  modelContractVersion: z.string().min(1).max(100),
  modelId: z.string().min(1).max(200),
  operationId: z.string().min(1).max(100),
  outputCount: z.number().int().min(1).max(16),
  promptTemplates: z.record(
    z.string().min(1).max(100),
    PromptTemplateSchema,
  ).refine(value => Object.keys(value).length <= 8),
  settings: z.record(
    z.string().min(1).max(100),
    z.union([z.boolean(), z.number().finite(), z.string().max(16_000)]),
  ).refine(value => Object.keys(value).length <= 64),
}).strict()

/** Direct Create request compiled without a Flow graph or persisted draft. */
export const CreateDirectRunRequestSchema = CreateDirectRunBaseSchema
  .extend({
    createSessionId: Cuid2Schema.optional(),
  })
  .openapi('CreateDirectRunRequest')

/** Direct Create estimate request using the same compiler and cost resolver. */
export const EstimateDirectRunRequestSchema = CreateDirectRunBaseSchema
  .omit({
    byokProviders: true,
    executionRuntime: true,
    fundingSource: true,
  })
  .extend({
    executionRuntime: z.literal('managed').default('managed'),
    fundingSource: z.literal('credits').default('credits'),
  })
  .openapi('EstimateDirectRunRequest')
