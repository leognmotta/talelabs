import type {
  ElementAssetMediaType,
  ElementCustomAssetRole,
} from '@talelabs/elements'

import { IconPencil, IconPlus, IconTrash, IconX } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { Input } from '@talelabs/ui/components/input'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ElementRoleMediaTypePicker } from './element-role-media-type-picker'

type RoleDraft = null | {
  id: string
  mediaType: ElementAssetMediaType
  original: null | string
}

export function ElementCustomRoleManager({
  allowedMediaTypes,
  protectedRoles,
  maxRoles,
  onChange,
  pending,
  roles,
}: {
  allowedMediaTypes: readonly ElementAssetMediaType[]
  protectedRoles: ReadonlySet<string>
  maxRoles: number
  onChange: (roles: ElementCustomAssetRole[]) => Promise<boolean>
  pending: boolean
  roles: ElementCustomAssetRole[]
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<RoleDraft>(null)
  const [error, setError] = useState<'duplicate' | 'required' | null>(null)

  async function saveDraft() {
    if (!draft)
      return
    const roleId = draft.id.trim()
    if (!roleId) {
      setError('required')
      return
    }
    if (roles.some(item =>
      item.id !== draft.original
      && item.id.toLowerCase() === roleId.toLowerCase())) {
      setError('duplicate')
      return
    }

    const next = draft.original === null
      ? [...roles, { id: roleId, mediaType: draft.mediaType }]
      : roles.map(item => item.id === draft.original
          ? { id: roleId, mediaType: draft.mediaType }
          : item)
    if (await onChange(next)) {
      setDraft(null)
      setError(null)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{t('elements.customRoles.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('elements.customRoles.description', { count: maxRoles })}
          </p>
        </div>
        <Button
          aria-label={t('elements.createAssets.addRole')}
          disabled={pending || draft !== null || roles.length >= maxRoles}
          size="icon-sm"
          type="button"
          variant="outline"
          onClick={() => setDraft({
            id: '',
            mediaType: allowedMediaTypes[0] ?? 'image',
            original: null,
          })}
        >
          <IconPlus />
        </Button>
      </header>

      {draft && (
        <div className="rounded-lg bg-muted/40 p-3">
          <label
            className="mb-2 block text-sm font-medium"
            htmlFor="element-custom-role-editor"
          >
            {t('elements.createAssets.customRoleName')}
          </label>
          <div className="flex gap-2">
            <Input
              id="element-custom-role-editor"
              aria-invalid={Boolean(error)}
              autoFocus
              maxLength={64}
              placeholder={t('elements.createAssets.customRolePlaceholder')}
              value={draft.id}
              onChange={(event) => {
                setError(null)
                setDraft(current => current
                  ? { ...current, id: event.target.value }
                  : current)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void saveDraft()
                }
                if (event.key === 'Escape') {
                  setDraft(null)
                  setError(null)
                }
              }}
            />
            <Button
              disabled={pending}
              type="button"
              onClick={() => void saveDraft()}
            >
              {t('common.save')}
            </Button>
            <Button
              aria-label={t('common.cancel')}
              disabled={pending}
              size="icon"
              type="button"
              variant="ghost"
              onClick={() => {
                setDraft(null)
                setError(null)
              }}
            >
              <IconX />
            </Button>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <span className="text-sm font-medium">{t('assets.type')}</span>
            <ElementRoleMediaTypePicker
              allowedMediaTypes={allowedMediaTypes}
              disabled={pending}
              value={draft.mediaType}
              onChange={mediaType => setDraft(current => current
                ? { ...current, mediaType }
                : current)}
            />
          </div>
          {error && (
            <p className="mt-2 text-sm text-destructive">
              {t(`elements.createAssets.customRoleErrors.${error}`)}
            </p>
          )}
        </div>
      )}

      {roles.length === 0 && draft === null
        ? (
            <p
              className="
                rounded-lg bg-muted/40 px-3 py-6 text-center text-sm
                text-muted-foreground
              "
            >
              {t('elements.createAssets.noCustomRoles')}
            </p>
          )
        : roles.map((role) => {
            const inUse = protectedRoles.has(role.id)
            const protectedHint = inUse
              ? t('elements.customRoles.inUse')
              : undefined
            return (
              <div
                key={role.id}
                className="
                  flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2
                "
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{role.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`assets.types.${role.mediaType}`)}
                  </p>
                  {inUse && (
                    <p className="text-xs text-muted-foreground">
                      {protectedHint}
                    </p>
                  )}
                </div>
                <Button
                  aria-label={t('elements.customRoles.edit', { name: role.id })}
                  disabled={pending || draft !== null || inUse}
                  size="icon-xs"
                  title={protectedHint}
                  type="button"
                  variant="ghost"
                  onClick={() => setDraft({
                    id: role.id,
                    mediaType: role.mediaType,
                    original: role.id,
                  })}
                >
                  <IconPencil />
                </Button>
                <Button
                  aria-label={t('elements.customRoles.remove', { name: role.id })}
                  disabled={pending || draft !== null || inUse}
                  size="icon-xs"
                  title={protectedHint}
                  type="button"
                  variant="ghost"
                  onClick={() => void onChange(
                    roles.filter(item => item.id !== role.id),
                  )}
                >
                  <IconTrash />
                </Button>
              </div>
            )
          })}
    </section>
  )
}
