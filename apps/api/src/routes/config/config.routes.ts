import type { OpenAPIHono } from '@hono/zod-openapi'
import type { GenerationConditionDefinition } from '@talelabs/flows'
import type { ApiEnv } from '../../types.js'

import { createRoute } from '@hono/zod-openapi'
import {
  ELEMENT_TYPE_REGISTRY,
  ELEMENT_TYPES,
} from '@talelabs/elements'
import {
  FLOW_NODE_TYPES,
  GENERATION_MODEL_CONTRACT_VERSION,
  GENERATION_MODELS,
  GENERATION_REGISTRY_VERSION,
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
      content: { 'application/json': { schema: GenerationConfigResponseSchema } },
    },
    ...commonErrorResponses,
  },
})

function settingLabel(settingId: string) {
  return settingId.replace(/([A-Z])/g, ' $1').replace(/^./, value => value.toUpperCase())
}

function serializeCondition(condition: GenerationConditionDefinition) {
  if (condition.field === 'operation')
    return { ...condition }
  if (condition.field === 'slot')
    return { ...condition }
  if (condition.operator === 'equals')
    return { ...condition }
  return { ...condition, values: [...condition.values] }
}

const generationConfig = {
  registryVersion: GENERATION_REGISTRY_VERSION,
  models: GENERATION_MODELS.map(model => ({
    contractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    id: model.id,
    displayName: model.displayName,
    labelKey: model.labelKey,
    mediaType: model.mediaType,
    provider: model.provider,
    enabled: model.enabled,
    recommended: model.recommended,
    defaultOperationId: model.defaultOperationId,
    capabilities: {
      operations: model.operations.map((operation) => {
        const { requiredSettingIds, ...base } = operation
        return {
          ...base,
          inputs: Object.fromEntries(Object.entries(operation.inputs).map(([id, contract]) => [
            id,
            {
              ...(contract.required ? { required: true } : {}),
              ...(contract.oneOf ? { oneOf: [...contract.oneOf] } : {}),
            },
          ])),
          inputSlotIds: [...operation.inputSlotIds],
          ...(requiredSettingIds
            ? { requiredSettingIds: [...requiredSettingIds] }
            : {}),
          settingIds: [...operation.settingIds],
        }
      }),
      inputSlots: model.inputSlots.map(slot => ({
        role: slot.id,
        label: settingLabel(slot.id),
        labelKey: slot.labelKey,
        descriptionKey: slot.descriptionKey,
        accepts: slot.accepts.flatMap(valueTypeToAssetTypes),
        valueTypes: [...slot.accepts],
        min: slot.minConnections,
        max: slot.maxItems,
        maxConnections: slot.maxConnections,
      })),
      settings: model.settings.map((setting) => {
        const base = {
          id: setting.id,
          label: settingLabel(setting.id),
          labelKey: setting.labelKey,
          ...(setting.descriptionKey
            ? { descriptionKey: setting.descriptionKey }
            : {}),
          ...('advanced' in setting && setting.advanced ? { advanced: true } : {}),
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
              ...option,
              label: settingLabel(option.value),
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
  elementTypes: ELEMENT_TYPES.map(id => ({
    id,
    previewRole: ELEMENT_TYPE_REGISTRY[id].previewRole,
    assetRoles: ELEMENT_TYPE_REGISTRY[id].assetRoles.map(role => ({
      id: role.id,
      accepts: [...role.accepts],
    })),
  })),
  nodeTypes: [...FLOW_NODE_TYPES],
  inputRoles: [...new Set(
    GENERATION_MODELS.flatMap(model => model.inputSlots.map(slot => slot.id)),
  )],
}

export function registerConfigRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(getGenerationConfigRoute, (c) => {
    c.header('Cache-Control', 'private, max-age=300')
    c.header('ETag', `"generation-config-${GENERATION_REGISTRY_VERSION}"`)
    return c.json(generationConfig, 200)
  })
}
