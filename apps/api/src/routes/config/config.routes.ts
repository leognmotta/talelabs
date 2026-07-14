import type { OpenAPIHono } from '@hono/zod-openapi'
import type {
  FlowValueType,
  GenerationConditionDefinition,
} from '@talelabs/flows'
import type { ApiEnv } from '../../types.js'

import { createRoute } from '@hono/zod-openapi'
import {
  FLOW_NODE_TYPES,
  GENERATION_MODEL_CONTRACT_VERSION,
  GENERATION_MODELS,
  GENERATION_REGISTRY_VERSION,
  getGenerationModelPresentation,
  valueTypeToAssetTypes,
} from '@talelabs/flows'

import { commonErrorResponses } from '../product.responses.js'
import { GenerationConfigResponseSchema } from './config.schemas.js'
import './generation-provider-routes.js'

const getGenerationConfigRoute = createRoute({
  method: 'get',
  path: '/config/generation',
  tags: ['Config'],
  responses: {
    200: {
      description: 'Product-controlled generation configuration',
      content: {
        'application/json': { schema: GenerationConfigResponseSchema },
      },
    },
    ...commonErrorResponses,
  },
})

function serializeCondition(condition: GenerationConditionDefinition) {
  if (condition.field === 'operation')
    return { ...condition }
  if (condition.field === 'slot')
    return { ...condition }
  if (condition.operator === 'equals')
    return { ...condition }
  return { ...condition, values: [...condition.values] }
}

function serializePresentation(model: (typeof GENERATION_MODELS)[number]) {
  const presentation = getGenerationModelPresentation(model.id)
  if (!presentation) {
    throw new Error(
      `Current generation model ${model.id} is missing presentation metadata`,
    )
  }
  return { ...presentation }
}

type ActiveFlowValueType = Exclude<FlowValueType, 'ElementContext'>

function serializeActiveValueTypes(
  valueTypes: readonly FlowValueType[],
): ActiveFlowValueType[] {
  return valueTypes.map((valueType) => {
    if (valueType === 'ElementContext') {
      throw new Error(
        'Current generation models cannot expose deferred Element context inputs',
      )
    }
    return valueType
  })
}

const generationConfig = {
  registryVersion: GENERATION_REGISTRY_VERSION,
  models: GENERATION_MODELS.map(model => ({
    contractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    id: model.id,
    displayName: model.displayName,
    labelKey: model.labelKey,
    mediaType: model.mediaType,
    enabled: model.enabled,
    recommended: model.recommended,
    presentation: serializePresentation(model),
    defaultOperationId: model.defaultOperationId,
    capabilities: {
      ...(model.llm
        ? {
            llm: {
              ...(model.llm.reasoning
                ? {
                    reasoning: {
                      default: model.llm.reasoning.default,
                      mandatory: model.llm.reasoning.mandatory,
                      options: [...model.llm.reasoning.options],
                    },
                  }
                : {}),
            },
          }
        : {}),
      operations: model.operations.map((operation) => {
        if (!operation.output || !operation.referenceLimit) {
          throw new Error(
            `Current generation operation ${model.id}/${operation.id} is missing hardened capabilities`,
          )
        }
        if (!operation.nodeType) {
          throw new Error(
            `Current generation operation ${model.id}/${operation.id} is missing a node intent`,
          )
        }
        const { requiredSettingIds } = operation
        return {
          id: operation.id,
          labelKey: operation.labelKey,
          descriptionKey: operation.descriptionKey,
          inputs: Object.fromEntries(
            Object.entries(operation.inputs).map(([id, contract]) => [
              id,
              {
                ...(contract.required ? { required: true } : {}),
                ...(contract.oneOf ? { oneOf: [...contract.oneOf] } : {}),
                ...(contract.atLeastOne
                  ? { atLeastOne: [...contract.atLeastOne] }
                  : {}),
              },
            ]),
          ),
          inputSlotIds: [...operation.inputSlotIds],
          nodeType: operation.nodeType,
          output: {
            mediaType: operation.output.mediaType,
            count: {
              default: operation.output.count.default,
              min: operation.output.count.min,
              max: operation.output.count.max,
              ...(operation.output.count.settingId
                ? { settingId: operation.output.count.settingId }
                : {}),
            },
          },
          referenceLimit: {
            maxItems: operation.referenceLimit.maxItems,
            slotIds: [...operation.referenceLimit.slotIds],
          },
          ...(requiredSettingIds
            ? { requiredSettingIds: [...requiredSettingIds] }
            : {}),
          settingIds: [...operation.settingIds],
        }
      }),
      inputSlots: model.inputSlots.map((slot) => {
        const valueTypes = serializeActiveValueTypes(slot.accepts)
        return {
          role: slot.id,
          labelKey: slot.labelKey,
          descriptionKey: slot.descriptionKey,
          accepts: valueTypes.flatMap(valueTypeToAssetTypes),
          valueTypes,
          min: slot.minConnections,
          max: slot.maxItems,
          maxConnections: slot.maxConnections,
          ...(slot.acceptedMedia
            ? {
                acceptedMedia: {
                  mimeTypes: [...slot.acceptedMedia.mimeTypes],
                  ...(slot.acceptedMedia.maxBytes !== undefined
                    ? { maxBytes: slot.acceptedMedia.maxBytes }
                    : {}),
                  ...(slot.acceptedMedia.durationSeconds
                    ? {
                        durationSeconds: {
                          ...slot.acceptedMedia.durationSeconds,
                        },
                      }
                    : {}),
                  ...(slot.acceptedMedia.framesPerSecond
                    ? { framesPerSecond: [...slot.acceptedMedia.framesPerSecond] }
                    : {}),
                  ...(slot.acceptedMedia.resolutions
                    ? { resolutions: [...slot.acceptedMedia.resolutions] }
                    : {}),
                  ...(slot.acceptedMedia.aspectRatios
                    ? { aspectRatios: [...slot.acceptedMedia.aspectRatios] }
                    : {}),
                },
              }
            : {}),
          ...(slot.referenceProfile
            ? {
                referenceProfile: {
                  contactSheetPolicy: slot.referenceProfile.contactSheetPolicy,
                  multipleSubjectSupport:
                    slot.referenceProfile.multipleSubjectSupport,
                  purposes: [...slot.referenceProfile.purposes],
                  ...(slot.referenceProfile.recommendedMaxItems !== undefined
                    ? {
                        recommendedMaxItems:
                          slot.referenceProfile.recommendedMaxItems,
                      }
                    : {}),
                },
              }
            : {}),
        }
      }),
      settings: model.settings.map((setting) => {
        const base = {
          id: setting.id,
          labelKey: setting.labelKey,
          ...(setting.descriptionKey
            ? { descriptionKey: setting.descriptionKey }
            : {}),
          ...('advanced' in setting && setting.advanced
            ? { advanced: true }
            : {}),
          ...(setting.visibleWhen
            ? { visibleWhen: setting.visibleWhen.map(serializeCondition) }
            : {}),
        }
        if (setting.kind === 'enum') {
          return {
            ...base,
            kind: setting.kind,
            default: setting.default,
            options: setting.options.map(option => ({
              labelKey: option.labelKey,
              value: option.value,
            })),
          }
        }
        if (setting.kind === 'boolean') {
          return {
            ...base,
            kind: setting.kind,
            default: setting.default,
          }
        }
        if (setting.kind === 'string') {
          return {
            ...base,
            kind: setting.kind,
            default: setting.default,
            maxLength: setting.maxLength,
          }
        }
        return {
          ...base,
          kind: setting.kind,
          default: setting.default,
          min: setting.min,
          max: setting.max,
          step: setting.step,
        }
      }),
      constraints: model.constraints.map((constraint) => {
        const { forbid, require, ...base } = constraint
        return {
          ...base,
          when: constraint.when.map(serializeCondition),
          ...(constraint.require
            ? { require: constraint.require.map(serializeCondition) }
            : {}),
          ...(constraint.forbid
            ? { forbid: constraint.forbid.map(serializeCondition) }
            : {}),
        }
      }),
    },
  })),
  nodeTypes: [...FLOW_NODE_TYPES],
  inputRoles: [
    ...new Set(
      GENERATION_MODELS.flatMap(model =>
        model.inputSlots.map(slot => slot.id),
      ),
    ),
  ],
}

export function registerConfigRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(getGenerationConfigRoute, (c) => {
    c.header('Cache-Control', 'private, max-age=300')
    c.header('ETag', `"generation-config-${GENERATION_REGISTRY_VERSION}"`)
    return c.json(generationConfig, 200)
  })
}
