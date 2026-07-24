/**
 * Focused direct-generation compiler scenarios over the current catalog.
 *
 * These checks are pure: they do not open PostgreSQL, dispatch Trigger.dev, or
 * call a provider. They exercise the same server resolver used by estimate and
 * admission and verify the generic immutable job produced for each Create mode.
 */

import type {
  AudioIntentNodeType,
  GenerationNodeType,
  GenerationSettingValue,
} from '@talelabs/flows'
import type {
  DirectGenerationAsset,
  DirectGenerationRequest,
} from '../src/domain/runs/direct-generation-resolution.js'

import assert from 'node:assert/strict'

import {
  getDefaultGenerationDataForNodeType,
  getGenerationModel,
  getGenerationOperation,
  promptTemplateFromText,
  readFlowRunJobRequestPayload,
} from '@talelabs/flows'

import {
  resolveDirectGeneration,
} from '../src/domain/runs/direct-generation-resolution.js'

type DirectScenarioNodeType = Extract<
  GenerationNodeType,
  | 'imageGeneration'
  | 'musicGeneration'
  | 'soundEffectGeneration'
  | 'speechGeneration'
  | 'videoGeneration'
>

const SCENARIOS: readonly {
  audioIntent?: AudioIntentNodeType
  mediaMode: DirectGenerationRequest['mediaMode']
  nodeType: DirectScenarioNodeType
}[] = [
  { mediaMode: 'image', nodeType: 'imageGeneration' },
  { mediaMode: 'video', nodeType: 'videoGeneration' },
  {
    audioIntent: 'speechGeneration',
    mediaMode: 'audio',
    nodeType: 'speechGeneration',
  },
  {
    audioIntent: 'musicGeneration',
    mediaMode: 'audio',
    nodeType: 'musicGeneration',
  },
  {
    audioIntent: 'soundEffectGeneration',
    mediaMode: 'audio',
    nodeType: 'soundEffectGeneration',
  },
]

function expectedOutputCount(input: {
  operation: NonNullable<ReturnType<typeof getGenerationOperation>>
  settings: Readonly<Record<string, GenerationSettingValue>>
}) {
  const count = input.operation.output?.count
  if (!count)
    return 1
  const value = count.settingId
    ? input.settings[count.settingId]
    : count.default
  return typeof value === 'number' ? value : count.default
}

function scenarioRequest(
  scenario: typeof SCENARIOS[number],
): DirectGenerationRequest {
  const defaults = getDefaultGenerationDataForNodeType(scenario.nodeType)
  const model = getGenerationModel(
    defaults.modelId,
    defaults.modelContractVersion,
  )
  assert.ok(model, `${scenario.nodeType}: current default model`)
  const operation = getGenerationOperation(model, defaults.operationId)
  assert.ok(operation, `${scenario.nodeType}: current default operation`)
  return {
    ...(scenario.audioIntent ? { audioIntent: scenario.audioIntent } : {}),
    executionMode: 'debug',
    executionRuntime: 'managed',
    fundingSource: 'credits',
    inline: scenario.nodeType === 'musicGeneration'
      ? { lyrics: '' }
      : {},
    inputs: [],
    mediaMode: scenario.mediaMode,
    modelContractVersion: defaults.modelContractVersion,
    modelId: defaults.modelId,
    operationId: defaults.operationId,
    outputCount: expectedOutputCount({
      operation,
      settings: defaults.settings,
    }),
    promptTemplates: {
      prompt: promptTemplateFromText(
        `TaleLabs ${scenario.nodeType} direct compiler scenario`,
      ),
    },
    settings: defaults.settings,
  }
}

function verifyCurrentCatalogModes() {
  for (const scenario of SCENARIOS) {
    const request = scenarioRequest(scenario)
    let first: ReturnType<typeof resolveDirectGeneration>
    try {
      first = resolveDirectGeneration({
        assetsById: new Map(),
        request,
      })
    }
    catch (error) {
      throw new Error(
        `${scenario.nodeType}: direct request did not compile`,
        { cause: error },
      )
    }
    const second = resolveDirectGeneration({
      assetsById: new Map(),
      request,
    })
    assert.deepEqual(
      first,
      second,
      `${scenario.nodeType}: estimate and admission compilation parity`,
    )
    assert.equal(first.source.kind, 'create')
    assert.equal(first.executionPlan.steps.length, 1)
    assert.equal(first.executionPlan.steps[0]?.stepType, scenario.nodeType)
    assert.equal(first.executionPlan.dependencies.length, 0)
    assert.equal(first.executionPlan.levels.length, 1)
    assert.equal('graph' in first.source, false)
    assert.equal('flowId' in first.source, false)
    const shard = first.executionPlan.steps[0]?.workItems[0]?.requestShards[0]
    assert.ok(shard, `${scenario.nodeType}: one canonical request shard`)
    assert.equal(shard.requestPayload.requestPayloadVersion, 6)
    assert.deepEqual(
      readFlowRunJobRequestPayload({
        requestHash: shard.jobHash,
        requestPayload: shard.requestPayload,
      }),
      shard.requestPayload,
    )
  }
}

function verifyLegacyImageAliasNormalization() {
  const defaults = getDefaultGenerationDataForNodeType('imageGeneration')
  const model = getGenerationModel(
    defaults.modelId,
    defaults.modelContractVersion,
  )
  assert.ok(model)
  const operation = model.operations.find(candidate =>
    candidate.nodeType === 'imageGeneration'
    && candidate.inputSlotIds.includes('imageReferences'),
  )
  assert.ok(operation, 'default image model supports reference generation')
  const asset: DirectGenerationAsset = {
    durationSeconds: null,
    height: 1024,
    id: 'alias-image-asset',
    mimeType: 'image/png',
    processingState: 'ready',
    sizeBytes: 1_024,
    type: 'image',
    unavailable: false,
    width: 1024,
  }
  const request: DirectGenerationRequest = {
    executionMode: 'debug',
    executionRuntime: 'managed',
    fundingSource: 'credits',
    inline: {},
    inputs: [{ assetId: asset.id, slotId: 'references' }],
    mediaMode: 'image',
    modelContractVersion: defaults.modelContractVersion,
    modelId: defaults.modelId,
    operationId: operation.id,
    outputCount: expectedOutputCount({
      operation,
      settings: defaults.settings,
    }),
    promptTemplates: {
      prompt: {
        parts: [
          { text: 'Restyle ', type: 'text' },
          {
            index: 0,
            mediaType: 'image',
            slotId: 'references',
            type: 'input',
          },
        ],
        version: 1,
      },
    },
    settings: defaults.settings,
  }
  const compiled = resolveDirectGeneration({
    assetsById: new Map([[asset.id, asset]]),
    request,
  })
  assert.equal(compiled.source.request.inputs[0]?.slotId, 'imageReferences')
  const prompt = compiled.source.request.promptTemplates.prompt
  const inputPart = prompt?.parts.find(part => part.type === 'input')
  assert.equal(
    inputPart?.type === 'input' ? inputPart.slotId : null,
    'imageReferences',
  )
}

verifyCurrentCatalogModes()
verifyLegacyImageAliasNormalization()
console.log(
  'Direct generation: image, video, speech, music, sound effect, parity, and legacy aliases verified.',
)
