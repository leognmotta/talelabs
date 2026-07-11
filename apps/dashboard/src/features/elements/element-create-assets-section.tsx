import type {
  ElementAssetMediaType,
  ElementAssetRoleDefinition,
  ElementCustomAssetRole,
  ElementType,
  ElementTypeDefinition,
} from '@talelabs/elements'
import type { Asset } from '@talelabs/sdk'
import type { ElementAssetRoleId } from './element-i18n'
import type { PendingElementAsset } from './pending-element-assets'

import { IconPlus, IconX } from '@tabler/icons-react'
import { createElementAssetRole, getElementTypeDefinition } from '@talelabs/elements'
import { Button } from '@talelabs/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@talelabs/ui/components/card'
import { Input } from '@talelabs/ui/components/input'
import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ElementAssetDropzone } from './element-asset-dropzone'
import { ELEMENT_FORM_SECTIONS } from './element-form-sections'
import { elementAssetRoleTranslationKey } from './element-i18n'
import { ElementRoleMediaTypePicker } from './element-role-media-type-picker'

const AssetLibraryDialog = lazy(async () => ({
  default: (await import('../assets/asset-library-dialog')).AssetLibraryDialog,
}))

export function ElementCreateAssetsSection({
  assets,
  customRoles,
  elementType,
  onAddCustomRole,
  onExistingAsset,
  onFiles,
  onRemove,
  onRemoveCustomRole,
}: {
  assets: PendingElementAsset[]
  customRoles: ElementCustomAssetRole[]
  elementType: ElementType
  onAddCustomRole: (role: ElementCustomAssetRole) => void
  onExistingAsset: (asset: Asset, role: ElementAssetRoleDefinition) => void
  onFiles: (files: File[], roleId: string) => void
  onRemove: (clientId: string) => void
  onRemoveCustomRole: (role: string) => void
}) {
  const { t } = useTranslation()
  const definition: ElementTypeDefinition = getElementTypeDefinition(elementType)
  const customPolicy = definition.customAssetRoles
  const [addingRole, setAddingRole] = useState(false)
  const [pickerRole, setPickerRole] = useState<ElementAssetRoleDefinition | null>(null)
  const [roleError, setRoleError] = useState<'duplicate' | 'required' | null>(null)
  const [roleMediaType, setRoleMediaType] = useState<ElementAssetMediaType>(
    customPolicy?.allowedMediaTypes[0] ?? 'image',
  )
  const [roleName, setRoleName] = useState('')
  const atCustomRoleLimit = customPolicy
    ? customRoles.length >= customPolicy.maxRoles
    : true

  function addRole() {
    const role = roleName.trim()
    if (!role) {
      setRoleError('required')
      return
    }
    if (customRoles.some(item => item.id.toLowerCase() === role.toLowerCase())) {
      setRoleError('duplicate')
      return
    }
    onAddCustomRole({ id: role, mediaType: roleMediaType })
    setAddingRole(false)
    setRoleError(null)
    setRoleName('')
  }

  return (
    <Card id={ELEMENT_FORM_SECTIONS.assets} className="scroll-mt-6">
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{t('navigation.assets')}</CardTitle>
            <CardDescription>
              {t('elements.createAssets.description')}
            </CardDescription>
            <CardDescription className="mt-2 max-w-2xl">
              {t('elements.assetLimits.guidance')}
            </CardDescription>
          </div>
          {customPolicy && (
            <Button
              aria-label={t('elements.createAssets.addRole')}
              disabled={atCustomRoleLimit || addingRole}
              size="icon-sm"
              type="button"
              variant="outline"
              onClick={() => setAddingRole(true)}
            >
              <IconPlus />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-7">
        {customPolicy && addingRole && (
          <div className="rounded-xl border bg-muted/30 p-4">
            <label
              className="mb-2 block text-sm font-medium"
              htmlFor="element-custom-asset-role"
            >
              {t('elements.createAssets.customRoleName')}
            </label>
            <div className="flex gap-2">
              <Input
                id="element-custom-asset-role"
                aria-invalid={Boolean(roleError)}
                autoFocus
                maxLength={64}
                placeholder={t('elements.createAssets.customRolePlaceholder')}
                value={roleName}
                onChange={(event) => {
                  setRoleError(null)
                  setRoleName(event.target.value)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addRole()
                  }
                  if (event.key === 'Escape') {
                    setAddingRole(false)
                    setRoleError(null)
                    setRoleName('')
                  }
                }}
              />
              <Button type="button" onClick={addRole}>
                {t('elements.createAssets.confirmRole')}
              </Button>
              <Button
                aria-label={t('common.cancel')}
                size="icon"
                type="button"
                variant="ghost"
                onClick={() => {
                  setAddingRole(false)
                  setRoleError(null)
                  setRoleName('')
                }}
              >
                <IconX />
              </Button>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <span className="text-sm font-medium">{t('assets.type')}</span>
              <ElementRoleMediaTypePicker
                allowedMediaTypes={customPolicy.allowedMediaTypes}
                value={roleMediaType}
                onChange={setRoleMediaType}
              />
            </div>
            {roleError && (
              <p className="mt-2 text-sm text-destructive">
                {t(`elements.createAssets.customRoleErrors.${roleError}`)}
              </p>
            )}
          </div>
        )}
        {definition.assetRoles.map(role => (
          <ElementAssetDropzone
            key={role.id}
            assets={assets.filter(asset => asset.role === role.id)}
            label={t(
              elementAssetRoleTranslationKey(
                elementType,
                role.id as ElementAssetRoleId,
                'label',
              ),
            )}
            description={t(
              elementAssetRoleTranslationKey(
                elementType,
                role.id as ElementAssetRoleId,
                'description',
              ),
            )}
            role={role}
            onAddExisting={() => setPickerRole(role)}
            onFiles={files => onFiles(files, role.id)}
            onRemove={onRemove}
          />
        ))}
        {customPolicy && customRoles.map(customRole => (
          <ElementAssetDropzone
            key={customRole.id}
            assets={assets.filter(asset => asset.role === customRole.id)}
            description={t('elements.createAssets.customRoleDescription')}
            label={customRole.id}
            role={{
              ...createElementAssetRole(customRole.id, customRole.mediaType),
            }}
            onAddExisting={() => setPickerRole({
              ...createElementAssetRole(customRole.id, customRole.mediaType),
            })}
            onFiles={files => onFiles(files, customRole.id)}
            onRemove={onRemove}
            onRemoveRole={() => onRemoveCustomRole(customRole.id)}
          />
        ))}
        {customPolicy && customRoles.length === 0 && !addingRole && (
          <div className="
            rounded-xl border border-dashed px-4 py-10 text-center
          "
          >
            <p className="text-sm font-medium">
              {t('elements.createAssets.noCustomRoles')}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('elements.createAssets.noCustomRolesDescription', {
                count: customPolicy.maxRoles,
              })}
            </p>
          </div>
        )}
        {pickerRole && (
          <Suspense fallback={null}>
            <AssetLibraryDialog
              allowedTypes={[...pickerRole.accepts]}
              open
              selectedAssetIds={assets.flatMap(asset =>
                asset.kind === 'existing' && asset.role === pickerRole.id
                  ? [asset.asset.id]
                  : [])}
              onOpenChange={open => !open && setPickerRole(null)}
              onSelect={(asset) => {
                onExistingAsset(asset, pickerRole)
                setPickerRole(null)
              }}
            />
          </Suspense>
        )}
      </CardContent>
    </Card>
  )
}
