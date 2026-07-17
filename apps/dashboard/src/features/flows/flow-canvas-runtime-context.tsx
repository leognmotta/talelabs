/** External services projected into canvas nodes without owning graph state. */

import type { GenerationConfigResponse } from '@talelabs/sdk'
import type { FlowCanvasAssetUpload, FlowGenerationPreview, FlowReferenceData } from './flow-canvas-types'
import type { FlowGenerationPreviewScope } from './flow-mock-runtime-planner'

import { createContext, use, useSyncExternalStore } from 'react'

/** Stable external services available to nodes inside one Flow canvas. */
export interface FlowCanvasRuntimeContextValue {
  /** Server-owned generation catalog projection used to configure nodes. */
  generationConfig: GenerationConfigResponse
  /** Reads the current upload presentation for one transient Asset node. */
  getAssetUpload: (nodeId: string) => FlowCanvasAssetUpload | undefined
  /** Reads the executable item count from the current graph and runtime projection. */
  getExecutableInputCount: (nodeId: string, slotId: string) => number
  /** Reads the latest run preview for one generation node. */
  getGenerationPreview: (nodeId: string) => FlowGenerationPreview | undefined
  /** Computes the current immutable run-input fingerprint for one node. */
  getGenerationPreviewFingerprint: (nodeId: string) => null | string
  /** Server-owned Asset and graph reference data used by node presentation. */
  referenceData: FlowReferenceData
  /** Retries the durable run that produced a retryable node preview. */
  retryGenerationRun: (nodeId: string) => Promise<void>
  /** Admits a durable run for one node and optional graph scope. */
  runGenerationPreview: (
    nodeId: string,
    scope?: FlowGenerationPreviewScope,
  ) => Promise<void>
  /** Subscribes to upload presentation changes without changing context identity. */
  subscribeAssetUploads: (listener: () => void) => () => void
  /** Subscribes to preview changes without changing context identity. */
  subscribeGenerationPreviews: (listener: () => void) => () => void
}

/** Runtime-only context; client-owned graph state remains in the scoped store. */
export const FlowCanvasRuntimeContext
  = createContext<FlowCanvasRuntimeContextValue | null>(null)

/** Returns the stable runtime service contract for a canvas descendant. */
export function useFlowCanvasRuntime(): FlowCanvasRuntimeContextValue {
  const value = use(FlowCanvasRuntimeContext)
  if (!value)
    throw new Error('FlowCanvasRuntimeContext is unavailable.')
  return value
}

/** Subscribes one component to only the requested generation-node preview. */
export function useFlowGenerationPreview(
  nodeId: string,
): FlowGenerationPreview | undefined {
  const runtime = useFlowCanvasRuntime()
  return useSyncExternalStore(
    runtime.subscribeGenerationPreviews,
    () => runtime.getGenerationPreview(nodeId),
    () => runtime.getGenerationPreview(nodeId),
  )
}

/** Subscribes one Asset node to only its transient upload presentation. */
export function useFlowCanvasAssetUploadState(
  nodeId: string,
): FlowCanvasAssetUpload | undefined {
  const runtime = useFlowCanvasRuntime()
  return useSyncExternalStore(
    runtime.subscribeAssetUploads,
    () => runtime.getAssetUpload(nodeId),
    () => runtime.getAssetUpload(nodeId),
  )
}
