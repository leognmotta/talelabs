/** Existing-reference management for one dormant Element and its canonical Assets. */

import type {
  ElementAssetRoleDefinition,
  ElementCustomAssetRole,
  ElementTypeDefinition,
} from '@talelabs/elements'
import type { Asset, ElementAssetLink, ElementDetail } from '@talelabs/sdk'

import type { ElementUploadItem } from './element-asset-role-section'
import type { ElementAssetRoleId } from './element-i18n'
import { getElementAssetRoles, getElementTypeDefinition } from '@talelabs/elements'
import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { useAssetViewerUrlState } from '../assets/viewer/use-asset-viewer-url-state'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { cancelUploadItem } from '../uploads/cancellation/upload-item-cancellation'
import { enqueueElementUploadBatch } from '../uploads/queue/upload-queue-enqueue'
import { uploadStore } from '../uploads/upload-store'
import { isActiveUploadStatus } from '../uploads/upload.types'
import {
  elementAssetRoleHasCapacity,
  formatRejectedElementAssetFiles,
  getElementAssetMediaType,
  selectElementAssetFilesWithinRoleLimit,
} from './element-asset-limits'
import { ElementAssetRoleSection } from './element-asset-role-section'
import { ElementCustomRoleManager } from './element-custom-role-manager'
import { elementAssetRoleTranslationKey } from './element-i18n'
import { useElementKitQuery, useElementMutations } from './element.queries'

const AssetLibraryDialog = lazy(async () => ({
  default: (await import('../assets/library/asset-library-dialog')).AssetLibraryDialog,
}))

/** Coordinates role limits, master links, and background uploads for one Element. */
export function ElementAssetsTab({ element }: { element: ElementDetail }) {
  const { t } = useTranslation()
  const organizationId = useActiveOrganizationId()
  const viewer = useAssetViewerUrlState()
  const kit = useElementKitQuery(element.id)
  const mutations = useElementMutations()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pickerRole, setPickerRole] = useState<ElementAssetRoleDefinition | null>(null)
  const [uploadRole, setUploadRole] = useState<ElementAssetRoleDefinition | null>(null)
  const elementUploadItems = useStore(uploadStore, useShallow(state =>
    state.itemOrder
      .map(id => state.items[id])
      .filter(item => item?.organizationId === organizationId
        && item.elementId === element.id
        && (isActiveUploadStatus(item.status) || item.status === 'failed')),
  ))
  const uploads: ElementUploadItem[] = elementUploadItems
    .filter(item => isActiveUploadStatus(item.status))
    .flatMap((item) => {
      const mediaType = getElementAssetMediaType(item.mimeType)
      return mediaType
        ? [{
            cancel: () => cancelUploadItem(item.id),
            id: item.id,
            mediaType,
            name: item.filename,
            progress: item.progress,
            role: item.role ?? '',
          }]
        : []
    })
  const definition: ElementTypeDefinition = getElementTypeDefinition(element.type)
  const roles = useMemo(
    () => getElementAssetRoles(element.type, element.data),
    [element.data, element.type],
  )
  const links = useMemo(() => kit.data?.data ?? [], [kit.data?.data])
  const linkedIds = useMemo(() => [...new Set(links.map(link => link.assetId))], [links])
  const customRoles = useMemo(
    () => roles
      .filter(role => !definition.assetRoles.some(item => item.id === role.id))
      .map(({ accepts, id }): ElementCustomAssetRole => ({
        id,
        mediaType: accepts[0],
      })),
    [definition.assetRoles, roles],
  )
  const protectedRoles = useMemo(
    () => new Set([
      ...links.map(link => link.role),
      ...elementUploadItems.flatMap(item => item.role ? [item.role] : []),
    ]),
    [elementUploadItems, links],
  )

  async function runMutation(operation: () => Promise<unknown>, successKey: 'elements.assetAttached' | 'elements.assetUnlinked' | 'elements.assetUpdated') {
    try {
      await operation()
      toast.success(t(successKey))
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'elements.actionFailed'))
    }
  }

  async function updateCustomRoles(nextRoles: ElementCustomAssetRole[]) {
    if (!organizationId)
      return false
    try {
      await mutations.update.mutateAsync({
        id: element.id,
        data: {
          data: { ...element.data, assetRoles: nextRoles },
        },
        organizationId,
      })
      toast.success(t('elements.customRoles.updated'))
      return true
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'elements.actionFailed'))
      return false
    }
  }

  function attachAsset(asset: Asset) {
    if (!pickerRole || !organizationId)
      return
    if (links.some(link => link.role === pickerRole.id && link.assetId === asset.id)) {
      toast.error(t('elements.alreadyLinked'))
      return
    }
    const mediaType = getElementAssetMediaType(asset.type)
    if (!mediaType || !pickerRole.accepts.includes(mediaType)) {
      toast.error(t('elements.createAssets.invalidFiles'))
      return
    }
    const roleAssetCount = links.filter(link => link.role === pickerRole.id).length
      + elementUploadItems.filter(item => item.role === pickerRole.id).length
    if (!elementAssetRoleHasCapacity(roleAssetCount, pickerRole)) {
      toast.error(t('elements.assetLimits.exceeded'))
      return
    }
    const role = pickerRole.id
    setPickerRole(null)
    void runMutation(
      () => mutations.attachAsset.mutateAsync({
        assetId: asset.id,
        elementId: element.id,
        organizationId,
        role,
      }),
      'elements.assetAttached',
    )
  }

  if (kit.isPending)
    return <p className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
  if (kit.isError) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">{t('elements.couldNotLoadAssets')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-6">
      <input
        ref={inputRef}
        className="sr-only"
        multiple={uploadRole?.multiple ?? false}
        type="file"
        accept={uploadRole?.accepts.map(type => `${type}/*`).join(',')}
        aria-label={t('elements.uploadAndAttach')}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          if (!files.length)
            return
          if (!uploadRole)
            return
          const compatibleFiles = files.filter((file) => {
            const mediaType = getElementAssetMediaType(file.type)
            return mediaType !== null && uploadRole.accepts.includes(mediaType)
          })
          const incompatibleFiles = files.filter(
            file => !compatibleFiles.includes(file),
          )
          if (incompatibleFiles.length) {
            toast.error(t('elements.createAssets.invalidFiles'), {
              description: formatRejectedElementAssetFiles(incompatibleFiles),
            })
          }
          const roleLinkCount = links.filter(
            link => link.role === uploadRole.id,
          ).length
          const roleUploadCount = elementUploadItems.filter(
            upload => upload.role === uploadRole.id,
          ).length
          const selection = selectElementAssetFilesWithinRoleLimit(
            compatibleFiles,
            roleLinkCount + roleUploadCount,
            uploadRole,
          )
          if (selection.rejected.length) {
            toast.error(t('elements.assetLimits.exceeded'), {
              description: formatRejectedElementAssetFiles(selection.rejected),
            })
          }
          if (!selection.accepted.length) {
            setUploadRole(null)
            return
          }
          if (!organizationId) {
            setUploadRole(null)
            return
          }
          const batchId = enqueueElementUploadBatch({
            destinationLabel: element.name,
            elementId: element.id,
            files: selection.accepted.map((file, index) => ({
              file,
              isPrimary: roleLinkCount + roleUploadCount + index === 0,
              role: uploadRole.id,
              sortOrder: roleLinkCount + roleUploadCount + index,
            })),
            folderId: element.assetFolderId,
            organizationId,
          })
          if (!batchId)
            toast.error(t('errors.organization_context_changed'))
          setUploadRole(null)
        }}
      />
      <p className="text-sm text-muted-foreground">
        {t('elements.assetLimits.summary')}
      </p>
      {definition.customAssetRoles && (
        <ElementCustomRoleManager
          allowedMediaTypes={definition.customAssetRoles.allowedMediaTypes}
          protectedRoles={protectedRoles}
          maxRoles={definition.customAssetRoles.maxRoles}
          pending={mutations.update.isPending}
          roles={customRoles}
          onChange={updateCustomRoles}
        />
      )}
      {roles.map((role) => {
        const roleLinks = links.filter(link => link.role === role.id)
        const custom = !definition.assetRoles.some(item => item.id === role.id)
        const label = custom
          ? role.id
          : t(elementAssetRoleTranslationKey(
              element.type,
              role.id as ElementAssetRoleId,
              'label',
            ))
        const description = custom
          ? t('elements.createAssets.customRoleDescription')
          : t(elementAssetRoleTranslationKey(
              element.type,
              role.id as ElementAssetRoleId,
              'description',
            ))
        return (
          <ElementAssetRoleSection
            key={role.id}
            description={description}
            label={label}
            links={roleLinks}
            pending={mutations.updateAsset.isPending || mutations.unlinkAsset.isPending}
            reservedUploadCount={elementUploadItems.filter(
              upload => upload.role === role.id,
            ).length}
            role={role}
            uploads={uploads.filter(upload => upload.role === role.id)}
            onAddExisting={() => setPickerRole(role)}
            onOpenAsset={viewer.openAsset}
            onPrimary={(link: ElementAssetLink) => {
              if (!organizationId)
                return
              void runMutation(
                () => mutations.updateAsset.mutateAsync({
                  assetId: link.assetId,
                  elementId: element.id,
                  isPrimary: true,
                  organizationId,
                  role: link.role,
                }),
                'elements.assetUpdated',
              )
            }}
            onUnlink={(link: ElementAssetLink) => {
              if (!organizationId)
                return
              void runMutation(
                () => mutations.unlinkAsset.mutateAsync({
                  assetId: link.assetId,
                  elementId: element.id,
                  organizationId,
                  role: link.role,
                }),
                'elements.assetUnlinked',
              )
            }}
            onUpload={() => {
              setUploadRole(role)
              window.requestAnimationFrame(() => inputRef.current?.click())
            }}
          />
        )
      })}
      {pickerRole && (
        <Suspense fallback={null}>
          <AssetLibraryDialog
            allowedTypes={[...pickerRole.accepts]}
            open
            selectedAssetIds={linkedIds}
            onOpenChange={open => !open && setPickerRole(null)}
            onSelect={attachAsset}
          />
        </Suspense>
      )}
    </div>
  )
}
