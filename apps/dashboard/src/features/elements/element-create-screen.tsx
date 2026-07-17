/** Dormant Element creation route with local reference staging and queue handoff. */

import type { ElementCustomAssetRole } from '@talelabs/elements'
import type { ElementFormSubmission } from './forms/element-form.types'

import { getElementAssetRole, isElementType } from '@talelabs/elements'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { enqueueElementUploadBatch } from '../uploads/queue/upload-queue-enqueue'
import { ElementCreateAssetsSection } from './element-create-assets-section'
import { ElementEditorLayout } from './element-editor-layout'
import { elementTypeTranslationKey } from './element-i18n'
import { ELEMENT_TYPE_ICONS } from './element-type-icons'
import { useElementMutations } from './element.queries'
import { ELEMENT_FORM_REGISTRY } from './forms/element-form-registry'
import { usePendingElementAssets } from './use-pending-element-assets'

/** Persists identity first, then transfers staged Files to background uploads. */
export function ElementCreateScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { elementType } = useParams()
  const mutations = useElementMutations()
  const organizationId = useActiveOrganizationId()
  const pendingAssets = usePendingElementAssets()
  const [customAssetRoles, setCustomAssetRoles]
    = useState<ElementCustomAssetRole[]>([])
  const [submitting, setSubmitting] = useState(false)

  if (!isElementType(elementType))
    return <Navigate replace to="/elements" />

  const resolvedElementType = elementType
  const registryEntry = ELEMENT_FORM_REGISTRY[resolvedElementType]
  const Form = registryEntry.Form
  const Icon = ELEMENT_TYPE_ICONS[resolvedElementType]
  const typeLabel = t(elementTypeTranslationKey(resolvedElementType, 'label'))

  async function createElement(value: ElementFormSubmission) {
    if (!organizationId) {
      toast.error(t('errors.active_organization_required'))
      return
    }

    setSubmitting(true)

    let element
    try {
      const submission = resolvedElementType === 'other'
        ? {
            ...value,
            data: { ...value.data, assetRoles: customAssetRoles },
          }
        : value
      element = await mutations.create.mutateAsync({
        data: {
          ...submission,
          type: resolvedElementType,
        },
        organizationId,
      })
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'elements.actionFailed'))
      setSubmitting(false)
      return
    }

    const existingAssets = pendingAssets.assets.filter(asset =>
      asset.kind === 'existing')
    const linkResults = await Promise.allSettled(existingAssets.map(asset =>
      mutations.attachAsset.mutateAsync({
        assetId: asset.asset.id,
        elementId: element.id,
        isPrimary: asset.sortOrder === 0,
        organizationId,
        role: asset.role,
        sortOrder: asset.sortOrder,
      })))
    const failedLink = linkResults.find(result => result.status === 'rejected')
    if (failedLink?.status === 'rejected')
      toast.error(getApiErrorMessage(failedLink.reason, 'elements.actionFailed'))

    const uploads = pendingAssets.assets.filter(asset => asset.kind === 'upload')
    const uploadBatchId = uploads.length > 0
      ? enqueueElementUploadBatch({
          destinationLabel: element.name,
          elementId: element.id,
          files: uploads.map(asset => ({
            clientId: asset.clientId,
            file: asset.file,
            isPrimary: asset.sortOrder === 0,
            role: asset.role,
            sortOrder: asset.sortOrder,
          })),
          folderId: element.assetFolderId,
          organizationId,
        })
      : null
    if (uploads.length > 0 && !uploadBatchId)
      toast.error(t('errors.organization_context_changed'))
    pendingAssets.clearAssets()

    toast.success(t('elements.created'))
    navigate(`/elements/${element.id}`, { replace: true })
  }

  return (
    <ElementEditorLayout
      backLabel={t('elements.backToElements')}
      backTo="/elements"
      description={t('elements.createEditor.description')}
      icon={Icon}
      title={t('elements.createType', { type: typeLabel })}
    >
      <Form
        assetsSection={(
          <ElementCreateAssetsSection
            assets={pendingAssets.assets}
            customRoles={customAssetRoles}
            elementType={resolvedElementType}
            onAddCustomRole={role =>
              setCustomAssetRoles(current => [...current, role])}
            onFiles={(files, roleId) => {
              const role = getElementAssetRole(
                resolvedElementType,
                roleId,
                { assetRoles: customAssetRoles },
              )
              if (role)
                pendingAssets.addFiles(files, role)
            }}
            onExistingAsset={pendingAssets.addExistingAsset}
            onRemove={pendingAssets.removeAsset}
            onRemoveCustomRole={(role) => {
              pendingAssets.removeRoleAssets(role)
              setCustomAssetRoles(current =>
                current.filter(item => item.id !== role))
            }}
          />
        )}
        pending={submitting || mutations.create.isPending}
        submitLabel={t('common.create')}
        onSubmit={createElement}
      />
    </ElementEditorLayout>
  )
}
