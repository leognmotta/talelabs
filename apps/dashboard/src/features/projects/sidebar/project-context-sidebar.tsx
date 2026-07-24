/**
 * Project-context navigation, folder tree, and folder-creation ownership.
 *
 * The global App sidebar selects this explicit variant when a Project route is
 * active; Project queries and mutations do not leak into the global shell.
 */

import {
  IconArrowLeft,
  IconFileDescription,
  IconFolder,
  IconGitBranch,
  IconHome,
  IconPlus,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconSparkles,
  IconX,
} from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { Input } from '@talelabs/ui/components/input'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@talelabs/ui/components/sidebar'
import { Skeleton } from '@talelabs/ui/components/skeleton'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { ElementIcon } from '../../../shared/domain-icons'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { useFolderMutations } from '../../assets/data/folder-mutations'
import { useActiveOrganizationId } from '../../organizations/organization-scope-context'
import { ProjectFolderTree } from '../project-folder-tree'
import { useProjectQuery } from '../project-queries'
import { ProjectFolderDialog } from './project-folder-dialog'
import { useProjectFolderTreeQuery } from './project-folder-tree-query'

/** Renders all Project-only sidebar navigation and Asset-folder behavior. */
export function ProjectContextSidebar({
  projectId,
}: {
  /** Active Project route identity. */
  projectId: string
}) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const organizationId = useActiveOrganizationId()
  const projectQuery = useProjectQuery(projectId)
  const folderMutations = useFolderMutations()
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [createFolderParentId, setCreateFolderParentId]
    = useState<null | string>(null)
  const [folderSearchOpen, setFolderSearchOpen] = useState(false)
  const [folderSearch, setFolderSearch] = useState('')
  const [folderSort, setFolderSort] = useState<'asc' | 'desc'>('asc')
  const project = projectQuery.data
  const foldersQuery = useProjectFolderTreeQuery(
    project?.archivedAt === null,
    projectId,
  )
  const folders = foldersQuery.data?.data ?? []
  const projectBase = `/projects/${projectId}`
  const assetsPath = `${projectBase}/assets`
  const selectedFolderValue = location.pathname === assetsPath
    ? new URLSearchParams(location.search).get('folder')
    : undefined
  const selectedFolderId = selectedFolderValue === 'root'
    ? null
    : selectedFolderValue ?? undefined
  const projectNavItems = project
    ? [
        {
          count: null,
          icon: <IconHome />,
          label: t('projects.home'),
          path: projectBase,
        },
        {
          count: project.counts.assets,
          icon: <IconFolder />,
          label: t('projects.allAssets'),
          path: assetsPath,
        },
        {
          count: project.counts.createSessions,
          icon: <IconSparkles />,
          label: t('projects.createSessions'),
          path: `${projectBase}/create`,
        },
        {
          count: project.counts.flows,
          icon: <IconGitBranch />,
          label: t('navigation.flows'),
          path: `${projectBase}/flows`,
        },
        {
          count: project.counts.elements,
          icon: <ElementIcon />,
          label: t('navigation.elements'),
          path: `${projectBase}/elements`,
        },
        {
          count: null,
          icon: <IconFileDescription />,
          label: t('projects.brief'),
          path: `${projectBase}/brief`,
        },
      ]
    : []

  async function createFolder(name: string) {
    if (!organizationId)
      return
    try {
      await folderMutations.create.mutateAsync({
        name,
        organizationId,
        parentId: createFolderParentId,
        projectId,
      })
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'assets.actionFailed'))
      return
    }
    setCreateFolderOpen(false)
    setCreateFolderParentId(null)
    toast.success(t('assets.folderCreated'))
  }

  function openCreateFolder(parentId: null | string) {
    setCreateFolderParentId(parentId)
    setCreateFolderOpen(true)
  }

  const backNavigation = (
    <SidebarGroup className="shrink-0 pt-0">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip={t('navigation.projects')}
            render={<Link to="/projects" />}
          >
            <IconArrowLeft />
            <span>{t('navigation.projects')}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )

  if (project?.archivedAt) {
    return (
      <>
        {backNavigation}
        <SidebarGroup className="shrink-0">
          <SidebarGroupLabel>{t('projects.archivedTab')}</SidebarGroupLabel>
        </SidebarGroup>
      </>
    )
  }

  return (
    <>
      {backNavigation}
      <SidebarGroup className="shrink-0">
        <SidebarMenu>
          {projectNavItems.map((item) => {
            const active = item.path === projectBase
              ? location.pathname === projectBase
              : location.pathname.startsWith(item.path)
            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  isActive={active}
                  render={<Link to={item.path} />}
                  tooltip={item.label}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </SidebarMenuButton>
                {item.count !== null && (
                  <SidebarMenuBadge>{item.count}</SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroup>
      <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />
      <div className="
        flex min-h-0 flex-1 flex-col
        group-data-[collapsible=icon]:hidden
      "
      >
        <div className="flex h-9 shrink-0 items-center gap-1 px-3">
          <SidebarGroupLabel className="min-w-0 flex-1 px-0">
            {t('projects.folders')}
          </SidebarGroupLabel>
          <Button
            aria-label={folderSearchOpen
              ? t('common.close')
              : t('projects.searchFolders')}
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              setFolderSearchOpen(open => !open)
              if (folderSearchOpen)
                setFolderSearch('')
            }}
          >
            {folderSearchOpen ? <IconX /> : <IconSearch />}
          </Button>
          <Button
            aria-label={t('projects.sortFolders')}
            size="icon-sm"
            variant="ghost"
            onClick={() => setFolderSort(current =>
              current === 'asc' ? 'desc' : 'asc')}
          >
            {folderSort === 'asc'
              ? <IconSortAscending />
              : <IconSortDescending />}
          </Button>
          <Button
            aria-label={t('assets.newFolder')}
            disabled={!project}
            size="icon-sm"
            variant="ghost"
            onClick={() => openCreateFolder(null)}
          >
            <IconPlus />
          </Button>
        </div>
        {folderSearchOpen && (
          <div className="shrink-0 px-3 pb-2">
            <Input
              autoFocus
              aria-label={t('projects.searchFolders')}
              className="h-8"
              placeholder={t('projects.searchFolders')}
              value={folderSearch}
              onChange={event => setFolderSearch(event.target.value)}
            />
          </div>
        )}
        {foldersQuery.isPending
          ? (
              <div className="flex flex-col gap-2 px-3">
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
              </div>
            )
          : (
              <ProjectFolderTree
                folders={folders}
                search={folderSearch}
                selectedFolderId={selectedFolderId}
                sort={folderSort}
                onCreateFolder={openCreateFolder}
                onOpenFolder={(folderId) => {
                  navigate({
                    pathname: assetsPath,
                    search: `?${new URLSearchParams({
                      folder: folderId ?? 'root',
                    })}`,
                  })
                }}
              />
            )}
      </div>
      <ProjectFolderDialog
        open={createFolderOpen}
        pending={folderMutations.create.isPending}
        onOpenChange={(open) => {
          setCreateFolderOpen(open)
          if (!open)
            setCreateFolderParentId(null)
        }}
        onSubmit={createFolder}
      />
    </>
  )
}
