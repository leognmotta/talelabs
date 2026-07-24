/**
 * Shared per-run generated-Asset destination control for Create and Flows.
 *
 * Undefined preserves admission-time defaults; null is an explicit root
 * override; a folder ID is validated and immutably captured by admission.
 */

import type { Folder } from '@talelabs/sdk'

import { IconFolder, IconRoute } from '@tabler/icons-react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from '@talelabs/ui/components/select'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useFoldersQuery } from '../assets/data/folder-query'
import { useProjectQuery } from './project-queries'

const AUTOMATIC_VALUE = '__automatic__'
const ROOT_VALUE = '__root__'

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
  const selectedLabel = value === undefined
    ? inheritedLabel
    : value === null
      ? t(projectId
          ? 'projects.projectRoot'
          : 'projects.privateRoot')
      : selectedFolder
        ? folderPath(selectedFolder, foldersById)
        : t('projects.destinationUnavailable')

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
    <Select
      value={selectedValue}
      onValueChange={(nextValue) => {
        if (nextValue === AUTOMATIC_VALUE)
          onChange(undefined)
        else if (nextValue === ROOT_VALUE)
          onChange(null)
        else if (typeof nextValue === 'string')
          onChange(nextValue)
      }}
    >
      <SelectTrigger
        aria-label={t('projects.outputFolder')}
        className={className}
        size="sm"
      >
        {value === undefined && !projectId
          ? <IconRoute />
          : <IconFolder />}
        <span className="min-w-0 flex-1 truncate" title={selectedLabel}>
          {selectedLabel}
        </span>
      </SelectTrigger>
      <SelectContent
        align="start"
        alignItemWithTrigger={false}
        className="w-max max-w-[min(24rem,var(--available-width))] min-w-64"
      >
        <SelectGroup>
          <SelectItem value={AUTOMATIC_VALUE}>
            <IconRoute />
            <span className="min-w-0 flex-1 truncate">
              {inheritedOptionLabel}
            </span>
          </SelectItem>
          <SelectItem value={ROOT_VALUE}>
            <IconFolder />
            <span className="min-w-0 flex-1 truncate">
              {t(projectId ? 'projects.projectRoot' : 'projects.privateRoot')}
            </span>
          </SelectItem>
          {folders.map((folder) => {
            const label = folderPath(folder, foldersById)
            return (
              <SelectItem key={folder.id} value={folder.id}>
                <IconFolder />
                <span className="min-w-0 flex-1 truncate" title={label}>
                  {label}
                </span>
              </SelectItem>
            )
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
