/** Read-only grouping of a dormant Element's approved master references by role. */

import type { ElementTypeDefinition } from '@talelabs/elements'
import type { ElementAssetLink, ElementDetail } from '@talelabs/sdk'
import type { ElementAssetRoleId } from './element-i18n'

import { getElementAssetRoles, getElementTypeDefinition } from '@talelabs/elements'
import { Badge } from '@talelabs/ui/components/badge'
import { Skeleton } from '@talelabs/ui/components/skeleton'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { AssetMediaCard } from '../assets/media/asset-media-card'
import { useAssetViewerUrlState } from '../assets/viewer/use-asset-viewer-url-state'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { ElementAssetActionMenu } from './element-asset-action-menu'
import { elementAssetRoleTranslationKey } from './element-i18n'
import { useElementMutations } from './element.queries'

/** Summarizes usable master media without making Elements an active Flow dependency. */
export function ElementReferenceOverview({
  element,
  error,
  links,
  loading,
}: {
  element: ElementDetail
  error: boolean
  links: ElementAssetLink[]
  loading: boolean
}) {
  const { t } = useTranslation()
  const organizationId = useActiveOrganizationId()
  const viewer = useAssetViewerUrlState()
  const mutations = useElementMutations()
  const definition: ElementTypeDefinition = getElementTypeDefinition(element.type)
  const roles = getElementAssetRoles(element.type, element.data)
  const populatedRoles = roles.flatMap((role) => {
    const roleLinks = links.filter(link => link.role === role.id)
    return roleLinks.length > 0 ? [{ role, links: roleLinks }] : []
  })

  async function runMutation(
    operation: () => Promise<unknown>,
    successKey: 'elements.assetUnlinked' | 'elements.assetUpdated',
  ) {
    try {
      await operation()
      toast.success(t(successKey))
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'elements.actionFailed'))
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold tracking-tight">
        {t('elements.references')}
      </h2>
      {loading && (
        <div className="flex flex-wrap gap-4">
          {['first', 'second', 'third'].map(slot => (
            <Skeleton
              className="
                size-40 rounded-xl
                sm:size-48
              "
              key={slot}
            />
          ))}
        </div>
      )}
      {error && (
        <p className="text-sm text-muted-foreground">
          {t('elements.couldNotLoadAssets')}
        </p>
      )}
      {!loading && !error && populatedRoles.length === 0 && (
        <div className="rounded-xl border border-dashed px-5 py-7">
          <p className="text-sm font-medium">{t('elements.noReferences')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('elements.noReferencesDescription')}
          </p>
        </div>
      )}
      {!loading && !error && populatedRoles.map(({ role, links: roleLinks }) => {
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
          <section className="flex flex-col gap-3" key={role.id}>
            <div>
              <h3 className="text-sm font-medium">{label}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="flex flex-wrap gap-4">
              {roleLinks.map(link => (
                <div
                  className="
                    w-40
                    sm:w-48
                  "
                  key={`${link.role}:${link.assetId}`}
                >
                  <AssetMediaCard
                    asset={link.asset}
                    badges={(
                      <Badge
                        className="max-w-28 truncate"
                        title={label}
                        variant="outline"
                      >
                        {label}
                      </Badge>
                    )}
                    previewAriaLabel={t('assets.viewDetails')}
                    previewClassName="cursor-pointer"
                    topActions={(
                      <div className="pointer-events-auto ml-auto">
                        <ElementAssetActionMenu
                          isPrimary={link.isPrimary}
                          pending={!organizationId
                            || mutations.updateAsset.isPending
                            || mutations.unlinkAsset.isPending}
                          onDelete={() => {
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
                          onMakeThumbnail={() => {
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
                        />
                      </div>
                    )}
                    onClick={() => viewer.openAsset(link.assetId)}
                  />
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </section>
  )
}
