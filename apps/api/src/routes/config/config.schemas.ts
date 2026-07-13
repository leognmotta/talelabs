import { z } from '@hono/zod-openapi'
import { ELEMENT_TYPES } from '@talelabs/elements'
import { FLOW_NODE_TYPES } from '@talelabs/flows'

import { AssetTypeSchema, MediaTypeSchema } from '../../schemas/common.js'

const FlowValueTypeSchema = z.enum([
  'Text',
  'Asset',
  'ImageSet',
  'VideoSet',
  'AudioSet',
  'ElementContext',
])

const GenerationInputSlotSchema = z.object({
  role: z.string(),
  label: z.string(),
  labelKey: z.string(),
  descriptionKey: z.string(),
  accepts: z.array(AssetTypeSchema),
  valueTypes: z.array(FlowValueTypeSchema),
  min: z.number().int().nonnegative(),
  max: z.number().int().positive(),
  maxConnections: z.number().int().positive(),
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
  label: z.string(),
  labelKey: z.string(),
  descriptionKey: z.string().optional(),
  advanced: z.boolean().optional(),
  visibleWhen: z.array(GenerationConditionSchema).optional(),
})

const GenerationSettingSchema = z.discriminatedUnion('kind', [
  SettingBaseSchema.extend({
    kind: z.literal('enum'),
    default: z.string(),
    options: z.array(z.object({
      value: z.string(),
      label: z.string(),
      labelKey: z.string(),
    })),
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

export const GenerationConfigResponseSchema = z.object({
  registryVersion: z.string(),
  models: z.array(z.object({
    contractVersion: z.string(),
    id: z.string(),
    displayName: z.string(),
    labelKey: z.string(),
    mediaType: MediaTypeSchema,
    provider: z.object({
      id: z.string(),
      displayName: z.string(),
    }),
    enabled: z.boolean(),
    recommended: z.boolean(),
    defaultOperationId: z.string(),
    capabilities: z.object({
      operations: z.array(z.object({
        id: z.string(),
        labelKey: z.string(),
        descriptionKey: z.string(),
        inputs: z.record(z.string(), z.object({
          required: z.boolean().optional(),
          oneOf: z.array(z.string()).optional(),
        })),
        inputSlotIds: z.array(z.string()),
        requiredSettingIds: z.array(z.string()).optional(),
        settingIds: z.array(z.string()),
      })),
      inputSlots: z.array(GenerationInputSlotSchema),
      settings: z.array(GenerationSettingSchema),
      constraints: z.array(GenerationConstraintSchema),
    }),
  })),
  elementTypes: z.array(z.object({
    id: z.enum(ELEMENT_TYPES),
    previewRole: z.string().nullable(),
    assetRoles: z.array(z.object({
      id: z.string(),
      accepts: z.array(AssetTypeSchema),
    })),
  })),
  nodeTypes: z.array(z.enum(FLOW_NODE_TYPES)),
  inputRoles: z.array(z.string()),
}).openapi('GenerationConfigResponse')
