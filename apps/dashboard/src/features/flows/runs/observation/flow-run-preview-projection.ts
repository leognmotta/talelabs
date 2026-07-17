/** Projects durable run items into node-scoped previews without mutating the graph. */

import type { TFunction } from 'i18next'
import type {
  FlowGenerationPreview,
  FlowGenerationPreviewOutput,
} from '../../editor/flow-canvas-types'

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
    assetId: string
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
    assetId: input.asset.assetId,
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

/** Projects durable job outputs into the mounted preview and per-item result sets. */
export function previewFromOutputJobs(input: {
  fingerprint: string
  jobs: readonly {
    assetOutputs: readonly {
      assetId: string
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
