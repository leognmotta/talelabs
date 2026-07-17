/** Local staging lifecycle for Files and existing Assets before Element creation. */

import type { ElementAssetRoleDefinition } from '@talelabs/elements'
import type { Asset } from '@talelabs/sdk'
import type { PendingElementAsset } from './pending-element-assets'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getAssetFileValidationError } from '../assets/upload/asset-upload-files'
import {
  elementAssetRoleHasCapacity,
  formatRejectedElementAssetFiles,
  getElementAssetMediaType,
  selectElementAssetFilesWithinRoleLimit,
} from './element-asset-limits'

function fileIdentity(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}:${file.type}`
}

/** Owns preview object URLs and revokes them when staged references leave the draft. */
export function usePendingElementAssets() {
  const { t } = useTranslation()
  const [assets, setAssets] = useState<PendingElementAsset[]>([])
  const assetsRef = useRef<PendingElementAsset[]>([])
  const previewUrlsRef = useRef(new Map<string, string>())

  const replaceAssets = useCallback((next: PendingElementAsset[]) => {
    assetsRef.current = next
    setAssets(next)
  }, [])

  const revokePreview = useCallback((clientId: string) => {
    const url = previewUrlsRef.current.get(clientId)
    if (url)
      URL.revokeObjectURL(url)
    previewUrlsRef.current.delete(clientId)
  }, [])

  const addFiles = useCallback(
    (files: File[], role: ElementAssetRoleDefinition) => {
      const validFiles = files.filter((file) => {
        const mediaType = getElementAssetMediaType(file.type)
        return (
          mediaType !== null
          && role.accepts.includes(mediaType)
          && getAssetFileValidationError(file) === null
        )
      })

      const invalidFiles = files.filter(file => !validFiles.includes(file))
      if (invalidFiles.length) {
        toast.error(t('elements.createAssets.invalidFiles'), {
          description: formatRejectedElementAssetFiles(invalidFiles),
        })
      }

      const current = assetsRef.current
      const roleAssets = current.filter(asset => asset.role === role.id)
      const identities = new Set(
        roleAssets.flatMap(asset =>
          asset.kind === 'upload' ? [fileIdentity(asset.file)] : []),
      )
      const available = validFiles.filter((file) => {
        const identity = fileIdentity(file)
        if (identities.has(identity))
          return false
        identities.add(identity)
        return true
      })
      const selection = selectElementAssetFilesWithinRoleLimit(
        available,
        roleAssets.length,
        role,
      )

      if (selection.rejected.length) {
        toast.error(t('elements.assetLimits.exceeded'), {
          description: formatRejectedElementAssetFiles(selection.rejected),
        })
      }

      const additions = selection.accepted.map((file, index) => {
        const clientId = crypto.randomUUID()
        const previewUrl = URL.createObjectURL(file)
        previewUrlsRef.current.set(clientId, previewUrl)
        return {
          clientId,
          file,
          kind: 'upload' as const,
          previewUrl,
          role: role.id,
          sortOrder: roleAssets.length + index,
        }
      })
      replaceAssets([...current, ...additions])
    },
    [replaceAssets, t],
  )

  const addExistingAsset = useCallback(
    (asset: Asset, role: ElementAssetRoleDefinition) => {
      const mediaType = getElementAssetMediaType(asset.type)
      if (!mediaType || !role.accepts.includes(mediaType)) {
        toast.error(t('elements.createAssets.invalidFiles'))
        return
      }

      const current = assetsRef.current
      const roleAssets = current.filter(item => item.role === role.id)
      if (
        roleAssets.some(item =>
          item.kind === 'existing' && item.asset.id === asset.id)
      ) {
        toast.error(t('elements.alreadyLinked'))
        return
      }
      if (!role.multiple && roleAssets.length > 0) {
        toast.error(t('elements.assetLimits.exceeded'))
        return
      }
      if (!elementAssetRoleHasCapacity(roleAssets.length, role)) {
        toast.error(t('elements.assetLimits.exceeded'))
        return
      }

      replaceAssets([
        ...current,
        {
          asset,
          clientId: crypto.randomUUID(),
          kind: 'existing',
          role: role.id,
          sortOrder: roleAssets.length,
        },
      ])
    },
    [replaceAssets, t],
  )

  const removeAsset = useCallback(
    (clientId: string) => {
      const removed = assetsRef.current.find(asset => asset.clientId === clientId)
      if (removed?.kind === 'upload')
        revokePreview(clientId)
      const remaining = assetsRef.current.filter(
        asset => asset.clientId !== clientId,
      )
      replaceAssets(remaining.map((asset) => {
        const sortOrder = remaining
          .filter(item => item.role === asset.role)
          .findIndex(item => item.clientId === asset.clientId)
        return { ...asset, sortOrder }
      }))
    },
    [replaceAssets, revokePreview],
  )

  const removeRoleAssets = useCallback(
    (role: string) => {
      const current = assetsRef.current
      for (const asset of current) {
        if (asset.role === role)
          revokePreview(asset.clientId)
      }
      replaceAssets(current.filter(asset => asset.role !== role))
    },
    [replaceAssets, revokePreview],
  )

  const clearAssets = useCallback(() => {
    for (const clientId of previewUrlsRef.current.keys())
      revokePreview(clientId)
    replaceAssets([])
  }, [replaceAssets, revokePreview])

  useEffect(
    () => () => {
      for (const url of previewUrlsRef.current.values())
        URL.revokeObjectURL(url)
      previewUrlsRef.current.clear()
    },
    [],
  )

  return {
    addExistingAsset,
    addFiles,
    assets,
    clearAssets,
    removeAsset,
    removeRoleAssets,
  }
}
