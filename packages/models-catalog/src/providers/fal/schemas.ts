/** Strict runtime schemas for reviewed fal.ai queue bindings. */

import type {
  CatalogFalProviderBinding,
  CatalogFalRequestProfile,
} from './contracts.js'

import { z } from 'zod'
import { CatalogProviderBindingCommonSchema } from '../contracts.js'
import { FAL_QUEUE_BASE } from './contracts.js'

const falParamValueSchema = z.union([z.string(), z.number(), z.boolean()])
const falMappedParamValueSchema = z.union([
  falParamValueSchema,
  z.object({
    height: z.number().int().positive(),
    width: z.number().int().positive(),
  }).strict(),
])
const falInputMappingSchema = z.object({
  alternativeFields: z.array(z.object({
    field: z.string().min(1),
    mediaType: z.enum(['audio', 'image', 'video']),
  }).strict()).optional(),
  cardinality: z.enum(['many', 'single']),
  field: z.string().min(1),
  maxItems: z.number().int().positive(),
  mediaType: z.enum(['audio', 'image', 'video']),
  minItems: z.number().int().nonnegative(),
  targetSlotId: z.string().min(1),
}).strict().refine(
  mapping => mapping.minItems <= mapping.maxItems,
  { message: 'minItems must not exceed maxItems' },
).refine(
  mapping => new Set([
    mapping.mediaType,
    ...(mapping.alternativeFields ?? []).map(field => field.mediaType),
  ]).size === 1 + (mapping.alternativeFields?.length ?? 0),
  { message: 'input mapping media types must be unique' },
).refine(
  mapping => new Set([
    mapping.field,
    ...(mapping.alternativeFields ?? []).map(field => field.field),
  ]).size === 1 + (mapping.alternativeFields?.length ?? 0),
  { message: 'input mapping fields must be unique' },
)
const falSettingConditionSchema = z.object({
  equals: falParamValueSchema,
  settingId: z.string().min(1),
}).strict()
const falSettingParamSchema = z.object({
  field: z.string().min(1),
  numberMultiplier: z.number().positive().finite().optional(),
  sendWhen: falSettingConditionSchema.optional(),
  settingId: z.string().min(1),
  valueMap: z.record(z.string(), falParamValueSchema).optional(),
}).strict().refine(
  param => param.numberMultiplier === undefined || param.valueMap === undefined,
  { message: 'number multipliers and value maps are mutually exclusive' },
).refine(
  param => param.sendWhen?.settingId !== param.settingId,
  { message: 'sendWhen must use a different setting' },
)
const falCombinedSettingParamSchema = z.object({
  field: z.string().min(1),
  settingIds: z.tuple([z.string().min(1), z.string().min(1)]),
  valueMap: z.record(
    z.string(),
    z.record(z.string(), falMappedParamValueSchema),
  ),
}).strict().refine(
  mapping => mapping.settingIds[0] !== mapping.settingIds[1],
  { message: 'combined setting IDs must be distinct' },
)
const falStaticParamsSchema = z.record(z.string(), falParamValueSchema)

const falRequestProfileSchemas = {
  image: z.object({
    combinedParams: z.array(falCombinedSettingParamSchema),
    inputMappings: z.array(falInputMappingSchema),
    kind: z.literal('image'),
    maxInputItems: z.number().int().nonnegative(),
    params: z.array(falSettingParamSchema),
    promptField: z.string().min(1).nullable(),
    requestedCountField: z.string().min(1).nullable(),
    settingIds: z.array(z.string().min(1)),
    staticParams: falStaticParamsSchema,
  }).strict(),
  speech: z.object({
    combinedParams: z.array(falCombinedSettingParamSchema),
    inputMappings: z.array(falInputMappingSchema),
    kind: z.literal('speech'),
    maxInputItems: z.number().int().nonnegative(),
    params: z.array(falSettingParamSchema),
    promptField: z.string().min(1).nullable(),
    settingIds: z.array(z.string().min(1)),
    staticParams: falStaticParamsSchema,
  }).strict(),
  video: z.object({
    combinedParams: z.array(falCombinedSettingParamSchema),
    inputMappings: z.array(falInputMappingSchema),
    kind: z.literal('video'),
    maxInputItems: z.number().int().nonnegative(),
    params: z.array(falSettingParamSchema),
    promptField: z.string().min(1).nullable(),
    settingIds: z.array(z.string().min(1)),
    staticParams: falStaticParamsSchema,
  }).strict(),
} as const

/** Shared discriminated schema for every fal request-shaping profile. */
export const FalRequestProfileSchema = z.discriminatedUnion('kind', [
  falRequestProfileSchemas.image,
  falRequestProfileSchemas.speech,
  falRequestProfileSchemas.video,
]) satisfies z.ZodType<CatalogFalRequestProfile>

/** Strict provider-specific schema for the fal queue binding. */
export const CatalogFalProviderBindingSchema = CatalogProviderBindingCommonSchema
  .extend({
    endpoint: z.literal(FAL_QUEUE_BASE),
    protocol: z.literal('queue'),
    provider: z.literal('fal'),
    providerTag: z.literal('fal-queue'),
    requestProfile: FalRequestProfileSchema,
  })
  .strict() satisfies z.ZodType<CatalogFalProviderBinding>
