import type {
  FlowNodeType,
  GenerationModelDefinition,
  GenerationNodeType,
  GenerationSettingValue,
} from '@talelabs/flows'
import type { TFunction } from 'i18next'
import type {
  CanvasNode,
  FlowGenerationPreviewOutput,
} from './flow-canvas-types'

import { evaluateGenerationContract, resolveLlmState } from '@talelabs/flows'

export interface LlmMockRequest {
  imageAssetIds: readonly string[]
  instructions: string
  kind: 'text'
  labelKey: string
  locale: string
  modelContractVersion: string
  modelId: string
  operationId: string
  prompt: string
  settings: Readonly<Record<string, GenerationSettingValue>>
  templateVersion: 1
}

export interface MediaMockRequest {
  connectedSources: readonly string[]
  inputAssetIds: readonly string[]
  kind: 'media'
  labelKey: string
  locale: string
  mediaType: 'audio' | 'image' | 'video'
  modelContractVersion: string
  modelId: string
  nodeId: string
  nodeType: FlowNodeType
  operationId: string
  outputValueType: 'AudioSet' | 'ImageSet' | 'VideoSet'
  settings: Readonly<Record<string, GenerationSettingValue>>
  templateVersion: 1
  textInputs: Readonly<Record<string, string>>
}

export type GenerationMockRequest = LlmMockRequest | MediaMockRequest

function canonicalSettings(
  settings: Readonly<Record<string, GenerationSettingValue>>,
) {
  return Object.fromEntries(Object.entries(settings).toSorted(([left], [right]) => (
    left.localeCompare(right)
  )))
}

export function createLlmMockRequest(input: {
  connectionCounts: Readonly<Record<string, number>>
  imageAssetIds: readonly string[]
  instructions: string
  itemCounts: Readonly<Record<string, number>>
  locale: string
  model: GenerationModelDefinition
  node: CanvasNode
  prompt: string
}) {
  const resolution = resolveLlmState({
    connectionCounts: input.connectionCounts,
    inlineInstructions: input.instructions,
    inlinePrompt: input.prompt,
    itemCounts: input.itemCounts,
    model: input.model,
    settings: input.node.data.settings ?? {},
  })
  if (resolution.readiness !== 'ready' || !resolution.resolvedOperationId)
    return null

  return {
    imageAssetIds: [...input.imageAssetIds],
    instructions: input.instructions.trim(),
    kind: 'text',
    labelKey: input.model.labelKey,
    locale: input.locale,
    modelContractVersion: String(input.node.data.modelContractVersion),
    modelId: input.model.id,
    operationId: resolution.resolvedOperationId,
    prompt: input.prompt.trim(),
    settings: canonicalSettings(resolution.normalizedSettings),
    templateVersion: 1,
  } as const satisfies LlmMockRequest
}

export const FLOW_GENERATION_PREVIEW_ADAPTERS = {
  audioGeneration: {
    kind: 'media',
    mediaType: 'audio',
    outputValueType: 'AudioSet',
  },
  imageGeneration: {
    kind: 'media',
    mediaType: 'image',
    outputValueType: 'ImageSet',
  },
  llm: { kind: 'text', outputValueType: 'Text' },
  musicGeneration: {
    kind: 'media',
    mediaType: 'audio',
    outputValueType: 'AudioSet',
  },
  soundEffectGeneration: {
    kind: 'media',
    mediaType: 'audio',
    outputValueType: 'AudioSet',
  },
  speechGeneration: {
    kind: 'media',
    mediaType: 'audio',
    outputValueType: 'AudioSet',
  },
  videoGeneration: {
    kind: 'media',
    mediaType: 'video',
    outputValueType: 'VideoSet',
  },
  voiceChanger: {
    kind: 'media',
    mediaType: 'audio',
    outputValueType: 'AudioSet',
  },
  voiceIsolation: {
    kind: 'media',
    mediaType: 'audio',
    outputValueType: 'AudioSet',
  },
} as const satisfies Record<GenerationNodeType, {
  kind: 'media' | 'text'
  mediaType?: MediaMockRequest['mediaType']
  outputValueType: FlowGenerationPreviewOutput['valueType']
}>

export function createMediaMockRequest(input: {
  connectedSources: readonly string[]
  connectionCounts: Readonly<Record<string, number>>
  inputAssetIds: readonly string[]
  itemCounts: Readonly<Record<string, number>>
  locale: string
  model: GenerationModelDefinition
  node: CanvasNode
  operationId?: string
  settings?: Readonly<Record<string, GenerationSettingValue>>
  textInputs?: Readonly<Record<string, string>>
}) {
  const adapter = FLOW_GENERATION_PREVIEW_ADAPTERS[
    input.node.type as GenerationNodeType
  ]
  if (adapter.kind !== 'media')
    return null
  const operationId = input.operationId
    ?? String(input.node.data.operationId ?? '')
  const settings = input.settings ?? input.node.data.settings ?? {}
  const evaluation = evaluateGenerationContract({
    connectionCounts: input.connectionCounts,
    itemCounts: input.itemCounts,
    model: input.model,
    operationId,
    requireComplete: true,
    settings,
  })
  if (evaluation.issues.length > 0)
    return null

  return {
    connectedSources: [...input.connectedSources].toSorted(),
    inputAssetIds: [...input.inputAssetIds].toSorted(),
    kind: 'media',
    labelKey: input.model.labelKey,
    locale: input.locale,
    mediaType: adapter.mediaType,
    modelContractVersion: String(input.node.data.modelContractVersion),
    modelId: input.model.id,
    nodeId: input.node.id,
    nodeType: input.node.type,
    operationId,
    outputValueType: adapter.outputValueType,
    settings: canonicalSettings(settings),
    templateVersion: 1,
    textInputs: Object.fromEntries(
      ['lyrics', 'prompt']
        .map(key => [
          key,
          String(input.textInputs?.[key] ?? input.node.data[key] ?? '').trim(),
        ] as const)
        .filter(([, value]) => value.length > 0),
    ),
  } as const satisfies MediaMockRequest
}

export function fingerprintGenerationMockRequest(
  request: GenerationMockRequest,
) {
  const value = JSON.stringify(request)
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return `generation-mock-v1-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function escapeSvgText(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&apos;')
}

function createMediaPreviewSvg(request: MediaMockRequest, name: string) {
  const colors = {
    audio: ['#2a1804', '#f59e0b'],
    image: ['#25102d', '#a855f7'],
    video: ['#071d36', '#3b82f6'],
  } as const
  const [background, accent] = colors[request.mediaType]
  const safeName = escapeSvgText(name)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${background}"/><stop offset="1" stop-color="#080b12"/></linearGradient></defs>
  <rect width="1280" height="720" fill="url(#g)"/>
  <circle cx="640" cy="320" r="96" fill="none" stroke="${accent}" stroke-width="4" opacity=".7"/>
  <path d="M580 320h120M605 292v56M635 275v90M665 292v56" stroke="${accent}" stroke-width="10" stroke-linecap="round" opacity=".9"/>
  <text x="640" y="480" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="42" text-anchor="middle">${safeName}</text>
</svg>`
}

export function createGenerationMockOutput(
  request: GenerationMockRequest,
  t: TFunction,
): FlowGenerationPreviewOutput {
  const name = t(request.labelKey)
  if (request.kind === 'text') {
    const text = [
      t('flows.llm.mock.output', {
        count: request.imageAssetIds.length,
        prompt: request.prompt,
      }),
      ...(request.instructions
        ? [t('flows.llm.mock.instructionsApplied', {
            instructions: request.instructions,
          })]
        : []),
    ].join('\n\n')
    return {
      download: {
        content: text,
        fileName: `talelabs-text-${fingerprintGenerationMockRequest(request)}.txt`,
        mimeType: 'text/plain;charset=utf-8',
      },
      kind: 'text',
      name,
      text,
      valueType: 'Text',
    }
  }

  return {
    download: {
      content: createMediaPreviewSvg(request, name),
      fileName: `talelabs-${request.mediaType}-${request.nodeId}.svg`,
      mimeType: 'image/svg+xml;charset=utf-8',
    },
    kind: 'media',
    mediaType: request.mediaType,
    name,
    valueType: request.outputValueType,
  }
}
