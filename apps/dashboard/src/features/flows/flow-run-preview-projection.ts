import type { FlowLatestResult, FlowRun } from '@talelabs/sdk'
import type { TFunction } from 'i18next'
import type {
  CanvasEdge,
  CanvasNode,
  FlowGenerationPreview,
  FlowGenerationPreviewOutput,
} from './flow-canvas-types'

import { isGenerationNodeType } from '@talelabs/flows'

function textPreviewOutput(input: {
  nodeId: string
  outputIndex: number
  t: TFunction
  text: string
}): FlowGenerationPreviewOutput {
  return {
    download: {
      content: input.text,
      fileName: `${input.nodeId}-${input.outputIndex}.txt`,
      mimeType: 'text/plain',
    },
    kind: 'text',
    name: input.t('flows.outputs.text'),
    text: input.text,
    valueType: 'Text',
  }
}

function mediaPreviewOutput(input: {
  asset: {
    mimeType: string
    outputIndex: number
    thumbnailUrl: null | string
    type: 'audio' | 'document' | 'image' | 'video'
    url: null | string
  }
  nodeId: string
  t: TFunction
}): FlowGenerationPreviewOutput | null {
  const previewUrl = input.asset.url ?? input.asset.thumbnailUrl
  if (!previewUrl)
    return null
  return {
    download: {
      content: previewUrl,
      fileName: `${input.nodeId}-${input.asset.outputIndex}`,
      mimeType: input.asset.mimeType,
    },
    kind: 'media',
    mediaType: input.asset.type === 'document' ? 'image' : input.asset.type,
    name: input.t(`flows.outputs.${input.asset.type === 'image' ? 'images' : input.asset.type === 'video' ? 'videos' : 'audio'}`),
    valueType: input.asset.type === 'image'
      ? 'ImageSet'
      : input.asset.type === 'video' ? 'VideoSet' : 'AudioSet',
  }
}

export function previewFromOutputJobs(input: {
  fingerprint: string
  jobs: readonly {
    assetOutputs: readonly {
      mimeType: string
      outputIndex: number
      thumbnailUrl: null | string
      type: 'audio' | 'document' | 'image' | 'video'
      url: null | string
    }[]
    itemKey: string
    jobId: string
    textOutputs: readonly { outputIndex: number, text: string }[]
  }[]
  nodeId: string
  t: TFunction
}): Extract<FlowGenerationPreview, { status: 'succeeded' }> | null {
  const resultSets = input.jobs
    .map(job => ({
      itemKey: job.itemKey,
      jobId: job.jobId,
      outputs: [
        ...job.textOutputs.map(output => ({
          output: textPreviewOutput({
            nodeId: input.nodeId,
            outputIndex: output.outputIndex,
            t: input.t,
            text: output.text,
          }),
          outputIndex: output.outputIndex,
        })),
        ...job.assetOutputs.flatMap((asset) => {
          const output = mediaPreviewOutput({ asset, nodeId: input.nodeId, t: input.t })
          return output ? [{ output, outputIndex: asset.outputIndex }] : []
        }),
      ].toSorted((left, right) => left.outputIndex - right.outputIndex),
    }))
    .filter(job => job.outputs.length > 0)
  const output = resultSets[0]?.outputs[0]?.output
  return output
    ? { fingerprint: input.fingerprint, output, resultSets, status: 'succeeded' }
    : null
}

export function initialPreviewsFromLatestResults(
  results: readonly FlowLatestResult[],
  t: TFunction,
) {
  const previews: Record<string, FlowGenerationPreview> = {}
  for (const result of [...results].toSorted((left, right) =>
    right.runCreatedAt.localeCompare(left.runCreatedAt)
    || left.runId.localeCompare(right.runId))) {
    const preview = previewFromOutputJobs({
      fingerprint: result.runId,
      jobs: result.jobs,
      nodeId: result.nodeId,
      t,
    })
    if (preview)
      previews[result.nodeId] = preview
  }
  return previews
}

export function preserveMountedMediaOutputs(
  current: FlowGenerationPreview | undefined,
  next: FlowGenerationPreview,
): FlowGenerationPreview {
  if (
    current?.status === 'error'
    || next.status !== 'succeeded'
    || !current
    || !('resultSets' in current)
    || !current.resultSets?.length
    || !next.resultSets?.length
  ) {
    return next
  }
  const currentOutputs = new Map(current.resultSets.flatMap(resultSet =>
    resultSet.outputs.map(result => [
      `${resultSet.jobId}\u0000${result.outputIndex}`,
      result.output,
    ] as const)))
  let reused = false
  const resultSets = next.resultSets.map(resultSet => ({
    ...resultSet,
    outputs: resultSet.outputs.map((result) => {
      const mounted = currentOutputs.get(`${resultSet.jobId}\u0000${result.outputIndex}`)
      if (
        !mounted
        || mounted.kind !== 'media'
        || result.output.kind !== 'media'
        || mounted.mediaType !== result.output.mediaType
        || mounted.valueType !== result.output.valueType
      ) {
        return result
      }
      reused = true
      return { ...result, output: mounted }
    }),
  }))
  return reused
    ? { ...next, output: resultSets[0]?.outputs[0]?.output ?? next.output, resultSets }
    : next
}

export function isActiveRunStatus(status: FlowRun['status']) {
  return status === 'pending' || status === 'running'
}

export function isRetryableRunStatus(
  status: FlowRun['status'],
): status is 'canceled' | 'failed' | 'partial' {
  return status === 'canceled' || status === 'failed' || status === 'partial'
}

export function activePreviewNodeIdsFromClosure(input: {
  edges: readonly CanvasEdge[]
  nodes: readonly CanvasNode[]
  previewNodeIds: readonly string[]
}) {
  const executableNodeIds = new Set(input.nodes
    .filter(node => input.previewNodeIds.includes(node.id))
    .filter(node => isGenerationNodeType(node.type))
    .map(node => node.id))
  return new Set(input.nodes
    .filter(node => executableNodeIds.has(node.id))
    .filter(node => !input.edges.some(edge =>
      edge.target === node.id && executableNodeIds.has(edge.source)))
    .map(node => node.id))
}

export function activeRunNodeIdsFromRun(input: {
  edges: readonly CanvasEdge[]
  run: FlowRun
}) {
  const nodesById = new Map(input.run.nodes.map(node => [node.nodeId, node]))
  const completedStatuses = new Set(['succeeded', 'skipped'])
  return new Set(input.run.nodes
    .filter((node) => {
      if (
        node.status === 'running'
        || node.items.some(item => item.status === 'running')
        || node.jobs.some(job => job.status === 'running')
      ) {
        return true
      }
      if (node.status !== 'pending')
        return false
      return !input.edges.some((edge) => {
        if (edge.target !== node.nodeId)
          return false
        const source = nodesById.get(edge.source)
        return source && !completedStatuses.has(source.status)
      })
    })
    .map(node => node.nodeId))
}

export function areGenerationPreviewsEqual(
  left: FlowGenerationPreview,
  right: FlowGenerationPreview,
) {
  return JSON.stringify(left) === JSON.stringify(right)
}
