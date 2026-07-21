/** Revision-driven autosave for the scoped client-owned canvas graph. */

import type { FlowGraphResponse } from '@talelabs/sdk'
import type { FlowSaveStatus, PersistedCanvasGraph } from '../flow-canvas-types'

import { FLOW_GRAPH_LIMITS } from '@talelabs/flows'
import { getFlowsIdGraph } from '@talelabs/sdk'
import { ApiError } from '@talelabs/sdk/client'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getApiErrorCode } from '../../../../shared/lib/api-error'
import { getOrganizationRequestHeaders } from '../../../../shared/lib/organization-request'
import { flowQueryKeys } from '../../data/query-keys/flow-query-keys'
import { useCanvasStoreApi } from '../canvas-state/canvas-store-context'
import {
  createFlowBackgroundSaveKey,
  dispatchFlowBackgroundSave,
} from './flow-background-save-store'
import { toCanvasEdges } from './flow-edge-serialization'
import {
  createFlowGraphDiff,
  takeFlowGraphMutationBatch,
} from './flow-graph-diff'
import {
  hasFlowGraphMutations,
  replayFlowGraphDiff,
} from './flow-graph-diff-replay'
import { toPersistedGraph } from './flow-graph-serialization'
import { toCanvasNodes } from './flow-node-serialization'
import { saveFlowGraph } from './flow-save'

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

/** Observes graph revisions, persists bounded diffs, and exposes save commands. */
export function useFlowAutosave(input: {
  /** Flow whose graph is being persisted. */
  flowId: string
  /** Initial server graph and compare-and-swap revision. */
  initialGraph: FlowGraphResponse
  /** Organization that owns the Flow. */
  organizationId: string
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const store = useCanvasStoreApi()
  const { flowId, organizationId } = input
  const backgroundSaveKey = createFlowBackgroundSaveKey(
    organizationId,
    flowId,
  )
  const [status, setStatus] = useState<FlowSaveStatus>('saved')
  const [dirty, setDirty] = useState(false)
  const baselineRef = useRef<PersistedCanvasGraph>({
    nodes: input.initialGraph.nodes,
    edges: input.initialGraph.edges,
  })
  const revisionRef = useRef(input.initialGraph.revision)
  const dirtyRef = useRef(false)
  const mountedRef = useRef(true)
  const savePromiseRef = useRef<null | Promise<void>>(null)
  const timerRef = useRef<null | number>(null)
  const saveNowRef = useRef<() => Promise<null | number>>(async () => null)

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
      setDirty(current => current === nextDirty ? current : nextDirty)
  }, [])

  const commitSaveError = useCallback(() => {
    if (mountedRef.current)
      setStatus('error')
    else
      toast.error(t('flows.saveStatus.error'))
  }, [t])

  const performSave = useCallback(async () => {
    let conflictCount = 0
    while (true) {
      const loopState = store.getState()
      if (loopState.graphRevision === loopState.savedRevision)
        break
      const currentGraph = toPersistedGraph(loopState.nodes, loopState.edges)
      const diff = createFlowGraphDiff(baselineRef.current, currentGraph)
      if (!hasFlowGraphMutations(diff)) {
        store.setState({ savedRevision: loopState.graphRevision })
        commitDirty(false)
        commitStatus('saved')
        break
      }

      const batch = takeFlowGraphMutationBatch(
        diff,
        FLOW_GRAPH_LIMITS.mutationsPerRequest,
      )
      const refreshReferences = graphReferencesChanged(baselineRef.current, batch)
      commitStatus('saving')
      try {
        const result = await saveFlowGraph({
          data: { baseRevision: revisionRef.current, ...batch },
          flowId,
          organizationId,
        })
        const committedGraph = replayFlowGraphDiff(
          baselineRef.current,
          batch,
        ).graph
        baselineRef.current = committedGraph
        revisionRef.current = result.revision
        const latestState = store.getState()
        const latestGraph = toPersistedGraph(latestState.nodes, latestState.edges)
        const stillDirty = hasFlowGraphMutations(
          createFlowGraphDiff(committedGraph, latestGraph),
        )
        if (!stillDirty) {
          store.setState({
            savedRevision: latestState.graphRevision,
            serverRevision: result.revision,
          })
          commitDirty(false)
        }
        else {
          store.setState({ serverRevision: result.revision })
        }
        queryClient.setQueryData<FlowGraphResponse>(
          flowQueryKeys.graph(organizationId, flowId),
          current => ({
            revision: result.revision,
            nodes: committedGraph.nodes,
            edges: committedGraph.edges,
            activeRuns: current?.activeRuns ?? [],
            latestResults: current?.latestResults ?? [],
          }),
        )
        if (refreshReferences) {
          void queryClient.invalidateQueries({
            queryKey: flowQueryKeys.references(organizationId, flowId),
          })
        }
        commitStatus(stillDirty ? 'unsaved' : 'saved')
      }
      catch (error) {
        if (
          !(error instanceof ApiError)
          || error.status !== 409
          || getApiErrorCode(error) !== 'revision_conflict'
        ) {
          commitSaveError()
          return
        }
        conflictCount += 1
        if (conflictCount > MAX_CONFLICT_REPLAYS) {
          commitSaveError()
          return
        }

        commitStatus('conflict')
        let server: FlowGraphResponse
        try {
          server = await getFlowsIdGraph(
            { id: flowId },
            { headers: getOrganizationRequestHeaders(organizationId) },
          )
        }
        catch {
          commitSaveError()
          return
        }
        const serverGraph = { nodes: server.nodes, edges: server.edges }
        // Capture after the awaited refetch so edits made during conflict
        // resolution are included in the rebased graph.
        const latestState = store.getState()
        const latestGraph = toPersistedGraph(
          latestState.nodes,
          latestState.edges,
        )
        const localDiff = createFlowGraphDiff(
          baselineRef.current,
          latestGraph,
        )
        const replay = replayFlowGraphDiff(serverGraph, localDiff)
        if (replay.droppedEdgeIds.length) {
          toast.warning(t('flows.saveStatus.connectionsDropped', {
            count: replay.droppedEdgeIds.length,
          }))
        }
        baselineRef.current = serverGraph
        revisionRef.current = server.revision
        store.setState({
          edges: toCanvasEdges(replay.graph.edges),
          editingImageCropNodeId: null,
          future: [],
          graphRevision: Math.max(
            latestState.graphRevision,
            server.revision,
          ) + 1,
          nodes: toCanvasNodes(replay.graph.nodes),
          past: [],
          positionHistoryActive: false,
          savedRevision: server.revision,
          serverRevision: server.revision,
          selectedEdgeIds: [],
          selectedNodeIds: [],
        })
        queryClient.setQueryData(
          flowQueryKeys.graph(organizationId, flowId),
          server,
        )
      }
    }
  }, [commitDirty, commitSaveError, commitStatus, flowId, organizationId, queryClient, store, t])

  const reconcileWithServer = useCallback(async () => {
    const expectedState = store.getState()
    if (expectedState.graphRevision !== expectedState.savedRevision)
      return false
    const server = await getFlowsIdGraph(
      { id: flowId },
      { headers: getOrganizationRequestHeaders(organizationId) },
    )
    const latestState = store.getState()
    // Never replace a graph that became dirty while the server fetch was in
    // flight; the caller will persist that newer local revision instead.
    if (
      latestState.graphRevision !== expectedState.graphRevision
      || latestState.graphRevision !== latestState.savedRevision
    ) {
      return false
    }
    const serverGraph = { nodes: server.nodes, edges: server.edges }
    baselineRef.current = serverGraph
    revisionRef.current = server.revision
    store.setState({
      edges: toCanvasEdges(server.edges),
      editingImageCropNodeId: null,
      future: [],
      graphRevision: server.revision,
      nodes: toCanvasNodes(server.nodes),
      past: [],
      positionHistoryActive: false,
      savedRevision: server.revision,
      serverRevision: server.revision,
      selectedEdgeIds: [],
      selectedNodeIds: [],
    })
    queryClient.setQueryData(flowQueryKeys.graph(organizationId, flowId), server)
    return true
  }, [flowId, organizationId, queryClient, store])

  const saveNow = useCallback(async (options?: {
    reconcileWithServer?: boolean
  }) => {
    clearTimer()
    if (!savePromiseRef.current) {
      savePromiseRef.current = performSave().finally(() => {
        savePromiseRef.current = null
      })
    }
    await savePromiseRef.current
    if (options?.reconcileWithServer) {
      let reconciled = false
      try {
        reconciled = await reconcileWithServer()
      }
      catch {
        commitSaveError()
        return null
      }
      if (!reconciled) {
        clearTimer()
        if (!savePromiseRef.current) {
          savePromiseRef.current = performSave().finally(() => {
            savePromiseRef.current = null
          })
        }
        await savePromiseRef.current
      }
    }
    return dirtyRef.current ? null : revisionRef.current
  }, [clearTimer, commitSaveError, performSave, reconcileWithServer])
  saveNowRef.current = saveNow

  const discard = useCallback(() => {
    clearTimer()
    commitDirty(false)
  }, [clearTimer, commitDirty])

  useEffect(() => {
    const unsubscribe = store.subscribe((state, previous) => {
      if (
        state.graphRevision === previous.graphRevision
        && state.savedRevision === previous.savedRevision
      ) {
        return
      }
      const nextDirty = state.graphRevision !== state.savedRevision
      commitDirty(nextDirty)
      clearTimer()
      if (!nextDirty) {
        commitStatus('saved')
        return
      }
      commitStatus('unsaved')
      // eslint-disable-next-line react/web-api-no-leaked-timeout -- clearTimer runs before rescheduling and in this effect's cleanup.
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        void saveNowRef.current()
      }, AUTOSAVE_DELAY_MS)
    })
    return () => {
      unsubscribe()
      clearTimer()
    }
  }, [clearTimer, commitDirty, commitStatus, store])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
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
      if (dirtyRef.current) {
        void dispatchFlowBackgroundSave({
          key: backgroundSaveKey,
          save: saveNowRef.current,
        })
      }
    }
  }, [backgroundSaveKey, clearTimer])

  return {
    discard,
    dirty,
    retry: saveNow,
    saveNow,
    status,
  }
}
