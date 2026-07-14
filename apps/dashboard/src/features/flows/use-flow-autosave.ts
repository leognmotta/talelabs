import type { FlowGraphResponse } from '@talelabs/sdk'
import type { CanvasEdge, CanvasNode, FlowSaveStatus, PersistedCanvasGraph } from './flow-canvas-types'

import { FLOW_GRAPH_LIMITS } from '@talelabs/flows'
import { getFlowsIdGraph } from '@talelabs/sdk'
import { ApiError } from '@talelabs/sdk/client'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getApiErrorCode } from '../../shared/lib/api-error'
import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import {
  createFlowGraphDiff,
  hasFlowGraphMutations,
  replayFlowGraphDiff,
  takeFlowGraphMutationBatch,
  toCanvasEdges,
  toCanvasNodes,
  toPersistedGraph,
} from './flow-canvas-serialization'
import { flowQueryKeys } from './flow-query-keys'
import { saveFlowGraph } from './flow.queries'

const AUTOSAVE_DELAY_MS = 750
const MAX_CONFLICT_REPLAYS = 3

function graphReferencesChanged(
  baseline: PersistedCanvasGraph,
  diff: ReturnType<typeof createFlowGraphDiff>,
) {
  const baselineNodes = new Map(baseline.nodes.map(node => [node.id, node]))
  return diff.deleteNodeIds.some((nodeId) => {
    const node = baselineNodes.get(nodeId)
    return Boolean(node?.assetId)
  }) || diff.upsertNodes.some((node) => {
    const previous = baselineNodes.get(node.id)
    return node.assetId !== previous?.assetId
  })
}

export function useFlowAutosave(input: {
  edges: CanvasEdge[]
  flowId: string
  initialGraph: FlowGraphResponse
  nodes: CanvasNode[]
  organizationId: string
  replaceGraph: (nodes: CanvasNode[], edges: CanvasEdge[]) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { flowId, organizationId, replaceGraph } = input
  const [status, setStatus] = useState<FlowSaveStatus>('saved')
  const [dirty, setDirty] = useState(false)
  const baselineRef = useRef<PersistedCanvasGraph>({
    nodes: input.initialGraph.nodes,
    edges: input.initialGraph.edges,
  })
  const revisionRef = useRef(input.initialGraph.revision)
  const currentRef = useRef(toPersistedGraph(input.nodes, input.edges))
  const dirtyRef = useRef(false)
  const mountedRef = useRef(true)
  const savePromiseRef = useRef<null | Promise<void>>(null)
  const timerRef = useRef<null | number>(null)

  currentRef.current = toPersistedGraph(input.nodes, input.edges)

  const clearTimer = useCallback(() => {
    if (timerRef.current === null)
      return
    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const commitStatus = useCallback((nextStatus: FlowSaveStatus) => {
    if (mountedRef.current)
      setStatus(nextStatus)
  }, [])

  const commitDirty = useCallback((nextDirty: boolean) => {
    dirtyRef.current = nextDirty
    if (mountedRef.current)
      setDirty(nextDirty)
  }, [])

  const performSave = useCallback(async () => {
    let conflictCount = 0

    while (dirtyRef.current) {
      const diff = createFlowGraphDiff(baselineRef.current, currentRef.current)
      if (!hasFlowGraphMutations(diff)) {
        commitDirty(false)
        commitStatus('saved')
        break
      }

      const batch = takeFlowGraphMutationBatch(
        diff,
        FLOW_GRAPH_LIMITS.mutationsPerRequest,
      )

      const refreshReferences = graphReferencesChanged(
        baselineRef.current,
        batch,
      )
      commitStatus('saving')
      try {
        const result = await saveFlowGraph({
          data: {
            baseRevision: revisionRef.current,
            ...batch,
          },
          flowId,
          organizationId,
        })
        const committedGraph = replayFlowGraphDiff(
          baselineRef.current,
          batch,
        ).graph
        baselineRef.current = committedGraph
        revisionRef.current = result.revision
        commitDirty(hasFlowGraphMutations(
          createFlowGraphDiff(committedGraph, currentRef.current),
        ))
        queryClient.setQueryData<FlowGraphResponse>(
          flowQueryKeys.graph(organizationId, flowId),
          current => ({
            revision: result.revision,
            nodes: committedGraph.nodes,
            edges: committedGraph.edges,
            activeRuns: current?.activeRuns ?? [],
          }),
        )
        if (refreshReferences) {
          void queryClient.invalidateQueries({
            queryKey: flowQueryKeys.references(organizationId, flowId),
          })
        }
        commitStatus(dirtyRef.current ? 'unsaved' : 'saved')
      }
      catch (error) {
        if (
          !(error instanceof ApiError)
          || error.status !== 409
          || getApiErrorCode(error) !== 'revision_conflict'
        ) {
          commitStatus('error')
          return
        }

        conflictCount += 1
        if (conflictCount > MAX_CONFLICT_REPLAYS) {
          commitStatus('error')
          return
        }

        commitStatus('conflict')
        const localDiff = createFlowGraphDiff(
          baselineRef.current,
          currentRef.current,
        )
        let server: FlowGraphResponse
        try {
          server = await getFlowsIdGraph(
            { id: flowId },
            { headers: getOrganizationRequestHeaders(organizationId) },
          )
        }
        catch {
          commitStatus('error')
          return
        }
        const serverGraph = {
          nodes: server.nodes,
          edges: server.edges,
        }
        const replay = replayFlowGraphDiff(serverGraph, localDiff)
        const replayed = replay.graph
        if (replay.droppedEdgeIds.length) {
          toast.warning(t('flows.saveStatus.connectionsDropped', {
            count: replay.droppedEdgeIds.length,
          }))
        }
        baselineRef.current = serverGraph
        revisionRef.current = server.revision
        currentRef.current = replayed
        commitDirty(true)
        replaceGraph(
          toCanvasNodes(replayed.nodes),
          toCanvasEdges(replayed.edges),
        )
        queryClient.setQueryData(
          flowQueryKeys.graph(organizationId, flowId),
          server,
        )
      }
    }
  }, [
    commitStatus,
    commitDirty,
    flowId,
    organizationId,
    replaceGraph,
    queryClient,
    t,
  ])

  const saveNow = useCallback(async () => {
    clearTimer()
    if (!savePromiseRef.current) {
      savePromiseRef.current = performSave().finally(() => {
        savePromiseRef.current = null
      })
    }
    await savePromiseRef.current
    return !dirtyRef.current
  }, [clearTimer, performSave])

  const markDirty = useCallback(() => {
    commitDirty(true)
    commitStatus('unsaved')
    clearTimer()
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void saveNow()
    }, AUTOSAVE_DELAY_MS)
  }, [clearTimer, commitDirty, commitStatus, saveNow])

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current)
        return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimer()
      if (dirtyRef.current)
        void saveNow()
    }
  }, [clearTimer, saveNow])

  return {
    dirty,
    markDirty,
    retry: saveNow,
    saveNow,
    status,
  }
}
