import type { FlowLatestResult, FlowRun } from '@talelabs/sdk'
import type { TFunction } from 'i18next'
import type { RefObject } from 'react'
import type {
  CanvasEdge,
  CanvasNode,
  FlowGenerationPreview,
  FlowGenerationPreviewOutput,
  FlowReferenceData,
} from './flow-canvas-types'
import type { FlowGenerationPreviewScope } from './flow-mock-runtime-planner'

import { isGenerationNodeType } from '@talelabs/flows'
import { postRunsIdRetry } from '@talelabs/sdk'
import apiClient from '@talelabs/sdk/client'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import {
  createFlowMockRuntimePlanner,
} from './flow-mock-runtime-planner'
import { flowQueryKeys } from './flow-query-keys'
import { useFlowRunDetailQueries } from './flow.queries'

/** Owns the complete ephemeral M4 mock-preview lifecycle for the canvas. */
export function useFlowMockRunOrchestration(input: {
  edges: readonly CanvasEdge[]
  edgesRef: RefObject<CanvasEdge[]>
  flowId: string
  initialActiveRunIds: readonly string[]
  initialLatestResults: readonly FlowLatestResult[]
  locale: string
  nodes: readonly CanvasNode[]
  nodesRef: RefObject<CanvasNode[]>
  organizationId: string
  referenceData: FlowReferenceData
  referenceDataRef: RefObject<FlowReferenceData>
  saveNow: (options?: {
    reconcileWithServer?: boolean
  }) => Promise<null | number>
  t: TFunction
}) {
  const t = input.t
  const initialPreviewsRef = useRef<Readonly<Record<string, FlowGenerationPreview>> | null>(null)
  if (initialPreviewsRef.current === null)
    initialPreviewsRef.current = initialPreviewsFromLatestResults(input.initialLatestResults, t)
  const [previews, setPreviews] = useState<
    Readonly<Record<string, FlowGenerationPreview>>
  >(() => initialPreviewsRef.current ?? {})
  const [runAllRunIds, dispatchRunAllRunIds] = useReducer(
    activeRunIdsReducer,
    [],
    stableRunIds,
  )
  const [activeRunIds, dispatchActiveRunIds] = useReducer(
    activeRunIdsReducer,
    input.initialActiveRunIds,
    stableRunIds,
  )
  const queryClient = useQueryClient()
  const runDetailQueries = useFlowRunDetailQueries(activeRunIds)
  const terminalRunIdsRef = useRef(new Set<string>())
  const previewsRef = useRef(previews)
  const planner = useMemo(() => createFlowMockRuntimePlanner({
    edges: input.edges,
    locale: input.locale,
    nodes: input.nodes,
    previews,
    referenceData: input.referenceData,
  }), [input.edges, input.locale, input.nodes, input.referenceData, previews])
  const createCurrentPlanner = useCallback(
    () => createFlowMockRuntimePlanner({
      edges: input.edgesRef.current,
      locale: input.locale,
      nodes: input.nodesRef.current,
      previews: previewsRef.current,
      referenceData: input.referenceDataRef.current,
    }),
    [input.edgesRef, input.locale, input.nodesRef, input.referenceDataRef],
  )
  const updatePreview = useCallback((
    nodeId: string,
    preview: FlowGenerationPreview,
  ) => {
    const current = previewsRef.current[nodeId]
    if (current && areGenerationPreviewsEqual(current, preview))
      return
    const next = { ...previewsRef.current, [nodeId]: preview }
    previewsRef.current = next
    setPreviews(next)
  }, [])
  const updateRunStatePreview = useCallback((
    nodeId: string,
    fingerprint: string,
    status: 'pending' | 'queued',
  ) => {
    const current = previewsRef.current[nodeId]
    updatePreview(nodeId, {
      fingerprint,
      ...(current?.status === 'succeeded' ? { output: current.output } : {}),
      ...(current && 'resultSets' in current ? { resultSets: current.resultSets } : {}),
      status,
    })
  }, [updatePreview])
  const updateFromRun = useCallback((run: FlowRun) => {
    const terminal = !isActiveRunStatus(run.status)
    if (terminalRunIdsRef.current.has(run.id) && !terminal) {
      return
    }
    if (terminal)
      terminalRunIdsRef.current.add(run.id)
    if (run.mode === 'all' && terminal)
      dispatchRunAllRunIds({ runId: run.id, type: 'remove' })
    else if (run.mode === 'all')
      dispatchRunAllRunIds({ runId: run.id, type: 'add' })

    const activeRunNodeIds = activeRunNodeIdsFromRun({
      edges: input.edgesRef.current,
      run,
    })
    for (const node of run.nodes) {
      const fingerprint = run.planHash || run.id
      const preview = previewFromOutputJobs({
        fingerprint,
        jobs: node.jobs
          .filter(job => job.status === 'succeeded')
          .map(job => ({
            assetOutputs: job.assetOutputs,
            itemKey: job.itemKey,
            jobId: job.id,
            textOutputs: job.textOutputs,
          })),
        nodeId: node.nodeId,
        t,
      })
      if (!preview) {
        if (node.status === 'pending' || node.status === 'running') {
          updateRunStatePreview(
            node.nodeId,
            fingerprint,
            activeRunNodeIds.has(node.nodeId) ? 'pending' : 'queued',
          )
        }
        else if (['failed', 'canceled', 'skipped'].includes(node.status)) {
          updatePreview(node.nodeId, {
            errorKey: 'flows.runStatus.failed',
            fingerprint,
            ...(terminal && isRetryableRunStatus(run.status)
              ? {
                  retrySource: {
                    runId: run.id,
                    status: run.status,
                  },
                }
              : {}),
            status: 'error',
          })
        }
        continue
      }
      updatePreview(
        node.nodeId,
        preserveMountedMediaOutputs(
          previewsRef.current[node.nodeId],
          terminal
          && node.status !== 'succeeded'
          && isRetryableRunStatus(run.status)
            ? {
                ...preview,
                retrySource: {
                  runId: run.id,
                  status: run.status,
                },
              }
            : preview,
        ),
      )
    }
    if (terminal) {
      dispatchActiveRunIds({ runId: run.id, type: 'remove' })
      terminalRunIdsRef.current.delete(run.id)
    }
  }, [input.edgesRef, t, updateRunStatePreview, updatePreview])

  const observeRun = useCallback((run: FlowRun) => {
    updateFromRun(run)
    queryClient.setQueryData(
      flowQueryKeys.run(input.organizationId, run.id),
      run,
    )
    void queryClient.invalidateQueries({
      queryKey: flowQueryKeys.activeRuns(input.organizationId),
    })
    if (isActiveRunStatus(run.status))
      dispatchActiveRunIds({ runId: run.id, type: 'add' })
  }, [input.organizationId, queryClient, updateFromRun])

  const admitRun = useCallback(async (command: FlowRunCommandRequest) => {
    const revision = await input.saveNow()
    if (revision === null) {
      toast.error(input.t('flows.saveStatus.error'))
      return undefined
    }
    const run = await apiClient<FlowRun>({
      data: {
        expectedFlowRevision: revision,
        mode: command.mode,
        ...(command.mode === 'selection'
          ? { selectedNodeIds: command.selectedNodeIds }
          : command.mode === 'all'
            ? {}
            : { targetNodeId: command.targetNodeId }),
      },
      headers: {
        ...getOrganizationRequestHeaders(input.organizationId),
        'Idempotency-Key': globalThis.crypto.randomUUID(),
      },
      method: 'POST',
      url: `/flows/${input.flowId}/runs`,
    })
    observeRun(run.data)
    return run.data
  }, [input, observeRun])

  const retryGenerationRun = useCallback(async (nodeId: string) => {
    const previous = previewsRef.current[nodeId]
    if (!previous?.retrySource)
      return
    updateRunStatePreview(nodeId, previous.fingerprint, 'pending')
    try {
      const run = await postRunsIdRetry({
        data: { expectedRunStatus: previous.retrySource.status },
        id: previous.retrySource.runId,
      }, {
        headers: {
          ...getOrganizationRequestHeaders(input.organizationId),
          'Idempotency-Key': globalThis.crypto.randomUUID(),
        },
      })
      observeRun(run)
    }
    catch (error) {
      updatePreview(nodeId, previous)
      toast.error(getApiErrorMessage(error, t('flows.runStatus.failed')))
    }
  }, [input.organizationId, observeRun, t, updateRunStatePreview, updatePreview])

  const runGenerationPreview = useCallback(async (
    nodeId: string,
    scope: FlowGenerationPreviewScope = 'node',
  ) => {
    const commandMode = scope === 'fromHere'
      ? 'downstream'
      : scope === 'tillHere' ? 'upstream' : 'node'
    const previewNodeIds = createCurrentPlanner().getPreviewNodeIds(nodeId, scope)
    const activePreviewNodeIds = activePreviewNodeIdsFromClosure({
      edges: input.edgesRef.current,
      nodes: input.nodesRef.current,
      previewNodeIds,
    })
    for (const previewNodeId of previewNodeIds) {
      const node = input.nodesRef.current.find(item => item.id === previewNodeId)
      if (!node || !isGenerationNodeType(node.type))
        continue
      updateRunStatePreview(
        previewNodeId,
        createCurrentPlanner().getFingerprint(previewNodeId) ?? previewNodeId,
        activePreviewNodeIds.has(previewNodeId) ? 'pending' : 'queued',
      )
    }
    try {
      await admitRun({ mode: commandMode, targetNodeId: nodeId } as FlowRunCommandRequest)
    }
    catch (error) {
      for (const previewNodeId of previewNodeIds) {
        updatePreview(previewNodeId, {
          errorKey: 'flows.runStatus.failed',
          fingerprint: createCurrentPlanner().getFingerprint(previewNodeId) ?? previewNodeId,
          status: 'error',
        })
      }
      toast.error(getApiErrorMessage(error, input.t('flows.runStatus.failed')))
    }
  }, [admitRun, createCurrentPlanner, input, updateRunStatePreview, updatePreview])
  const runGenerationSelectionPreview = useCallback(async (
    nodeIds: readonly string[],
  ) => {
    const planner = createCurrentPlanner()
    const previewNodeIds = [...new Set(nodeIds)]
    const activePreviewNodeIds = activePreviewNodeIdsFromClosure({
      edges: input.edgesRef.current,
      nodes: input.nodesRef.current,
      previewNodeIds,
    })
    for (const previewNodeId of previewNodeIds) {
      const node = input.nodesRef.current.find(item => item.id === previewNodeId)
      if (!node || !isGenerationNodeType(node.type))
        continue
      updateRunStatePreview(
        previewNodeId,
        planner.getFingerprint(previewNodeId) ?? previewNodeId,
        activePreviewNodeIds.has(previewNodeId) ? 'pending' : 'queued',
      )
    }
    try {
      await admitRun({
        mode: 'selection',
        selectedNodeIds: [...new Set(nodeIds)],
      } as FlowRunCommandRequest)
    }
    catch (error) {
      for (const previewNodeId of previewNodeIds) {
        updatePreview(previewNodeId, {
          errorKey: 'flows.runStatus.failed',
          fingerprint: planner.getFingerprint(previewNodeId) ?? previewNodeId,
          status: 'error',
        })
      }
      toast.error(getApiErrorMessage(error, input.t('flows.runStatus.failed')))
    }
  }, [admitRun, createCurrentPlanner, input, updateRunStatePreview, updatePreview])

  const runAll = useCallback(async () => {
    dispatchRunAllRunIds({ runId: 'run-all-admission', type: 'add' })
    const previewNodeIds = input.nodesRef.current
      .filter(node => isGenerationNodeType(node.type))
      .map(node => node.id)
    const activePreviewNodeIds = activePreviewNodeIdsFromClosure({
      edges: input.edgesRef.current,
      nodes: input.nodesRef.current,
      previewNodeIds,
    })
    for (const previewNodeId of previewNodeIds) {
      updateRunStatePreview(
        previewNodeId,
        createCurrentPlanner().getFingerprint(previewNodeId) ?? previewNodeId,
        activePreviewNodeIds.has(previewNodeId) ? 'pending' : 'queued',
      )
    }
    try {
      const run = await admitRun({ mode: 'all' } as FlowRunCommandRequest)
      if (run && isActiveRunStatus(run.status))
        dispatchRunAllRunIds({ runId: run.id, type: 'add' })
      dispatchRunAllRunIds({ runId: 'run-all-admission', type: 'remove' })
    }
    catch (error) {
      dispatchRunAllRunIds({ runId: 'run-all-admission', type: 'remove' })
      toast.error(getApiErrorMessage(error, input.t('flows.runStatus.failed')))
    }
  }, [admitRun, createCurrentPlanner, input, updateRunStatePreview])

  const runDetailProjection = useMemo(() => ({
    runs: runDetailQueries
      .map(query => query.data)
      .filter((run): run is FlowRun => Boolean(run)),
    signature: runDetailQueries.map(query => query.dataUpdatedAt).join(':'),
  }), [runDetailQueries])

  useEffect(() => {
    for (const run of runDetailProjection.runs) {
      updateFromRun(run)
    }
  // eslint-disable-next-line react/exhaustive-deps -- useQueries returns a new result array every render; dataUpdatedAt is the stable projection boundary.
  }, [runDetailProjection.signature, updateFromRun])

  const getGenerationPreview = useCallback(
    (nodeId: string) => previews[nodeId],
    [previews],
  )
  const getGenerationPreviewFingerprint = useCallback(
    (nodeId: string) => planner.getFingerprint(nodeId),
    [planner],
  )

  return {
    getExecutableInputCount: planner.getExecutableInputCount,
    getGenerationPreview,
    getGenerationPreviewFingerprint,
    isRunAllRunning: runAllRunIds.length > 0,
    previews,
    retryGenerationRun,
    runAll,
    runGenerationPreview,
    runGenerationSelectionPreview,
  }
}

interface FlowRunCommandRequest {
  expectedFlowRevision?: number
  mode: 'all' | 'downstream' | 'node' | 'selection' | 'upstream'
  selectedNodeIds?: string[]
  targetNodeId?: string
}

function initialPreviewsFromLatestResults(
  results: readonly FlowLatestResult[],
  t: TFunction,
) {
  const previews: Record<string, FlowGenerationPreview> = {}
  for (const result of [...results].toSorted((left, right) =>
    compareIsoDesc(left.runCreatedAt, right.runCreatedAt)
    || left.runId.localeCompare(right.runId))) {
    const preview = previewFromOutputJobs({
      fingerprint: result.runId,
      jobs: result.jobs,
      nodeId: result.nodeId,
      t,
    })
    if (!preview)
      continue
    previews[result.nodeId] = preview
  }
  return previews
}

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

function previewFromOutputJobs(input: {
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
          const output = mediaPreviewOutput({
            asset,
            nodeId: input.nodeId,
            t: input.t,
          })
          return output ? [{ output, outputIndex: asset.outputIndex }] : []
        }),
      ].toSorted((left, right) => left.outputIndex - right.outputIndex),
    }))
    .filter(job => job.outputs.length > 0)

  const output = resultSets[0]?.outputs[0]?.output
  if (!output)
    return null

  return {
    fingerprint: input.fingerprint,
    output,
    resultSets,
    status: 'succeeded',
  }
}

function preserveMountedMediaOutputs(
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

  const currentOutputs = new Map(
    current.resultSets.flatMap(resultSet =>
      resultSet.outputs.map(result => [
        `${resultSet.jobId}\u0000${result.outputIndex}`,
        result.output,
      ] as const),
    ),
  )
  let reusedAnyOutput = false
  const resultSets = next.resultSets.map(resultSet => ({
    ...resultSet,
    outputs: resultSet.outputs.map((result) => {
      const mountedOutput = currentOutputs.get(
        `${resultSet.jobId}\u0000${result.outputIndex}`,
      )
      if (
        !mountedOutput
        || mountedOutput.kind !== 'media'
        || result.output.kind !== 'media'
        || mountedOutput.mediaType !== result.output.mediaType
        || mountedOutput.valueType !== result.output.valueType
      ) {
        return result
      }

      reusedAnyOutput = true
      return { ...result, output: mountedOutput }
    }),
  }))

  if (!reusedAnyOutput)
    return next

  return {
    ...next,
    output: resultSets[0]?.outputs[0]?.output ?? next.output,
    resultSets,
  }
}

function compareIsoDesc(left: string, right: string) {
  return right.localeCompare(left)
}

function isActiveRunStatus(status: FlowRun['status']) {
  return status === 'pending' || status === 'running'
}

function isRetryableRunStatus(
  status: FlowRun['status'],
): status is 'canceled' | 'failed' | 'partial' {
  return status === 'canceled' || status === 'failed' || status === 'partial'
}

function activePreviewNodeIdsFromClosure(input: {
  edges: readonly CanvasEdge[]
  nodes: readonly CanvasNode[]
  previewNodeIds: readonly string[]
}) {
  const executableNodeIds = new Set(
    input.nodes
      .filter(node => input.previewNodeIds.includes(node.id))
      .filter(node => isGenerationNodeType(node.type))
      .map(node => node.id),
  )
  return new Set(
    input.nodes
      .filter(node => executableNodeIds.has(node.id))
      .filter(node => !input.edges.some(edge =>
        edge.target === node.id && executableNodeIds.has(edge.source),
      ))
      .map(node => node.id),
  )
}

function activeRunNodeIdsFromRun(input: {
  edges: readonly CanvasEdge[]
  run: FlowRun
}) {
  const nodesById = new Map(input.run.nodes.map(node => [node.nodeId, node]))
  const completedStatuses = new Set(['succeeded', 'skipped'])

  return new Set(
    input.run.nodes
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
      .map(node => node.nodeId),
  )
}

function stableRunIds(runIds: readonly string[]) {
  return [...new Set(runIds)].toSorted()
}

function activeRunIdsReducer(
  current: readonly string[],
  action: { runId: string, type: 'add' | 'remove' },
) {
  if (action.type === 'add') {
    if (current.includes(action.runId))
      return current
    return stableRunIds([...current, action.runId])
  }
  if (!current.includes(action.runId))
    return current
  return current.filter(runId => runId !== action.runId)
}

function areGenerationPreviewsEqual(
  left: FlowGenerationPreview,
  right: FlowGenerationPreview,
) {
  return JSON.stringify(left) === JSON.stringify(right)
}
