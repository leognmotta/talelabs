/** Asset upload orchestration kept outside Zustand with keyed node updates. */

import type {
  FlowGraphReferences,
} from '@talelabs/sdk'
import type { ReactFlowInstance, XYPosition } from '@xyflow/react'
import type { RefObject } from 'react'
import type { CanvasStore } from '../canvas-state/canvas-store'
import type {
  CanvasEdge,
  CanvasNode,
  FlowCanvasAssetUpload,
} from '../flow-canvas-types'

import { createId } from '@paralleldrive/cuid2'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  invalidateAssetCache,
} from '../../../assets/data/asset-cache-snapshot'
import { upsertAssetCache } from '../../../assets/data/asset-cache-upsert'
import { assetQueryKeys } from '../../../assets/data/asset-query-keys'
import { invalidateFolderCache } from '../../../assets/data/folder-cache-snapshot'
import { uploadAsset } from '../../../assets/upload/asset-upload'
import { getAcceptedAssetFiles } from '../../../assets/upload/asset-upload-files'
import { useAssetUploadPolicyDescription } from '../../../assets/upload/use-asset-upload-policy-description'
import { flowQueryKeys } from '../../data/query-keys/flow-query-keys'
import { captureCanvasHistory } from '../canvas-state/canvas-history-actions'
import { setCanvasSelection } from '../canvas-state/canvas-ui-actions'
import { createCanvasNode } from './flow-canvas-node-factory'
import {
  createOptimisticReferenceAsset,
  isAbortError,
  toFlowReferenceAsset,
} from './flow-canvas-upload-assets'

const UPLOAD_NODE_OFFSET = 48

interface CanvasAssetUploadVariables {
  controller: AbortController
  file: File
  nodeId: string
  position: XYPosition
  previewUrl: string
  temporaryAssetId: string
}

/** Uploads Assets while keeping File and AbortController objects outside Zustand. */
export function useFlowCanvasAssetUpload(input: {
  flowId: string
  organizationId: string
  reactFlow: ReactFlowInstance<CanvasNode, CanvasEdge>
  references: FlowGraphReferences
  store: CanvasStore
  wrapperRef: RefObject<HTMLDivElement | null>
}) {
  const {
    flowId,
    organizationId,
    reactFlow,
    references,
    store,
    wrapperRef,
  } = input
  const { t } = useTranslation()
  const policyDescription = useAssetUploadPolicyDescription()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadScreenPositionRef = useRef<null | XYPosition>(null)
  const controllersRef = useRef(new Map<string, AbortController>())
  const uploadsRef = useRef<Record<string, FlowCanvasAssetUpload>>({})
  const uploadListenersRef = useRef(new Set<() => void>())
  const [uploadAssetRevision, setUploadAssetRevision] = useState(0)

  const publishUploads = useCallback((
    update: (
      current: Record<string, FlowCanvasAssetUpload>,
    ) => Record<string, FlowCanvasAssetUpload>,
    referencesChanged = false,
  ) => {
    const next = update(uploadsRef.current)
    uploadsRef.current = next
    for (const listener of uploadListenersRef.current)
      listener()
    if (referencesChanged)
      setUploadAssetRevision(current => current + 1)
  }, [])

  const removeUpload = useCallback((nodeId: string) => {
    const upload = uploadsRef.current[nodeId]
    if (!upload)
      return
    URL.revokeObjectURL(upload.previewUrl)
    publishUploads((current) => {
      const next = { ...current }
      delete next[nodeId]
      return next
    }, true)
  }, [publishUploads])

  const { mutate: upload } = useMutation({
    mutationKey: [
      'flow-canvas',
      organizationId,
      flowId,
      'upload-asset',
    ],
    mutationFn: async (variables: CanvasAssetUploadVariables) => {
      return uploadAsset({
        file: variables.file,
        folderId: null,
        organizationId,
        signal: variables.controller.signal,
        onProgress: progress => publishUploads(current => current[variables.nodeId]
          ? {
              ...current,
              [variables.nodeId]: {
                ...current[variables.nodeId],
                progress,
              },
            }
          : current),
      })
    },
    onMutate: async (variables) => {
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: flowQueryKeys.references(organizationId, flowId),
        }),
        queryClient.cancelQueries({
          queryKey: assetQueryKeys.all(organizationId),
        }),
      ])
      if (variables.controller.signal.aborted)
        throw new DOMException('Upload canceled', 'AbortError')

      const asset = createOptimisticReferenceAsset(
        variables.file,
        variables.temporaryAssetId,
      )
      captureCanvasHistory(store)
      publishUploads(current => ({
        ...current,
        [variables.nodeId]: {
          asset,
          previewUrl: variables.previewUrl,
          progress: 0,
          status: 'uploading',
        },
      }), true)
      const state = store.getState()
      store.setState({
        nodes: [
          ...state.nodes.map(node => node.selected
            ? { ...node, selected: false }
            : node),
          createCanvasNode({
            assetId: variables.temporaryAssetId,
            id: variables.nodeId,
            position: variables.position,
            transient: { kind: 'assetUpload' },
            type: 'asset',
          }),
        ],
      })
      setCanvasSelection(store, { nodeIds: [variables.nodeId] })
    },
    onError: (error, variables) => {
      const state = store.getState()
      store.setState({
        edges: state.edges.filter(edge => (
          edge.source !== variables.nodeId && edge.target !== variables.nodeId
        )),
        nodes: state.nodes.filter(node => node.id !== variables.nodeId),
        selectedNodeIds: state.selectedNodeIds.filter(id => id !== variables.nodeId),
      })
      if (uploadsRef.current[variables.nodeId])
        removeUpload(variables.nodeId)
      else
        URL.revokeObjectURL(variables.previewUrl)
      if (!isAbortError(error)) {
        toast.error(t('assets.uploadFailed'), {
          description: t('assets.uploadFailedDescription'),
        })
      }
    },
    onSuccess: (asset, variables) => {
      if (!store.getState().nodes.some(node => node.id === variables.nodeId)) {
        removeUpload(variables.nodeId)
        return
      }

      const referenceAsset = toFlowReferenceAsset(asset)
      upsertAssetCache(queryClient, organizationId, asset)
      queryClient.setQueryData<FlowGraphReferences>(
        flowQueryKeys.references(organizationId, flowId),
        current => current
          ? {
              ...current,
              assets: [
                ...current.assets.filter(item => item.id !== asset.id),
                referenceAsset,
              ],
            }
          : current,
      )
      publishUploads((current) => {
        const upload = current[variables.nodeId]
        return upload
          ? {
              ...current,
              [variables.nodeId]: {
                ...upload,
                asset: referenceAsset,
                progress: 1,
                status: 'uploaded',
              },
            }
          : current
      }, true)
      const state = store.getState()
      store.setState({
        graphRevision: state.graphRevision + 1,
        nodes: state.nodes.map(node => node.id === variables.nodeId
          ? {
              ...node,
              assetId: asset.id,
              transient: undefined,
            }
          : node),
      })
    },
    onSettled: (_data, _error, variables) => {
      controllersRef.current.delete(variables.nodeId)
      void Promise.all([
        invalidateAssetCache(queryClient, organizationId),
        invalidateFolderCache(queryClient, organizationId),
        queryClient.invalidateQueries({
          queryKey: flowQueryKeys.references(organizationId, flowId),
        }),
      ])
    },
  })

  const openFilePicker = useCallback((screenPosition: null | XYPosition) => {
    uploadScreenPositionRef.current = screenPosition
    if (fileInputRef.current)
      fileInputRef.current.value = ''
    fileInputRef.current?.click()
  }, [])

  const uploadFiles = useCallback((files: File[] | FileList) => {
    const acceptedFiles = getAcceptedAssetFiles(files)
    if (acceptedFiles.length === 0) {
      toast.error(t('assets.noSupportedFiles'), {
        description: policyDescription,
      })
      return
    }

    const bounds = wrapperRef.current?.getBoundingClientRect()
    const screenPosition = uploadScreenPositionRef.current ?? {
      x: bounds ? bounds.left + bounds.width / 2 : window.innerWidth / 2,
      y: bounds ? bounds.top + bounds.height / 2 : window.innerHeight / 2,
    }
    const origin = reactFlow.screenToFlowPosition(screenPosition)

    for (const [index, file] of acceptedFiles.entries()) {
      const nodeId = createId()
      const controller = new AbortController()
      controllersRef.current.set(nodeId, controller)
      upload({
        controller,
        file,
        nodeId,
        position: {
          x: origin.x + index * UPLOAD_NODE_OFFSET,
          y: origin.y + index * UPLOAD_NODE_OFFSET,
        },
        previewUrl: URL.createObjectURL(file),
        temporaryAssetId: createId(),
      })
    }
  }, [policyDescription, reactFlow, t, upload, wrapperRef])

  const uploadFilesAt = useCallback((
    files: File[] | FileList,
    screenPosition: XYPosition,
  ) => {
    uploadScreenPositionRef.current = screenPosition
    uploadFiles(files)
  }, [uploadFiles])

  useEffect(() => store.subscribe((state, previous) => {
    if (state.nodes === previous.nodes)
      return
    const nodeIds = new Set(state.nodes.map(node => node.id))
    for (const [nodeId, controller] of controllersRef.current) {
      if (!nodeIds.has(nodeId) && uploadsRef.current[nodeId])
        controller.abort()
    }
  }), [store])

  useEffect(() => {
    const canonicalAssets = new Map(
      references.assets.map(asset => [asset.id, asset]),
    )
    for (const [nodeId, upload] of Object.entries(uploadsRef.current)) {
      if (upload.status !== 'uploaded')
        continue
      const canonical = canonicalAssets.get(upload.asset.id)
      if (canonical && canonical.processingState !== 'processing')
        removeUpload(nodeId)
    }
  }, [references, removeUpload])

  useEffect(() => () => {
    for (const controller of controllersRef.current.values())
      controller.abort()
    for (const upload of Object.values(uploadsRef.current))
      URL.revokeObjectURL(upload.previewUrl)
  }, [])

  const transientAssets = useMemo(
    () => {
      void uploadAssetRevision
      return Object.values(uploadsRef.current).map(upload => upload.asset)
    },
    [uploadAssetRevision],
  )
  const getUpload = useCallback(
    (nodeId: string) => uploadsRef.current[nodeId],
    [],
  )
  const subscribeUploads = useCallback((listener: () => void) => {
    uploadListenersRef.current.add(listener)
    return () => uploadListenersRef.current.delete(listener)
  }, [])

  return {
    fileInputRef,
    getUpload,
    openFilePicker,
    subscribeUploads,
    transientAssets,
    uploadFiles,
    uploadFilesAt,
  }
}
