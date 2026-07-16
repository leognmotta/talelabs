/**
 * Runtime schema for the checked-in model catalog JSON document.
 *
 * This module validates untrusted JSON structure before catalog indexes are
 * built. Cross-record business invariants remain in `catalog-validation.ts`.
 *
 */

import type { ModelCatalog } from './schema.js'

import { z } from 'zod'
import { CatalogProviderBindingSchema } from './providers/schema.js'

const settingValueSchema = z.union([z.boolean(), z.number(), z.string()])
const conditionSchema = z.union([
  z.object({
    field: z.literal('operation'),
    operator: z.literal('equals'),
    value: z.string().min(1),
  }).strict(),
  z.object({
    field: z.literal('setting'),
    id: z.string().min(1),
    operator: z.literal('equals'),
    value: settingValueSchema,
  }).strict(),
  z.object({
    field: z.literal('setting'),
    id: z.string().min(1),
    operator: z.literal('in'),
    values: z.array(settingValueSchema).min(1),
  }).strict(),
  z.object({
    field: z.literal('slot'),
    id: z.string().min(1),
    operator: z.literal('connected'),
  }).strict(),
])
const acceptedMediaSchema = z.object({
  aspectRatios: z.array(z.string().min(1)).min(1).optional(),
  durationSeconds: z.object({
    max: z.number().nonnegative(),
    min: z.number().nonnegative(),
  }).strict().optional(),
  framesPerSecond: z.array(z.number().positive()).min(1).optional(),
  maxBytes: z.number().int().positive().optional(),
  mimeTypes: z.array(z.string().min(1)).min(1),
  resolutions: z.array(z.string().min(1)).min(1).optional(),
}).strict()
const referenceProfileSchema = z.object({
  contactSheetPolicy: z.enum(['never', 'not-applicable', 'preferred', 'supported']),
  multipleSubjectSupport: z.enum(['not-applicable', 'supported', 'unknown', 'unsupported']),
  purposes: z.array(z.enum([
    'audioGuidance',
    'composition',
    'firstFrame',
    'identity',
    'lastFrame',
    'motion',
    'style',
    'subject',
    'videoExtension',
  ])).min(1),
  recommendedMaxItems: z.number().int().positive().optional(),
}).strict()
const inputSlotSchema = z.object({
  acceptedMedia: acceptedMediaSchema.optional(),
  accepts: z.array(z.enum(['Asset', 'AudioSet', 'ImageSet', 'Text', 'VideoSet'])).min(1),
  descriptionKey: z.string().min(1),
  id: z.string().min(1),
  labelKey: z.string().min(1),
  maxConnections: z.number().int().positive(),
  maxItems: z.number().int().positive(),
  minConnections: z.number().int().nonnegative(),
  referenceProfile: referenceProfileSchema.optional(),
}).strict()
const settingBaseSchema = z.object({
  advanced: z.boolean().optional(),
  descriptionKey: z.string().min(1).optional(),
  id: z.string().min(1),
  labelKey: z.string().min(1),
  visibleWhen: z.array(conditionSchema).optional(),
})
const settingSchema = z.discriminatedUnion('kind', [
  settingBaseSchema.extend({ default: z.boolean(), kind: z.literal('boolean') }).strict(),
  settingBaseSchema.extend({
    default: z.string(),
    kind: z.literal('enum'),
    options: z.array(z.object({
      labelKey: z.string().min(1),
      value: z.string(),
    }).strict()).min(1),
  }).strict(),
  settingBaseSchema.extend({
    default: z.number(),
    kind: z.literal('number'),
    max: z.number(),
    min: z.number(),
    step: z.number().positive(),
  }).strict(),
  settingBaseSchema.extend({
    default: z.string(),
    kind: z.literal('string'),
    maxLength: z.number().int().positive(),
  }).strict(),
])
const operationSchema = z.object({
  descriptionKey: z.string().min(1),
  id: z.string().min(1),
  inputs: z.record(z.string(), z.object({
    atLeastOne: z.array(z.string().min(1)).min(1).optional(),
    oneOf: z.array(z.string().min(1)).min(1).optional(),
    required: z.boolean().optional(),
  }).strict()),
  inputSlotIds: z.array(z.string().min(1)),
  labelKey: z.string().min(1),
  nodeType: z.enum([
    'audioGeneration',
    'imageGeneration',
    'llm',
    'musicGeneration',
    'soundEffectGeneration',
    'speechGeneration',
    'videoGeneration',
    'voiceChanger',
    'voiceIsolation',
  ]),
  output: z.object({
    count: z.object({
      default: z.number().int().positive(),
      max: z.number().int().positive(),
      min: z.number().int().positive(),
      settingId: z.string().min(1).optional(),
    }).strict(),
    mediaType: z.enum(['audio', 'image', 'text', 'video']),
  }).strict(),
  referenceLimit: z.object({
    maxItems: z.number().int().nonnegative(),
    slotIds: z.array(z.string().min(1)),
  }).strict(),
  requiredSettingIds: z.array(z.string().min(1)).optional(),
  settingIds: z.array(z.string().min(1)),
}).strict()
const modelSchema = z.object({
  bindings: z.array(CatalogProviderBindingSchema),
  capabilitySchemaVersion: z.literal(3),
  constraints: z.array(z.object({
    forbid: z.array(conditionSchema).optional(),
    id: z.string().min(1),
    messageKey: z.string().min(1),
    require: z.array(conditionSchema).optional(),
    when: z.array(conditionSchema),
  }).strict()),
  defaultOperationId: z.string().min(1),
  displayName: z.string().min(1),
  id: z.string().regex(/^[^/]+\/.+$/),
  inputSlots: z.array(inputSlotSchema),
  labelKey: z.string().min(1),
  llm: z.object({
    reasoning: z.object({
      default: z.enum(['auto', 'high', 'low', 'max', 'medium', 'minimal', 'off', 'xhigh']),
      mandatory: z.boolean(),
      options: z.array(z.enum(['auto', 'high', 'low', 'max', 'medium', 'minimal', 'off', 'xhigh'])).min(1),
    }).strict().optional(),
  }).strict().optional(),
  mediaType: z.enum(['audio', 'image', 'text', 'video']),
  operations: z.array(operationSchema).min(1),
  presentation: z.object({
    descriptionKey: z.string().min(1),
    logoId: z.enum([
      'alibaba',
      'bytedance',
      'claude',
      'deepseek',
      'elevenlabs',
      'flux',
      'gemini',
      'google',
      'kling',
      'lightricks',
      'llm',
      'microsoft',
      'minimax',
      'mistral',
      'moonshot',
      'nanobanana',
      'openai',
      'qwen',
      'recraft',
      'stability',
      'xai',
      'zai',
    ]),
  }).strict(),
  recommended: z.boolean(),
  revision: z.number().int().positive(),
  settings: z.array(settingSchema),
  status: z.enum(['active', 'deprecated', 'retired']),
}).strict()

/** Strict runtime schema for the assembled catalog document. */
export const ModelCatalogSchema: z.ZodType<ModelCatalog> = z.object({
  catalogVersion: z.literal(1),
  catalogRevision: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  defaults: z.object({
    audio: z.string().min(1),
    image: z.string().min(1),
    text: z.string().min(1),
    video: z.string().min(1),
  }).strict(),
  models: z.array(modelSchema).min(1),
}).strict()
