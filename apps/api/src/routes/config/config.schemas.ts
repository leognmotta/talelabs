/** OpenAPI response schemas for provider-neutral generation configuration. */

import { z } from '@hono/zod-openapi'
import {
  GENERATION_NODE_TYPES,
  SELECTABLE_FLOW_NODE_TYPES,
} from '@talelabs/flows'

import { AssetTypeSchema } from '../../schemas/common.js'

const GenerationOutputTypeSchema = z.enum(['audio', 'image', 'text', 'video'])

/** Connected browser providers considered by the canonical binding selector. */
export const BrowserGenerationAvailabilityRequestSchema = z.object({
  modelId: z.string().min(1).max(200),
  operationId: z.string().min(1).max(100),
  providers: z.array(z.enum(['fal', 'openrouter'])).max(8),
})

/** Provider-neutral browser execution readiness for one model operation. */
export const BrowserGenerationAvailabilityResponseSchema = z.object({
  catalogRevision: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  executable: z.boolean(),
})

const FlowValueTypeSchema = z.enum([
  'Text',
  'Asset',
  'ImageSet',
  'VideoSet',
  'AudioSet',
])

const GenerationAcceptedMediaSchema = z.object({
  mimeTypes: z.array(z.string()).min(1),
  maxBytes: z.number().int().positive().optional(),
  durationSeconds: z
    .object({
      min: z.number().nonnegative(),
      max: z.number().nonnegative(),
    })
    .optional(),
  framesPerSecond: z.array(z.number().positive()).min(1).optional(),
  resolutions: z.array(z.string()).min(1).optional(),
  aspectRatios: z.array(z.string()).min(1).optional(),
})

const GenerationReferenceProfileSchema = z.object({
  contactSheetPolicy: z.enum([
    'never',
    'not-applicable',
    'preferred',
    'supported',
  ]),
  multipleSubjectSupport: z.enum([
    'not-applicable',
    'supported',
    'unknown',
    'unsupported',
  ]),
  purposes: z
    .array(
      z.enum([
        'audioGuidance',
        'composition',
        'firstFrame',
        'identity',
        'lastFrame',
        'motion',
        'style',
        'subject',
        'videoExtension',
      ]),
    )
    .min(1),
  recommendedMaxItems: z.number().int().positive().optional(),
})

const GenerationInputSlotSchema = z.object({
  role: z.string(),
  labelKey: z.string(),
  descriptionKey: z.string(),
  accepts: z.array(AssetTypeSchema),
  valueTypes: z.array(FlowValueTypeSchema),
  min: z.number().int().nonnegative(),
  max: z.number().int().positive(),
  maxConnections: z.number().int().positive(),
  acceptedMedia: GenerationAcceptedMediaSchema.optional(),
  referenceProfile: GenerationReferenceProfileSchema.optional(),
})

const GenerationConditionSchema = z.union([
  z.object({
    field: z.literal('operation'),
    operator: z.literal('equals'),
    value: z.string(),
  }),
  z.object({
    field: z.literal('setting'),
    id: z.string(),
    operator: z.literal('equals'),
    value: z.union([z.boolean(), z.number(), z.string()]),
  }),
  z.object({
    field: z.literal('setting'),
    id: z.string(),
    operator: z.literal('in'),
    values: z.array(z.union([z.boolean(), z.number(), z.string()])),
  }),
  z.object({
    field: z.literal('slot'),
    id: z.string(),
    operator: z.literal('connected'),
  }),
])

const SettingBaseSchema = z.object({
  id: z.string(),
  labelKey: z.string(),
  descriptionKey: z.string().optional(),
  advanced: z.boolean().optional(),
  visibleWhen: z.array(GenerationConditionSchema).optional(),
})

const GenerationSettingSchema = z.discriminatedUnion('kind', [
  SettingBaseSchema.extend({
    kind: z.literal('enum'),
    default: z.string(),
    options: z.array(
      z.object({
        value: z.string(),
        labelKey: z.string(),
      }),
    ),
  }),
  SettingBaseSchema.extend({
    kind: z.literal('number'),
    default: z.number(),
    min: z.number(),
    max: z.number(),
    step: z.number().positive(),
  }),
  SettingBaseSchema.extend({
    kind: z.literal('boolean'),
    default: z.boolean(),
  }),
  SettingBaseSchema.extend({
    kind: z.literal('string'),
    default: z.string(),
    maxLength: z.number().int().positive(),
  }),
])

const GenerationConstraintSchema = z.object({
  id: z.string(),
  messageKey: z.string(),
  when: z.array(GenerationConditionSchema),
  require: z.array(GenerationConditionSchema).optional(),
  forbid: z.array(GenerationConditionSchema).optional(),
})

/** Public fail-closed schema for the generation configuration response. */
export const GenerationConfigResponseSchema = z
  .object({
    catalogRevision: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    models: z.array(
      z.object({
        contractVersion: z.string(),
        id: z.string(),
        displayName: z.string(),
        labelKey: z.string(),
        mediaType: GenerationOutputTypeSchema,
        enabled: z.boolean(),
        recommended: z.boolean(),
        revision: z.number().int().positive(),
        presentation: z.object({
          descriptionKey: z.string(),
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
        }),
        defaultOperationId: z.string(),
        capabilities: z.object({
          llm: z.object({
            reasoning: z.object({
              default: z.enum([
                'off',
                'auto',
                'minimal',
                'low',
                'medium',
                'high',
                'max',
                'xhigh',
              ]),
              mandatory: z.boolean(),
              options: z.array(z.enum([
                'off',
                'auto',
                'minimal',
                'low',
                'medium',
                'high',
                'max',
                'xhigh',
              ])).min(1),
            }).optional(),
          }).optional(),
          operations: z.array(
            z.object({
              id: z.string(),
              labelKey: z.string(),
              descriptionKey: z.string(),
              inputs: z.record(
                z.string(),
                z.object({
                  required: z.boolean().optional(),
                  oneOf: z.array(z.string()).optional(),
                  atLeastOne: z.array(z.string()).optional(),
                }),
              ),
              inputSlotIds: z.array(z.string()),
              nodeType: z.enum(GENERATION_NODE_TYPES),
              output: z.object({
                mediaType: GenerationOutputTypeSchema,
                count: z.object({
                  default: z.number().int().positive(),
                  min: z.number().int().positive(),
                  max: z.number().int().positive(),
                  settingId: z.string().optional(),
                }),
              }),
              referenceLimit: z.object({
                maxItems: z.number().int().nonnegative(),
                slotIds: z.array(z.string()),
              }),
              requiredSettingIds: z.array(z.string()).optional(),
              settingIds: z.array(z.string()),
            }),
          ),
          inputSlots: z.array(GenerationInputSlotSchema),
          settings: z.array(GenerationSettingSchema),
          constraints: z.array(GenerationConstraintSchema),
        }),
      }),
    ),
    nodeTypes: z.array(z.enum(SELECTABLE_FLOW_NODE_TYPES)),
    inputRoles: z.array(z.string()),
  })
  .openapi('GenerationConfigResponse')
