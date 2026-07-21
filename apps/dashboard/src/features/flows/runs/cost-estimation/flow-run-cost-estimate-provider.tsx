/** Bounded Flow estimate orchestration with scope-granular query seeding. */
/* eslint-disable react-refresh/only-export-components -- the provider and its required selector hook share one boundary. */

import type { NormalizedFlowRunCommand } from '@talelabs/flows'
import type { RunCostEstimate } from '@talelabs/sdk'
import type { ReactNode } from 'react'
import type {
  RunCostEstimateFingerprintSource,
  RunCostEstimateScopeIndex,
} from './run-cost-estimate-scope-fingerprint'

import { isGenerationNodeType } from '@talelabs/flows'
import { ApiError, postFlowsIdRunCostEstimates } from '@talelabs/sdk'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { getOrganizationRequestHeaders } from '../../../../shared/lib/organization-request'
import { flowQueryKeys } from '../../data/query-keys/flow-query-keys'
import { useCanvasStore, useCanvasStoreApi } from '../../editor/canvas-state/canvas-store-context'
import { useFlowCanvasRuntime } from '../../editor/flow-canvas-runtime-context'
import { runCostEstimateQueryKey } from './run-cost-estimate-query'
import {
  createRunCostEstimateFingerprintSource,
  createRunCostEstimateScopeIndex,
} from './run-cost-estimate-scope-fingerprint'
import { useBoundedIncompleteEstimateRecovery } from './use-bounded-incomplete-estimate-recovery'

const ESTIMATE_CACHE_LIFETIME_MS = 30 * 60_000
const ESTIMATE_STALE_TIME_MS = 5 * 60_000
const INCOMPLETE_ESTIMATE_STALE_TIME_MS = 30_000
const ESTIMATE_REQUEST_RETRY_BASE_MS = 1_000
const ESTIMATE_REQUEST_RETRY_LIMIT = 2
const MANIFEST_BATCH_DELAY_MS = 250
const MANIFEST_NODE_SCOPE_BATCH_SIZE = 24

interface RequestedManifestScopes {
  includeAll: boolean
  nodeIds: readonly string[]
}

interface ManifestBatchCursor {
  key: string
  offset: number
}

const EMPTY_REQUESTED_MANIFEST_SCOPES: RequestedManifestScopes = {
  includeAll: false,
  nodeIds: [],
}

interface ScopeFingerprintStore {
  get: (command: NormalizedFlowRunCommand) => string | undefined
  getRequested: () => RequestedManifestScopes
  retainAll: () => () => void
  retainNode: (nodeId: string) => () => void
  replace: (index: RunCostEstimateScopeIndex) => void
  subscribe: (listener: () => void) => () => void
  subscribeRequested: (listener: () => void) => () => void
}

const ScopeFingerprintContext = createContext<ScopeFingerprintStore | null>(null)

function createScopeFingerprintStore(): ScopeFingerprintStore {
  let current: RunCostEstimateScopeIndex | undefined
  const listeners = new Set<() => void>()
  let allRequestCount = 0
  const nodeRequestCounts = new Map<string, number>()
  let requested = EMPTY_REQUESTED_MANIFEST_SCOPES
  const requestedListeners = new Set<() => void>()

  const publishRequested = () => {
    const next = {
      includeAll: allRequestCount > 0,
      nodeIds: [...nodeRequestCounts.keys()].toSorted(),
    } satisfies RequestedManifestScopes
    if (
      next.includeAll === requested.includeAll
      && next.nodeIds.length === requested.nodeIds.length
      && next.nodeIds.every((nodeId, index) => nodeId === requested.nodeIds[index])
    ) {
      return
    }
    requested = next
    for (const listener of requestedListeners) listener()
  }

  return {
    get: command => command.mode === 'all'
      ? current?.all
      : command.mode === 'node'
        ? current?.nodes[command.targetNodeId]
        : undefined,
    getRequested: () => requested,
    retainAll: () => {
      allRequestCount += 1
      publishRequested()
      let retained = true
      return () => {
        if (!retained)
          return
        retained = false
        allRequestCount -= 1
        publishRequested()
      }
    },
    retainNode: (nodeId) => {
      nodeRequestCounts.set(nodeId, (nodeRequestCounts.get(nodeId) ?? 0) + 1)
      publishRequested()
      let retained = true
      return () => {
        if (!retained)
          return
        retained = false
        const nextCount = (nodeRequestCounts.get(nodeId) ?? 1) - 1
        if (nextCount > 0)
          nodeRequestCounts.set(nodeId, nextCount)
        else
          nodeRequestCounts.delete(nodeId)
        publishRequested()
      }
    },
    replace: (index) => {
      const next = current?.source === index.source
        ? {
            ...index,
            ...(index.all ?? current.all
              ? { all: index.all ?? current.all }
              : {}),
            nodes: { ...current.nodes, ...index.nodes },
          }
        : index
      if (
        current?.source === next.source
        && current.all === next.all
        && Object.keys(current.nodes).length === Object.keys(next.nodes).length
        && Object.entries(current.nodes).every(
          ([nodeId, fingerprint]) => next.nodes[nodeId] === fingerprint,
        )
      ) {
        return
      }
      current = next
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    subscribeRequested: (listener) => {
      requestedListeners.add(listener)
      return () => requestedListeners.delete(listener)
    },
  }
}

function retryableEstimateRequestError(error: unknown): boolean {
  return !(error instanceof ApiError)
    || error.status === 429
    || error.status >= 500
}

function isCompleteEstimate(
  estimate: RunCostEstimate | undefined,
): estimate is Extract<RunCostEstimate, { status: 'estimated' }> {
  return estimate?.status === 'estimated'
}

function unavailableEstimate(): RunCostEstimate {
  return {
    amountUsd: null,
    currency: 'USD',
    estimatedJobCount: 0,
    status: 'unavailable',
    unavailableJobCount: 1,
  }
}

function hasFreshEstimate(input: {
  now: number
  queryClient: ReturnType<typeof useQueryClient>
  queryKey: readonly unknown[]
}): boolean {
  const state = input.queryClient.getQueryState<RunCostEstimate>(input.queryKey)
  if (!state?.data)
    return false
  const staleTime = isCompleteEstimate(state.data)
    ? ESTIMATE_STALE_TIME_MS
    : INCOMPLETE_ESTIMATE_STALE_TIME_MS
  return input.now - state.dataUpdatedAt < staleTime
}

/** Reads only one eager scope fingerprint from the graph-level coordinator. */
export function useRunCostEstimateManifestFingerprint(
  command: NormalizedFlowRunCommand,
  enabled: boolean,
): string | undefined {
  const store = use(ScopeFingerprintContext)
  if (!store)
    throw new Error('FlowRunCostEstimateProvider is unavailable.')
  const directNodeId = command.mode === 'node'
    ? command.targetNodeId
    : undefined
  useEffect(() => {
    if (!enabled)
      return undefined
    if (command.mode === 'all')
      return store.retainAll()
    if (directNodeId)
      return store.retainNode(directNodeId)
    return undefined
  }, [command.mode, directNodeId, enabled, store])
  return useSyncExternalStore(
    store.subscribe,
    () => store.get(command),
    () => store.get(command),
  )
}

/** Loads missing direct estimates in bounded batches and seeds narrow query keys. */
export function FlowRunCostEstimateProvider({
  children,
}: {
  /** Canvas descendants consuming individual estimate scopes. */
  children: ReactNode
}) {
  const runtime = useFlowCanvasRuntime()
  const canvasStore = useCanvasStoreApi()
  const queryClient = useQueryClient()
  const graphRevision = useCanvasStore(state => state.graphRevision)
  const dirty = useCanvasStore(
    state => state.graphRevision !== state.savedRevision,
  )
  const serverRevision = useCanvasStore(state => state.serverRevision)
  const [previewRevision, advancePreviewRevision] = useReducer(
    revision => revision + 1,
    0,
  )
  const [estimateCacheNow, setEstimateCacheNow] = useState(Date.now)
  const refreshIncompleteEstimates = useCallback(
    () => setEstimateCacheNow(Date.now()),
    [],
  )
  const [fingerprintStore] = useState(createScopeFingerprintStore)
  const requestedScopes = useSyncExternalStore(
    fingerprintStore.subscribeRequested,
    fingerprintStore.getRequested,
    fingerprintStore.getRequested,
  )
  const [batchedRequestedScopes, setBatchedRequestedScopes] = useState(
    EMPTY_REQUESTED_MANIFEST_SCOPES,
  )
  const [manifestBatchCursor, setManifestBatchCursor] = useState<ManifestBatchCursor>({
    key: '',
    offset: 0,
  })
  const previousSourceRef = useRef<RunCostEstimateFingerprintSource | undefined>(
    undefined,
  )
  const previousIndexRef = useRef<RunCostEstimateScopeIndex | undefined>(
    undefined,
  )
  const coordinatorRequested = runtime.fundingSource === 'credits'
    && runtime.executionRuntime === 'managed'
    && (requestedScopes.includeAll || requestedScopes.nodeIds.length > 0)

  useEffect(
    () => runtime.subscribeGenerationPreviews(advancePreviewRevision),
    [runtime],
  )

  useEffect(() => {
    const refreshEstimateCacheAge = () => setEstimateCacheNow(Date.now())
    const timeout = window.setTimeout(
      refreshEstimateCacheAge,
      ESTIMATE_STALE_TIME_MS,
    )
    window.addEventListener('focus', refreshEstimateCacheAge)
    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener('focus', refreshEstimateCacheAge)
    }
  }, [estimateCacheNow])

  useEffect(() => {
    const timeout = window.setTimeout(
      setBatchedRequestedScopes,
      MANIFEST_BATCH_DELAY_MS,
      requestedScopes,
    )
    return () => window.clearTimeout(timeout)
  }, [requestedScopes])

  const fingerprintSource = useMemo(() => {
    const graph = canvasStore.getState()
    if (!coordinatorRequested) {
      return createRunCostEstimateFingerprintSource({
        edges: [],
        nodes: [],
        referenceData: runtime.referenceData,
      })
    }
    const priorResultsByNodeId = Object.fromEntries(
      graph.nodes
        .filter(node => isGenerationNodeType(node.type))
        .map(node => [node.id, runtime.getGenerationPreview(node.id)]),
    )
    const next = createRunCostEstimateFingerprintSource({
      edges: graph.edges,
      nodes: graph.nodes,
      priorResultsByNodeId,
      referenceData: runtime.referenceData,
    })
    if (previousSourceRef.current?.source === next.source)
      return previousSourceRef.current
    previousSourceRef.current = next
    return next
    // Scalar revisions intentionally refresh imperative store/ref reads.
    // eslint-disable-next-line react/exhaustive-deps
  }, [canvasStore, coordinatorRequested, graphRevision, previewRevision, runtime])

  const requestedNodeIdsKey = batchedRequestedScopes.nodeIds.join('\u0000')
  const incompleteRecoveryGroupKey = [
    batchedRequestedScopes.includeAll,
    coordinatorRequested,
    dirty,
    fingerprintSource.source,
    requestedNodeIdsKey,
    serverRevision,
  ].join('\u0001')
  const manifestBatchKey = [
    batchedRequestedScopes.includeAll,
    coordinatorRequested,
    dirty,
    estimateCacheNow,
    fingerprintSource.source,
    requestedNodeIdsKey,
  ].join('\u0001')
  const manifestBatchOffset = manifestBatchCursor.key === manifestBatchKey
    ? manifestBatchCursor.offset
    : 0

  const batchNodeIds = useMemo(
    () => batchedRequestedScopes.nodeIds.slice(
      manifestBatchOffset,
      manifestBatchOffset + MANIFEST_NODE_SCOPE_BATCH_SIZE,
    ),
    [batchedRequestedScopes.nodeIds, manifestBatchOffset],
  )
  const includeAllInBatch = batchedRequestedScopes.includeAll
    && manifestBatchOffset === 0
  const index = useMemo(() => {
    const next = createRunCostEstimateScopeIndex({
      includeAll: includeAllInBatch,
      nodeIds: batchNodeIds,
      previous: previousIndexRef.current,
      source: fingerprintSource,
    })
    previousIndexRef.current = next
    return next
  }, [batchNodeIds, fingerprintSource, includeAllInBatch])

  useLayoutEffect(() => fingerprintStore.replace(index), [fingerprintStore, index])

  useEffect(() => {
    queryClient.setQueryDefaults(
      [
        ...flowQueryKeys.runs(runtime.organizationId, runtime.flowId),
        'cost-estimate',
      ],
      {
        gcTime: ESTIMATE_CACHE_LIFETIME_MS,
        staleTime: ESTIMATE_STALE_TIME_MS,
      },
    )
  }, [queryClient, runtime.flowId, runtime.organizationId])

  const allScopeFingerprint = index.all ?? ''
  const allQueryKey = runCostEstimateQueryKey({
    command: { mode: 'all' },
    executionMode: runtime.executionMode,
    executionRuntime: runtime.executionRuntime,
    flowId: runtime.flowId,
    organizationId: runtime.organizationId,
    scopeFingerprint: allScopeFingerprint,
  })
  const includeAll = includeAllInBatch
    && Boolean(allScopeFingerprint)
    && !hasFreshEstimate({
      now: estimateCacheNow,
      queryClient,
      queryKey: allQueryKey,
    })
  const nodeIds = batchNodeIds.filter((nodeId) => {
    const scopeFingerprint = index.nodes[nodeId]
    return scopeFingerprint
      && !hasFreshEstimate({
        now: estimateCacheNow,
        queryClient,
        queryKey: runCostEstimateQueryKey({
          command: { mode: 'node', targetNodeId: nodeId },
          executionMode: runtime.executionMode,
          executionRuntime: runtime.executionRuntime,
          flowId: runtime.flowId,
          organizationId: runtime.organizationId,
          scopeFingerprint,
        }),
      })
  })

  const enabled = coordinatorRequested
    && !dirty
    && (includeAll || nodeIds.length > 0)
  const manifestQuery = useQuery({
    enabled,
    queryFn: ({ signal }) => postFlowsIdRunCostEstimates(
      {
        data: {
          executionMode: runtime.executionMode,
          executionRuntime: runtime.executionRuntime,
          expectedFlowRevision: serverRevision,
          fundingSource: 'credits',
          includeAll,
          nodeIds,
        },
        id: runtime.flowId,
      },
      {
        headers: getOrganizationRequestHeaders(runtime.organizationId),
        signal,
      },
    ),
    queryKey: flowQueryKeys.runCostManifest({
      estimateContextHash: index.manifest,
      executionMode: runtime.executionMode,
      executionRuntime: runtime.executionRuntime,
      flowId: runtime.flowId,
      flowRevision: serverRevision,
      includeAll,
      nodeIds,
      organizationId: runtime.organizationId,
    }),
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => failureCount < ESTIMATE_REQUEST_RETRY_LIMIT
      && retryableEstimateRequestError(error),
    retryDelay: failureCount => Math.min(
      ESTIMATE_REQUEST_RETRY_BASE_MS * 2 ** failureCount,
      4_000,
    ),
    staleTime: INCOMPLETE_ESTIMATE_STALE_TIME_MS,
  })
  const recordEstimateRecoveryScopes = useBoundedIncompleteEstimateRecovery({
    active: coordinatorRequested && !dirty,
    groupKey: incompleteRecoveryGroupKey,
    recover: refreshIncompleteEstimates,
    recovering: manifestQuery.isFetching,
  })

  useEffect(() => {
    const manifest = manifestQuery.data
    if (!manifest || manifest.flowRevision !== serverRevision)
      return
    if (manifest.allCostEstimate) {
      queryClient.setQueryData(allQueryKey, manifest.allCostEstimate)
    }
    for (const node of manifest.nodes) {
      const scopeFingerprint = index.nodes[node.nodeId]
      if (!scopeFingerprint)
        continue
      queryClient.setQueryData(runCostEstimateQueryKey({
        command: { mode: 'node', targetNodeId: node.nodeId },
        executionMode: runtime.executionMode,
        executionRuntime: runtime.executionRuntime,
        flowId: runtime.flowId,
        organizationId: runtime.organizationId,
        scopeFingerprint,
      }), node.costEstimate)
    }
    const estimatesByNodeId = new Map(
      manifest.nodes.map(node => [node.nodeId, node.costEstimate]),
    )
    recordEstimateRecoveryScopes([
      ...(includeAll
        ? [{
            complete: isCompleteEstimate(manifest.allCostEstimate),
            id: 'all',
          }]
        : []),
      ...nodeIds.map(nodeId => ({
        complete: isCompleteEstimate(estimatesByNodeId.get(nodeId)),
        id: `node:${nodeId}`,
      })),
    ])
  }, [
    allQueryKey,
    index,
    includeAll,
    manifestQuery.data,
    nodeIds,
    queryClient,
    recordEstimateRecoveryScopes,
    runtime.executionMode,
    runtime.executionRuntime,
    runtime.flowId,
    runtime.organizationId,
    serverRevision,
  ])

  useEffect(() => {
    if (!manifestQuery.isError || manifestQuery.isFetching)
      return
    if (includeAll)
      queryClient.setQueryData(allQueryKey, unavailableEstimate())
    for (const nodeId of nodeIds) {
      const scopeFingerprint = index.nodes[nodeId]
      if (!scopeFingerprint)
        continue
      queryClient.setQueryData(runCostEstimateQueryKey({
        command: { mode: 'node', targetNodeId: nodeId },
        executionMode: runtime.executionMode,
        executionRuntime: runtime.executionRuntime,
        flowId: runtime.flowId,
        organizationId: runtime.organizationId,
        scopeFingerprint,
      }), unavailableEstimate())
    }
    recordEstimateRecoveryScopes([
      ...(includeAll ? [{ complete: false, id: 'all' }] : []),
      ...nodeIds.map(nodeId => ({
        complete: false,
        id: `node:${nodeId}`,
      })),
    ])
  }, [
    allQueryKey,
    includeAll,
    index.nodes,
    manifestQuery.isError,
    manifestQuery.isFetching,
    nodeIds,
    queryClient,
    recordEstimateRecoveryScopes,
    runtime.executionMode,
    runtime.executionRuntime,
    runtime.flowId,
    runtime.organizationId,
  ])

  useEffect(() => {
    const batchEnd = manifestBatchOffset + batchNodeIds.length
    if (
      !coordinatorRequested
      || dirty
      || batchNodeIds.length === 0
      || batchEnd >= batchedRequestedScopes.nodeIds.length
      || manifestQuery.isFetching
      || (enabled && !manifestQuery.isSuccess && !manifestQuery.isError)
    ) {
      return undefined
    }
    const timeout = window.setTimeout(setManifestBatchCursor, 0, {
      key: manifestBatchKey,
      offset: batchEnd,
    })
    return () => window.clearTimeout(timeout)
  }, [
    batchNodeIds.length,
    batchedRequestedScopes.nodeIds.length,
    coordinatorRequested,
    dirty,
    enabled,
    manifestBatchKey,
    manifestBatchOffset,
    manifestQuery.isError,
    manifestQuery.isFetching,
    manifestQuery.isSuccess,
  ])

  return (
    <ScopeFingerprintContext value={fingerprintStore}>
      {children}
    </ScopeFingerprintContext>
  )
}
