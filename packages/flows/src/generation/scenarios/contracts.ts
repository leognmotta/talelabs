/** Executable graph and cross-field contract capability scenarios. */

import type {
  GenerationModelDefinition,
  GenerationSettingValue,
} from '../registry/types.js'
import type { GenerationContractIssue } from '../resolution/evaluator.js'

import { validateExecutableFlowGraph } from '../../graph/validation.js'
import {
  getDefaultNodeData,
  getFlowNodeTypeDefinition,
} from '../../nodes/registry/index.js'
import { GENERATION_MODEL_REGISTRY } from '../registry/index.js'
import { evaluateGenerationContract } from '../resolution/evaluator.js'

interface CapabilityScenario {
  expectedIssueCodes?: readonly GenerationContractIssue['code'][]
  input: {
    connectionCounts: Readonly<Record<string, number>>
    itemCounts?: Readonly<Record<string, number>>
    model: GenerationModelDefinition
    operationId: string
    requireComplete?: boolean
    settings: Readonly<Record<string, GenerationSettingValue>>
  }
  name: string
}

function defaultSettings(model: GenerationModelDefinition) {
  return Object.fromEntries(
    model.settings.map(setting => [setting.id, setting.default]),
  )
}

const gptImage2 = GENERATION_MODEL_REGISTRY['openai/gpt-image-2']
const seedream50Lite
  = GENERATION_MODEL_REGISTRY['bytedance/seedream-5.0-lite']
const veo31 = GENERATION_MODEL_REGISTRY['google/veo-3.1']
const seedance20 = GENERATION_MODEL_REGISTRY['bytedance/seedance-2.0']

const CAPABILITY_SCENARIOS: readonly CapabilityScenario[] = [
  {
    input: {
      connectionCounts: { imageReferences: 1, prompt: 1 },
      itemCounts: { imageReferences: 3, prompt: 1 },
      model: gptImage2,
      operationId: 'imageToImage',
      requireComplete: true,
      settings: defaultSettings(gptImage2),
    },
    name: 'multiple image references with fixed single output',
  },
  {
    expectedIssueCodes: ['generation_input_required'],
    input: {
      connectionCounts: { imageReferences: 1, prompt: 1 },
      itemCounts: { imageReferences: 1, prompt: 0 },
      model: gptImage2,
      operationId: 'imageToImage',
      requireComplete: true,
      settings: defaultSettings(gptImage2),
    },
    name: 'structural prompt connection does not satisfy runtime input',
  },
  {
    input: {
      connectionCounts: { prompt: 1 },
      model: seedream50Lite,
      operationId: 'textToImage',
      requireComplete: true,
      settings: { ...defaultSettings(seedream50Lite), outputCount: 6 },
    },
    name: 'Seedream 5 exposes its reviewed six-output maximum',
  },
  {
    expectedIssueCodes: [
      'generation_output_count',
      'generation_setting_invalid',
    ],
    input: {
      connectionCounts: { prompt: 1 },
      model: seedream50Lite,
      operationId: 'textToImage',
      requireComplete: true,
      settings: { ...defaultSettings(seedream50Lite), outputCount: 7 },
    },
    name: 'Seedream 5 rejects output counts above six',
  },
  {
    input: {
      connectionCounts: { firstFrame: 1, lastFrame: 1, prompt: 1 },
      model: veo31,
      operationId: 'firstLastFrameToVideo',
      requireComplete: true,
      settings: defaultSettings(veo31),
    },
    name: 'first and last frame',
  },
  {
    input: {
      connectionCounts: {
        audioReferences: 1,
        imageReferences: 1,
        prompt: 1,
        videoReferences: 1,
      },
      model: seedance20,
      operationId: 'referencesToVideo',
      requireComplete: true,
      settings: defaultSettings(seedance20),
    },
    name: 'multimodal reference group accepts more than one member',
  },
  {
    input: {
      connectionCounts: {
        audioReferences: 3,
        imageReferences: 6,
        prompt: 1,
        videoReferences: 3,
      },
      itemCounts: {
        audioReferences: 3,
        imageReferences: 6,
        prompt: 1,
        videoReferences: 3,
      },
      model: seedance20,
      operationId: 'referencesToVideo',
      requireComplete: true,
      settings: defaultSettings(seedance20),
    },
    name: 'Seedance accepts its reviewed combined reference maximum',
  },
  {
    expectedIssueCodes: ['generation_reference_limit'],
    input: {
      connectionCounts: {
        audioReferences: 3,
        imageReferences: 7,
        prompt: 1,
        videoReferences: 3,
      },
      itemCounts: {
        audioReferences: 3,
        imageReferences: 7,
        prompt: 1,
        videoReferences: 3,
      },
      model: seedance20,
      operationId: 'referencesToVideo',
      requireComplete: true,
      settings: defaultSettings(seedance20),
    },
    name: 'Seedance rejects references above its combined maximum',
  },
  {
    expectedIssueCodes: ['generation_input_at_least_one'],
    input: {
      connectionCounts: { audioReferences: 1, prompt: 1 },
      model: seedance20,
      operationId: 'referencesToVideo',
      requireComplete: true,
      settings: defaultSettings(seedance20),
    },
    name: 'Seedance audio guidance requires an image or video reference',
  },
  {
    expectedIssueCodes: ['generation_input_at_least_one'],
    input: {
      connectionCounts: { prompt: 1 },
      model: seedance20,
      operationId: 'referencesToVideo',
      requireComplete: true,
      settings: defaultSettings(seedance20),
    },
    name: 'multimodal reference group requires at least one member',
  },
]

/** Verifies graph and cross-field evaluation for representative catalog models. */
export function validateGenerationContractCapabilityScenarios() {
  const errors: string[] = []
  for (const scenario of CAPABILITY_SCENARIOS) {
    const actualCodes = evaluateGenerationContract(scenario.input)
      .issues
      .map(issue => issue.code)
      .toSorted()
    const expectedCodes = [...(scenario.expectedIssueCodes ?? [])].toSorted()
    if (JSON.stringify(actualCodes) !== JSON.stringify(expectedCodes)) {
      errors.push(
        `${scenario.name}: expected [${expectedCodes.join(', ')}], received [${actualCodes.join(', ')}]`,
      )
    }
  }

  const seedreamVisibility = evaluateGenerationContract({
    connectionCounts: { prompt: 1 },
    model: seedream50Lite,
    operationId: 'textToImage',
    requireComplete: true,
    settings: defaultSettings(seedream50Lite),
  }).visibleSettingIds
  if (!seedreamVisibility.includes('outputCount')) {
    errors.push(
      'Seedream 5 output count must remain visible through the generic catalog contract',
    )
  }

  const emptyConnectedTextResult = validateExecutableFlowGraph({
    context: { assetTypesById: {}, elementReferencesById: {} },
    edges: [
      {
        createdAt: '2026-07-14T00:00:00.000Z',
        id: 'empty-text-to-llm-prompt',
        sourceHandle: 'text',
        sourceNodeId: 'empty-text',
        targetHandle: 'prompt',
        targetNodeId: 'llm',
      },
    ],
    nodes: [
      {
        assetId: null,
        data: getDefaultNodeData('text'),
        id: 'empty-text',
        positionX: 0,
        positionY: 0,
        schemaVersion: getFlowNodeTypeDefinition('text').currentVersion,
        type: 'text',
      },
      {
        assetId: null,
        data: getDefaultNodeData('llm'),
        id: 'llm',
        positionX: 100,
        positionY: 0,
        schemaVersion: getFlowNodeTypeDefinition('llm').currentVersion,
        type: 'llm',
      },
    ],
  })
  if (
    emptyConnectedTextResult.valid
    || !emptyConnectedTextResult.issues.some(
      issue => issue.code === 'generation_input_required',
    )
  ) {
    errors.push(
      'Executable validation must reject an empty connected Text prompt',
    )
  }
  return errors
}
