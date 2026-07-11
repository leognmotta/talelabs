import type { Asset, Tag } from '@talelabs/sdk'
import type { AssetActions } from './asset-actions.types'

import { IconPlus, IconTag, IconTagFilled } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@talelabs/ui/components/command'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@talelabs/ui/components/popover'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LibraryItemAction } from './library-item-action'

export function AssetTagPicker({
  actions,
  asset,
  className,
}: {
  actions: AssetActions
  asset: Asset
  className?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const hasExactMatch = actions.tags.some(
    tag => tag.name.toLocaleLowerCase() === normalizedSearch,
  )

  async function createTag() {
    const name = search.trim()
    if (!name || hasExactMatch)
      return

    await actions.onCreateTag(asset, name)
    setSearch('')
  }

  async function toggleTag(tag: Tag) {
    await actions.onToggleTag(asset, tag)
  }

  return (
    <LibraryItemAction>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={(
            <Button
              aria-label={t('assets.editTags', { name: asset.name })}
              className={className}
              disabled={actions.tagPending}
              size="icon-sm"
              type="button"
              variant="secondary"
            />
          )}
        >
          {asset.tags.length > 0 ? <IconTagFilled /> : <IconTag />}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 gap-0 p-0">
          <PopoverHeader className="sr-only">
            <PopoverTitle>{t('assets.editTags', { name: asset.name })}</PopoverTitle>
            <PopoverDescription>{t('assets.editTagsDescription')}</PopoverDescription>
          </PopoverHeader>
          <Command shouldFilter>
            <CommandInput
              placeholder={t('assets.searchOrCreateTag')}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>{t('assets.noTags')}</CommandEmpty>
              {actions.tags.length > 0 && (
                <CommandGroup heading={t('assets.tags')}>
                  {actions.tags.map(tag => (
                    <CommandItem
                      data-checked={asset.tags.some(item => item.id === tag.id)}
                      disabled={actions.tagPending}
                      key={tag.id}
                      value={tag.name}
                      onSelect={() => void toggleTag(tag)}
                    >
                      <IconTag />
                      {tag.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {normalizedSearch && !hasExactMatch && (
                <CommandGroup heading={t('common.create')}>
                  <CommandItem
                    disabled={actions.tagPending}
                    value={search}
                    onSelect={() => void createTag()}
                  >
                    <IconPlus />
                    {t('assets.createTag', { name: search.trim() })}
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </LibraryItemAction>
  )
}
