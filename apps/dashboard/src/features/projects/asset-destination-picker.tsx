/**
 * Shared per-run generated-Asset destination control for Create and Flows.
 *
 * Undefined preserves admission-time defaults; null is an explicit root
 * override; a folder ID is validated and immutably captured by admission.
 */

import type { Folder } from '@talelabs/sdk'

import { IconFolder, IconRoute } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@talelabs/ui/components/combobox'
import { cn } from '@talelabs/ui/lib/utils'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useFoldersQuery } from '../assets/data/folder-query'
import { useProjectQuery } from './project-queries'

const AUTOMATIC_VALUE = '__automatic__'
const ROOT_VALUE = '__root__'

interface DestinationOption {
  id: string
  kind: 'automatic' | 'folder'
  label: string
  searchValue: string
}

/** A request override, or undefined when the shared resolver owns selection. */
export type AssetDestinationSelection = null | string | undefined

function folderPath(folder: Folder, foldersById: Map<string, Folder>) {
  const names = [folder.name]
  const seen = new Set([folder.id])
  let parentId = folder.parentId
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId)
    const parent = foldersById.get(parentId)
    if (!parent)
      break
    names.unshift(parent.name)
    parentId = parent.parentId
  }
  return names.join(' / ')
}

/** Selects a one-run override from one scoped bounded folder metadata set. */
export function AssetDestinationPicker({
  className,
  projectId,
  sourceFolderId,
  value,
  onChange,
}: {
  /** Optional trigger width or surface styling. */
  className?: string
  /** Project scope, or null for Private folders. */
  projectId: null | string
  /** Persisted source default that precedes the Project default. */
  sourceFolderId?: null | string
  /** Current explicit override, or undefined for automatic resolution. */
  value: AssetDestinationSelection
  /** Updates only the next-run override. */
  onChange: (value: AssetDestinationSelection) => void
}) {
  const { t } = useTranslation()
  const query = useFoldersQuery(true, projectId)
  const projectQuery = useProjectQuery(projectId)
  const folders = useMemo(() => query.data?.data ?? [], [query.data?.data])
  const foldersById = useMemo(
    () => new Map(folders.map(folder => [folder.id, folder])),
    [folders],
  )
  const selectedValue = value === undefined
    ? AUTOMATIC_VALUE
    : value === null
      ? ROOT_VALUE
      : value
  const selectedFolder = typeof value === 'string'
    ? foldersById.get(value)
    : null
  const sourceFolder = projectId && sourceFolderId
    ? foldersById.get(sourceFolderId)
    : null
  const hasSourceDefault = Boolean(projectId && sourceFolderId)
  const projectDefaultFolderId = projectQuery.data?.defaultAssetFolderId
  const projectDefaultFolder = projectDefaultFolderId
    ? foldersById.get(projectDefaultFolderId)
    : null
  const inheritedLabel = projectId
    ? hasSourceDefault
      ? sourceFolder
        ? folderPath(sourceFolder, foldersById)
        : t('projects.destinationDefault')
      : projectDefaultFolder
        ? t('projects.destinationProjectDefaultFolder', {
            folder: folderPath(projectDefaultFolder, foldersById),
          })
        : projectQuery.isSuccess && !projectDefaultFolderId
          ? t('projects.projectRoot')
          : t('projects.destinationProjectDefault')
    : t('projects.destinationAutomatic')
  const inheritedOptionLabel = projectId
    ? hasSourceDefault
      ? t('projects.destinationDefault')
      : t('projects.destinationProjectDefault')
    : t('projects.destinationAutomatic')
  const rootLabel = t(projectId
    ? 'projects.projectRoot'
    : 'projects.privateRoot')
  const selectedLabel = value === undefined
    ? inheritedLabel
    : value === null
      ? rootLabel
      : selectedFolder
        ? folderPath(selectedFolder, foldersById)
        : t('projects.destinationUnavailable')
  const options: DestinationOption[] = [
    {
      id: AUTOMATIC_VALUE,
      kind: 'automatic',
      label: inheritedOptionLabel,
      searchValue: `${inheritedOptionLabel} ${inheritedLabel}`,
    },
    {
      id: ROOT_VALUE,
      kind: 'folder',
      label: rootLabel,
      searchValue: rootLabel,
    },
    ...folders.map((folder) => {
      const label = folderPath(folder, foldersById)
      return {
        id: folder.id,
        kind: 'folder' as const,
        label,
        searchValue: label,
      }
    }),
  ]
  const selectedOption = options.find(option => option.id === selectedValue)
    ?? null

  useEffect(() => {
    if (
      typeof value === 'string'
      && !query.isPending
      && !foldersById.has(value)
    ) {
      onChange(undefined)
    }
  }, [foldersById, onChange, query.isPending, value])

  return (
    <Combobox
      autoHighlight
      filter={(option, search) => option.searchValue
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase())}
      isItemEqualToValue={(option, selected) => option.id === selected.id}
      itemToStringLabel={option => option.label}
      itemToStringValue={option => option.id}
      items={options}
      value={selectedOption}
      onValueChange={(nextOption) => {
        if (!nextOption || nextOption.id === selectedValue)
          return
        if (nextOption.id === AUTOMATIC_VALUE)
          onChange(undefined)
        else if (nextOption.id === ROOT_VALUE)
          onChange(null)
        else
          onChange(nextOption.id)
      }}
    >
      <ComboboxTrigger
        render={(
          <Button
            aria-label={t('projects.outputFolder')}
            className={cn(
              `
                w-fit min-w-0 justify-between gap-1.5 border-transparent
                bg-input/50 font-normal
              `,
              className,
            )}
            size="sm"
            type="button"
            variant="outline"
          />
        )}
      >
        {value === undefined && !projectId
          ? <IconRoute />
          : <IconFolder />}
        <span className="min-w-0 flex-1 truncate" title={selectedLabel}>
          {selectedLabel}
        </span>
      </ComboboxTrigger>
      <ComboboxContent
        aria-label={t('projects.outputFolder')}
        align="start"
        className={`
          w-[min(24rem,calc(100vw-2rem))] min-w-0 rounded-2xl border
          border-border/90 shadow-2xl
          *:data-[slot=input-group]:m-2 *:data-[slot=input-group]:mb-0
          *:data-[slot=input-group]:h-9
        `}
        sideOffset={4}
      >
        <ComboboxInput
          aria-label={t('projects.searchFolders')}
          placeholder={t('projects.searchFolders')}
          showTrigger={false}
          variant="outline"
        />
        <ComboboxEmpty className="px-4 py-6">
          {t('projects.noFolderResults')}
        </ComboboxEmpty>
        <ComboboxList className="max-h-72">
          {(option: DestinationOption) => (
            <ComboboxItem key={option.id} value={option}>
              {option.kind === 'automatic'
                ? <IconRoute />
                : <IconFolder />}
              <span
                className="min-w-0 flex-1 truncate"
                title={option.label}
              >
                {option.label}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
