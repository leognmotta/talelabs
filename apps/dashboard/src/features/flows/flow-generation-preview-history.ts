import type { FlowLatestResult } from '@talelabs/sdk'
import type { TFunction } from 'i18next'
import type { FlowGenerationPreview } from './flow-canvas-types'

import { previewFromOutputJobs } from './flow-run-preview-projection'

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

/** Keeps the latest canonical result visible while a newer attempt is in flight or fails. */
export function generationPreviewHistory(
  preview: FlowGenerationPreview | undefined,
): Pick<FlowGenerationPreview, 'output' | 'resultSets'> {
  if (!preview)
    return {}
  return {
    ...('output' in preview && preview.output ? { output: preview.output } : {}),
    ...('resultSets' in preview && preview.resultSets
      ? { resultSets: preview.resultSets }
      : {}),
  }
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
      return {
        ...result,
        output: { ...result.output, download: mounted.download },
      }
    }),
  }))
  return reused
    ? { ...next, output: resultSets[0]?.outputs[0]?.output ?? next.output, resultSets }
    : next
}
