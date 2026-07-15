import type {
  Asset,
  FlowGraphReferences,
  FlowReferenceAsset,
} from '@talelabs/sdk'
import type { ReactFlowInstance, XYPosition } from '@xyflow/react'
import type {
  Dispatch,
  RefObject,
  SetStateAction,
} from 'react'
import type {
  CanvasEdge,
  CanvasNode,
  FlowCanvasAssetUpload,
} from './flow-canvas-types'

import { createId } from '@paralleldrive/cuid2'
import { getAssetUploadPolicy } from '@talelabs/assets'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  invalidateAssetCache,
  upsertAssetCache,
} from '../assets/asset-query-cache'
import { assetQueryKeys } from '../assets/asset-query-keys'
import { uploadAsset } from '../assets/asset-upload'
import { getAcceptedAssetFiles } from '../assets/asset-upload-files'
import { invalidateFolderCache } from '../assets/folder-query-cache'
import { useAssetUploadPolicyDescription } from '../assets/use-asset-upload-policy-description'
import { createCanvasNode } from './flow-canvas-node-factory'
import { flowQueryKeys } from './flow-query-keys'

const UPLOAD_NODE_OFFSET = 48

interface CanvasAssetUploadVariables {
  controller: AbortController
  file: File
  nodeId: string
  position: XYPosition
  previewUrl: string
  temporaryAssetId: string
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function toFlowReferenceAsset(asset: Asset): FlowReferenceAsset {
  return {
    createdAt: asset.createdAt,
    durationSeconds: asset.durationSeconds,
    generationModel: null,
    height: asset.height,
    id: asset.id,
    lifecycle: asset.lifecycle,
    mimeType: asset.mimeType,
    name: asset.name,
    processingError: asset.processingError,
    processingState: asset.processingState,
    sizeBytes: asset.sizeBytes,
    source: asset.source,
    visibility: asset.visibility,
    thumbnailUrl: asset.thumbnailUrl,
    type: asset.type,
    url: asset.url,
    width: asset.width,
  }
}

function createOptimisticReferenceAsset(
  file: File,
  temporaryAssetId: string,
): FlowReferenceAsset {
  const policy = getAssetUploadPolicy(file.type)
  if (!policy)
    throw new Error(`Unsupported optimistic Asset type: ${file.type}`)

  return {
    createdAt: new Date().toISOString(),
    durationSeconds: null,
    generationModel: null,
    height: null,
    id: temporaryAssetId,
    lifecycle: 'live',
    mimeType: file.type,
    name: file.name,
    processingError: null,
    processingState: 'processing',
    sizeBytes: file.size,
    source: 'upload',
    visibility: 'private',
    thumbnailUrl: null,
    type: policy.type,
    url: null,
    width: null,
  }
}

export function useFlowCanvasAssetUpload(input: {
  captureHistory: () => void
  flowId: string
  markDirty: () => void
  nodes: CanvasNode[]
  nodesRef: RefObject<CanvasNode[]>
  organizationId: string
  reactFlow: ReactFlowInstance<CanvasNode, CanvasEdge>
  references: FlowGraphReferences
  setEdges: Dispatch<SetStateAction<CanvasEdge[]>>
  setNodes: Dispatch<SetStateAction<CanvasNode[]>>
  setSelectedIds: (nodeIds: string[], edgeIds?: string[]) => void
  wrapperRef: RefObject<HTMLDivElement | null>
}) {
  const {
    captureHistory,
    flowId,
    markDirty,
    nodes,
    nodesRef,
    organizationId,
    reactFlow,
    references,
    setEdges,
    setNodes,
    setSelectedIds,
    wrapperRef,
  } = input
  const { t } = useTranslation()
  const policyDescription = useAssetUploadPolicyDescription()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadScreenPositionRef = useRef<null | XYPosition>(null)
  const controllersRef = useRef(new Map<string, AbortController>())
  const uploadsRef = useRef<Record<string, FlowCanvasAssetUpload>>({})
  const [uploads, setUploads] = useState<
    Readonly<Record<string, FlowCanvasAssetUpload>>
  >({})

  const publishUploads = useCallback((
    update: (
      current: Record<string, FlowCanvasAssetUpload>,
    ) => Record<string, FlowCanvasAssetUpload>,
  ) => {
    const next = update(uploadsRef.current)
    uploadsRef.current = next
    setUploads(next)
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
    })
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
      captureHistory()
      publishUploads(current => ({
        ...current,
        [variables.nodeId]: {
          asset,
          previewUrl: variables.previewUrl,
          progress: 0,
          status: 'uploading',
        },
      }))
      setNodes(current => [
        ...current.map(node => ({ ...node, selected: false })),
        createCanvasNode({
          assetId: variables.temporaryAssetId,
          id: variables.nodeId,
          position: variables.position,
          transient: { kind: 'assetUpload' },
          type: 'asset',
        }),
      ])
      setSelectedIds([variables.nodeId])
    },
    onError: (error, variables) => {
      setNodes(current => current.filter(node => node.id !== variables.nodeId))
      setEdges(current => current.filter(edge => (
        edge.source !== variables.nodeId && edge.target !== variables.nodeId
      )))
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
      if (!nodesRef.current.some(node => node.id === variables.nodeId)) {
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
      })
      setNodes(current => current.map(node => node.id === variables.nodeId
        ? {
            ...node,
            assetId: asset.id,
            transient: undefined,
          }
        : node))
      markDirty()
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

  useEffect(() => {
    const nodeIds = new Set(nodes.map(node => node.id))
    for (const [nodeId, controller] of controllersRef.current) {
      if (!nodeIds.has(nodeId) && uploadsRef.current[nodeId])
        controller.abort()
    }
  }, [nodes])

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
    () => Object.values(uploads).map(upload => upload.asset),
    [uploads],
  )
  const getUpload = useCallback(
    (nodeId: string) => uploads[nodeId],
    [uploads],
  )

  return {
    fileInputRef,
    getUpload,
    openFilePicker,
    transientAssets,
    uploadFiles,
  }
}
