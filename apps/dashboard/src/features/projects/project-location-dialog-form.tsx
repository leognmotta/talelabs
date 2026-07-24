/**
 * Interactive Project and optional Asset-folder location selection form.
 *
 * The owning dialog controls visibility while this component owns bounded
 * search, inline Project creation, destination validation, and confirmation.
 */

import type { Folder, Project } from '@talelabs/sdk'

import {
  IconFolder,
  IconLock,
  IconPlus,
  IconSearch,
} from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { DialogFooter } from '@talelabs/ui/components/dialog'
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
import { Spinner } from '@talelabs/ui/components/spinner'
import { cn } from '@talelabs/ui/lib/utils'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useFoldersQuery } from '../assets/data/folder-query'
import { CreateProjectDialog } from './create-project-dialog'
import { useProjectListQuery, useProjectQuery } from './project-queries'

const ROOT_VALUE = '__root__'

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

/** Renders the stateful form inside a Project location dialog. */
export function ProjectLocationDialogForm({
  currentFolderId,
  currentProjectId,
  includeFolder,
  pending,
  projectLocked,
  validateDestination,
  onConfirm,
}: {
  /** Currently selected folder, or Project/Private root when null. */
  currentFolderId?: null | string
  /** Currently selected Project, or Private when null. */
  currentProjectId: null | string
  /** Whether the selected location includes a folder position. */
  includeFolder: boolean
  /** Whether the owning location mutation is pending. */
  pending: boolean
  /** Whether Project identity is fixed by the current route context. */
  projectLocked: boolean
  /** Optionally validates a candidate destination before confirmation. */
  validateDestination?: (
    projectId: null | string,
    folderId: null | string,
    folders: Folder[],
  ) => boolean
  /** Persists the selected Project, folder, and presentation label. */
  onConfirm: (
    projectId: null | string,
    folderId: null | string,
    destinationLabel: string,
  ) => Promise<void>
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [selectedProjectId, setSelectedProjectId]
    = useState<null | string>(currentProjectId)
  const [selectedFolderId, setSelectedFolderId]
    = useState<null | string>(currentFolderId ?? null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createdProject, setCreatedProject] = useState<Project | null>(null)
  const deferredSearch = useDeferredValue(search.trim())
  const projectsQuery = useProjectListQuery({
    archive: 'active',
    enabled: !projectLocked,
    search: deferredSearch,
  })
  const currentProjectQuery = useProjectQuery(currentProjectId)
  const foldersQuery = useFoldersQuery(includeFolder, selectedProjectId)
  const projects = useMemo(() => {
    const byId = new Map<string, Project>()
    for (const project of projectsQuery.data?.pages.flatMap(page => page.data)
      ?? []) {
      byId.set(project.id, project)
    }
    if (currentProjectQuery.data)
      byId.set(currentProjectQuery.data.id, currentProjectQuery.data)
    if (createdProject)
      byId.set(createdProject.id, createdProject)
    return [...byId.values()]
  }, [
    createdProject,
    currentProjectQuery.data,
    projectsQuery.data?.pages,
  ])
  const folders = useMemo(
    () => foldersQuery.data?.data ?? [],
    [foldersQuery.data?.data],
  )
  const foldersById = useMemo(
    () => new Map(folders.map(folder => [folder.id, folder])),
    [folders],
  )
  const selectedProject = projects.find(
    project => project.id === selectedProjectId,
  )
  const selectedFolder = selectedFolderId
    ? foldersById.get(selectedFolderId)
    : null
  const rootLabel = t(selectedProjectId
    ? 'projects.projectRoot'
    : 'projects.privateRoot')
  const destinationLabel = selectedFolder
    ? `${selectedProject?.name ?? t('projects.project')} / ${
      folderPath(selectedFolder, foldersById)
    }`
    : selectedProject?.name ?? rootLabel
  const valid = validateDestination?.(
    selectedProjectId,
    selectedFolderId,
    folders,
  ) ?? true

  function selectProject(projectId: null | string) {
    setSelectedProjectId(projectId)
    setSelectedFolderId(null)
  }

  return (
    <>
      <div className="flex min-h-0 flex-col gap-5">
        {!projectLocked && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">
                {t('projects.project')}
              </span>
              <Button
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(true)}
              >
                <IconPlus data-icon="inline-start" />
                {t('projects.create')}
              </Button>
            </div>
            <InputGroup>
              <InputGroupAddon><IconSearch /></InputGroupAddon>
              <InputGroupInput
                aria-label={t('projects.search')}
                placeholder={t('projects.searchPlaceholder')}
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </InputGroup>
            <div className="
              h-52 overflow-y-auto overscroll-contain rounded-lg border
            "
            >
              <div
                aria-label={t('projects.chooseLocation')}
                className="flex flex-col gap-1 p-1.5"
                role="radiogroup"
              >
                {!deferredSearch && (
                  <button
                    aria-checked={selectedProjectId === null}
                    className={cn(
                      `
                        flex min-h-10 items-center gap-3 rounded-md px-3
                        text-left text-sm transition outline-none
                        hover:bg-muted
                        focus-visible:ring-2 focus-visible:ring-ring
                      `,
                      selectedProjectId === null && 'bg-muted font-medium',
                    )}
                    role="radio"
                    type="button"
                    onClick={() => selectProject(null)}
                  >
                    <IconLock className="size-4 text-muted-foreground" />
                    <span className="truncate">
                      {t('projects.private')}
                    </span>
                  </button>
                )}
                {projects.map(project => (
                  <button
                    aria-checked={selectedProjectId === project.id}
                    className={cn(
                      `
                        flex min-h-10 items-center gap-3 rounded-md px-3
                        text-left text-sm transition outline-none
                        hover:bg-muted
                        focus-visible:ring-2 focus-visible:ring-ring
                      `,
                      selectedProjectId === project.id
                      && 'bg-muted font-medium',
                    )}
                    key={project.id}
                    role="radio"
                    type="button"
                    onClick={() => selectProject(project.id)}
                  >
                    <IconFolder className="size-4 text-muted-foreground" />
                    <span className="truncate">{project.name}</span>
                  </button>
                ))}
                {projectsQuery.isPending && (
                  <div className="flex h-20 items-center justify-center">
                    <Spinner className="size-5" />
                  </div>
                )}
                {projectsQuery.isError && (
                  <div className="
                    flex min-h-20 flex-col items-center justify-center gap-2
                    px-3 text-center text-sm text-muted-foreground
                  "
                  >
                    <span>{t('projects.couldNotLoad')}</span>
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => void projectsQuery.refetch()}
                    >
                      {t('common.retry')}
                    </Button>
                  </div>
                )}
                {!projectsQuery.isPending
                  && !projectsQuery.isError
                  && projects.length === 0
                  && deferredSearch && (
                  <p className="
                    flex min-h-20 items-center justify-center px-3 text-center
                    text-sm text-muted-foreground
                  "
                  >
                    {t('projects.noResults')}
                  </p>
                )}
                {projectsQuery.hasNextPage && (
                  <Button
                    className="mt-1"
                    disabled={projectsQuery.isFetchingNextPage}
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={() => void projectsQuery.fetchNextPage()}
                  >
                    {projectsQuery.isFetchingNextPage
                      ? t('common.loading')
                      : t('projects.loadMore')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
        {includeFolder && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">
              {t('projects.outputFolder')}
            </span>
            <Select
              disabled={foldersQuery.isPending}
              value={selectedFolderId ?? ROOT_VALUE}
              onValueChange={(value) => {
                setSelectedFolderId(value === ROOT_VALUE ? null : value)
              }}
            >
              <SelectTrigger
                aria-label={t('projects.outputFolder')}
                className="w-full"
              >
                <IconFolder />
                <span className="truncate">
                  {selectedFolder
                    ? folderPath(selectedFolder, foldersById)
                    : rootLabel}
                </span>
              </SelectTrigger>
              <SelectContent align="start">
                <SelectGroup>
                  <SelectItem value={ROOT_VALUE}>
                    <IconFolder />
                    {rootLabel}
                  </SelectItem>
                  {folders.map(folder => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <IconFolder />
                      {folderPath(folder, foldersById)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button
          disabled={pending || foldersQuery.isPending || !valid}
          type="button"
          onClick={() => void onConfirm(
            selectedProjectId,
            includeFolder ? selectedFolderId : null,
            destinationLabel,
          )}
        >
          {pending ? t('common.saving') : t('projects.saveLocation')}
        </Button>
      </DialogFooter>
      {!projectLocked && (
        <CreateProjectDialog
          open={createOpen}
          onCreated={(project) => {
            setCreatedProject(project)
            selectProject(project.id)
          }}
          onOpenChange={setCreateOpen}
        />
      )}
    </>
  )
}
