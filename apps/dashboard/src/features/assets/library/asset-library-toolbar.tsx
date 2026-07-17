/** Search, filters, sorting, upload, and view controls for the Asset library. */

import type { Tag } from '@talelabs/sdk'
import type {
  AssetLibraryFilters,
  AssetLibraryPresentation,
  AssetLibraryView,
} from './asset-library.types'

import {
  IconArchive,
  IconGridDots,
  IconHeart,
  IconList,
  IconLoader2,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconTag,
  IconX,
} from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { ButtonGroup } from '@talelabs/ui/components/button-group'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@talelabs/ui/components/input-group'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from '@talelabs/ui/components/select'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@talelabs/ui/components/toggle-group'
import { cn } from '@talelabs/ui/lib/utils'
import { useTranslation } from 'react-i18next'

/** Emits controller commands without duplicating URL or server state locally. */
export function AssetLibraryToolbar({
  filters,
  onFiltersChange,
  onViewChange,
  presentation = 'page',
  searchPending,
  tags,
  view,
}: {
  filters: AssetLibraryFilters
  onFiltersChange: (filters: Partial<AssetLibraryFilters>) => void
  onViewChange: (view: AssetLibraryView) => void
  presentation?: AssetLibraryPresentation
  searchPending: boolean
  tags: Tag[]
  view: AssetLibraryView
}) {
  const { t } = useTranslation()
  const mediaLabel = filters.type === 'image'
    ? t('assets.images')
    : filters.type === 'video'
      ? t('assets.videos')
      : filters.type === 'audio'
        ? t('assets.audio')
        : filters.type === 'document'
          ? t('assets.types.document')
          : t('assets.allMedia')
  const sourceLabel = filters.source === 'upload'
    ? t('assets.uploads')
    : filters.source === 'generation'
      ? t('assets.generated')
      : t('assets.allSources')
  const sortLabel = filters.sort === 'name'
    ? t('common.name')
    : filters.sort === 'sizeBytes'
      ? t('assets.size')
      : t('assets.dateCreated')
  const tagLabel = tags.find(tag => tag.id === filters.tagId)?.name ?? t('assets.allTags')
  const hasActiveFilters = Boolean(
    filters.search || filters.type || filters.source || filters.tagId
    || filters.favorite || filters.archived,
  )

  return (
    <div className="flex flex-wrap items-center gap-2 pb-4">
      <InputGroup
        className={cn(
          'w-full',
          presentation === 'page' && `
            bg-muted/50
            sm:w-72
          `,
          presentation === 'dialog' && 'sm:w-96',
        )}
        variant={presentation === 'dialog' ? 'outline' : 'default'}
      >
        <InputGroupAddon>
          <IconSearch />
        </InputGroupAddon>
        <InputGroupInput
          aria-label={t('assets.search')}
          aria-busy={searchPending}
          placeholder={t('assets.searchPlaceholder')}
          value={filters.search}
          onChange={event => onFiltersChange({ search: event.target.value })}
        />
        {searchPending && (
          <InputGroupAddon align="inline-end">
            <IconLoader2
              aria-hidden
              className="
                animate-spin
                motion-reduce:animate-none
              "
            />
          </InputGroupAddon>
        )}
      </InputGroup>
      <ButtonGroup className="max-w-full overflow-x-auto">
        <Select
          value={filters.type ?? 'all'}
          onValueChange={(value) => {
            const type = value === 'image' || value === 'video' || value === 'audio' || value === 'document'
              ? value
              : undefined
            onFiltersChange({ type })
          }}
        >
          <SelectTrigger size="sm" aria-label={t('assets.mediaType')}>
            <span>{mediaLabel}</span>
          </SelectTrigger>
          <SelectContent align="start">
            <SelectGroup>
              <SelectItem value="all">{t('assets.allMedia')}</SelectItem>
              <SelectItem value="image">{t('assets.images')}</SelectItem>
              <SelectItem value="video">{t('assets.videos')}</SelectItem>
              <SelectItem value="audio">{t('assets.audio')}</SelectItem>
              <SelectItem value="document">{t('assets.types.document')}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          value={filters.source ?? 'all'}
          onValueChange={(value) => {
            const source = value === 'upload' || value === 'generation'
              ? value
              : undefined
            onFiltersChange({ source })
          }}
        >
          <SelectTrigger size="sm" aria-label={t('assets.source')}>
            <span>{sourceLabel}</span>
          </SelectTrigger>
          <SelectContent align="start">
            <SelectGroup>
              <SelectItem value="all">{t('assets.allSources')}</SelectItem>
              <SelectItem value="upload">{t('assets.uploads')}</SelectItem>
              <SelectItem value="generation">{t('assets.generated')}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          value={filters.tagId ?? 'all'}
          onValueChange={value => onFiltersChange({
            tagId: !value || value === 'all' ? undefined : value,
          })}
        >
          <SelectTrigger size="sm" aria-label={t('assets.filterByTag')}>
            <IconTag />
            <span>{tagLabel}</span>
          </SelectTrigger>
          <SelectContent align="start">
            <SelectGroup>
              <SelectItem value="all">{t('assets.allTags')}</SelectItem>
              {tags.map(tag => <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
      </ButtonGroup>
      <ToggleGroup
        multiple
        spacing={0}
        size="sm"
        value={[
          ...(filters.favorite ? ['favorite'] : []),
          ...(filters.archived ? ['archived'] : []),
        ]}
        variant="outline"
        onValueChange={values => onFiltersChange({
          archived: values.includes('archived'),
          favorite: values.includes('favorite'),
        })}
      >
        <ToggleGroupItem value="favorite">
          <IconHeart data-icon="inline-start" />
          {t('assets.favorites')}
        </ToggleGroupItem>
        <ToggleGroupItem value="archived">
          <IconArchive data-icon="inline-start" />
          {t('assets.archived')}
        </ToggleGroupItem>
      </ToggleGroup>
      {hasActiveFilters && (
        <Button
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => onFiltersChange({
            archived: false,
            favorite: false,
            search: '',
            source: undefined,
            tagId: undefined,
            type: undefined,
          })}
        >
          <IconX data-icon="inline-start" />
          {t('assets.clearFilters')}
        </Button>
      )}
      <div className="ml-auto flex items-center gap-2">
        <ButtonGroup>
          <Select
            value={filters.sort}
            onValueChange={(value) => {
              if (value === 'createdAt' || value === 'name' || value === 'sizeBytes')
                onFiltersChange({ sort: value })
            }}
          >
            <SelectTrigger size="sm" aria-label={t('assets.sortBy')}>
              <span>{sortLabel}</span>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                <SelectItem value="createdAt">{t('assets.dateCreated')}</SelectItem>
                <SelectItem value="name">{t('common.name')}</SelectItem>
                <SelectItem value="sizeBytes">{t('assets.size')}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            aria-label={filters.order === 'asc' ? t('assets.ascending') : t('assets.descending')}
            size="icon-sm"
            type="button"
            variant="outline"
            onClick={() => onFiltersChange({
              order: filters.order === 'asc' ? 'desc' : 'asc',
            })}
          >
            {filters.order === 'asc' ? <IconSortAscending /> : <IconSortDescending />}
          </Button>
        </ButtonGroup>
        <ToggleGroup
          aria-label={t('assets.view')}
          spacing={0}
          value={[view]}
          variant="outline"
          onValueChange={(values) => {
            const next = values.at(-1)
            if (next === 'grid' || next === 'list')
              onViewChange(next)
          }}
        >
          <ToggleGroupItem value="grid" aria-label={t('assets.gridView')}>
            <IconGridDots />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label={t('assets.listView')}>
            <IconList />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  )
}
