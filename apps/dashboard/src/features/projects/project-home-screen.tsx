/**
 * Compact Project orientation surface over bounded Home data.
 *
 * It reuses the canonical Asset media presentation and global Asset viewer;
 * feature work continues through the ordinary Project-scoped routes.
 */

import type { ProjectFolderTreeItem } from '@talelabs/sdk'

import {
  IconArchive,
  IconEdit,
  IconFileDescription,
  IconGitBranch,
  IconSparkles,
  IconUpload,
} from '@tabler/icons-react'
import {
  Button,
  buttonVariants,
} from '@talelabs/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@talelabs/ui/components/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@talelabs/ui/components/empty'
import { Skeleton } from '@talelabs/ui/components/skeleton'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { getResolvedLocale } from '../../i18n/i18n'
import {
  MediaLibraryGrid,
} from '../../shared/components/media-library-card'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { useAssetLibraryUpload } from '../assets/library/use-asset-library-upload'
import { AssetMediaCard } from '../assets/media/asset-media-card'
import { ACCEPTED_ASSET_MEDIA } from '../assets/upload/asset-upload-files'
import { useAssetViewerUrlState } from '../assets/viewer/use-asset-viewer-url-state'
import { CreateFlowDialog } from '../flows/browse/create-flow-dialog'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { ProjectBriefContent } from './brief/project-brief-content'
import { EditProjectDialog } from './edit-project-dialog'
import { ProjectHomeEmptyState } from './project-home-empty-state'
import { useProjectMutations } from './project-mutations'
import { useProjectHomeQuery } from './project-queries'
import { ProjectRecentWorkRow } from './project-recent-work-row'
import { useProjectFolderTreeQuery } from './sidebar/project-folder-tree-query'

const EMPTY_FOLDERS: ProjectFolderTreeItem[] = []

/** Renders the bounded Project Home without duplicating feature surfaces. */
export function ProjectHomeScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const organizationId = useActiveOrganizationId()
  const viewer = useAssetViewerUrlState()
  const query = useProjectHomeQuery(projectId ?? null)
  const defaultUploadFolderId
    = query.data?.project.defaultAssetFolderId ?? null
  const foldersQuery = useProjectFolderTreeQuery(
    Boolean(projectId && defaultUploadFolderId),
    projectId ?? '',
  )
  const mutations = useProjectMutations(organizationId)
  const [editOpen, setEditOpen] = useState(false)
  const [flowOpen, setFlowOpen] = useState(false)
  const home = query.data
  const folders = foldersQuery.data?.data ?? EMPTY_FOLDERS
  const uploadDestinationReady = Boolean(home) && (
    defaultUploadFolderId === null
    || (
      foldersQuery.isSuccess
      && folders.some(folder => folder.id === defaultUploadFolderId)
    )
  )
  const uploadFolderId = uploadDestinationReady
    ? defaultUploadFolderId
    : null
  const upload = useAssetLibraryUpload({
    folderId: uploadFolderId,
    folders,
    projectId: projectId ?? null,
  })

  if (query.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 pb-12">
        <div className="flex items-start gap-4">
          <Skeleton className="size-14 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="
          grid border-y
          lg:grid-cols-[minmax(0,1.08fr)_minmax(21rem,0.92fr)]
        "
        >
          <div className="
            space-y-7 py-10
            lg:pr-12
          "
          >
            <div className="space-y-3">
              <Skeleton className="h-8 w-80 max-w-full" />
              <Skeleton className="h-4 w-full max-w-lg" />
            </div>
            <Skeleton className="h-9 w-28" />
          </div>
          <div className="
            divide-y border-t
            lg:border-t-0 lg:border-l
          "
          >
            {Array.from({ length: 3 }, (_, index) => (
              <div className="flex min-h-24 gap-4 px-6 py-5" key={index}>
                <Skeleton className="size-5 shrink-0 rounded-sm" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-full max-w-xs" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
  if (query.isError || !home || !projectId) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t('projects.couldNotLoad')}</EmptyTitle>
          <EmptyDescription>
            {t('projects.couldNotLoadDescription')}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t('common.retry')}
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  const empty = home.recentAssets.length === 0
    && home.recentWork.length === 0
    && home.brief.empty
  const updatedAt = new Intl.DateTimeFormat(getResolvedLocale(), {
    dateStyle: 'medium',
  }).format(new Date(home.project.updatedAt))

  async function archiveProject() {
    try {
      await mutations.archive.mutateAsync(projectId!)
      toast.success(t('projects.archived'))
      navigate('/projects', { replace: true })
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'projects.actionFailed'))
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 pb-12">
      <header className="
        flex min-w-0 flex-col gap-5
        sm:flex-row sm:items-start
      "
      >
        {home.project.coverAsset?.thumbnailUrl
          ? (
              <img
                alt=""
                className="size-14 shrink-0 rounded-lg object-cover"
                src={home.project.coverAsset.thumbnailUrl}
              />
            )
          : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {home.project.name}
          </h1>
          {home.project.description
            ? (
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  {home.project.description}
                </p>
              )
            : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {t('projects.updated', { date: updatedAt })}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {empty
            ? null
            : (
                <>
                  <Link
                    className={buttonVariants({ size: 'sm' })}
                    to={`/projects/${projectId}/create`}
                  >
                    <IconSparkles data-icon="inline-start" />
                    {t('navigation.create')}
                  </Link>
                  <Button
                    disabled={!uploadDestinationReady}
                    size="sm"
                    variant="outline"
                    onClick={upload.openFilePicker}
                  >
                    <IconUpload data-icon="inline-start" />
                    {t('assets.upload')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFlowOpen(true)}
                  >
                    <IconGitBranch data-icon="inline-start" />
                    {t('flows.create')}
                  </Button>
                </>
              )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button size="sm" variant="outline" />}
            >
              {t('common.actions')}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <IconEdit />
                {t('projects.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void archiveProject()}>
                <IconArchive />
                {t('projects.archive')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {empty
        ? (
            <ProjectHomeEmptyState
              projectId={projectId}
              uploadDisabled={!uploadDestinationReady}
              onCreateFlow={() => setFlowOpen(true)}
              onUpload={upload.openFilePicker}
            />
          )
        : (
            <>
              <section aria-labelledby="project-brief-heading">
                <div className="mb-3 flex items-center gap-3">
                  <h2
                    className="text-base font-semibold"
                    id="project-brief-heading"
                  >
                    {t('projects.brief')}
                  </h2>
                  <Link
                    className={buttonVariants({
                      className: 'ml-auto',
                      size: 'sm',
                      variant: 'ghost',
                    })}
                    to={`/projects/${projectId}/brief`}
                  >
                    <IconFileDescription data-icon="inline-start" />
                    {home.brief.empty
                      ? t('projects.briefStart')
                      : t('common.open')}
                  </Link>
                </div>
                {home.brief.empty
                  ? (
                      <p className="border-t py-5 text-sm text-muted-foreground">
                        {t('projects.briefEmpty')}
                      </p>
                    )
                  : (
                      <ProjectBriefContent
                        className="
                          max-h-48 overflow-hidden border-t
                          mask-[linear-gradient(to_bottom,black_75%,transparent)]
                          pt-4
                        "
                        document={home.brief.document}
                        projectId={projectId}
                      />
                    )}
              </section>

              {home.recentAssets.length > 0 && (
                <section aria-labelledby="recent-assets-heading">
                  <div className="mb-4 flex items-center gap-3">
                    <h2
                      className="text-base font-semibold"
                      id="recent-assets-heading"
                    >
                      {t('projects.recentAssets')}
                    </h2>
                    <Link
                      className={buttonVariants({
                        className: 'ml-auto',
                        size: 'sm',
                        variant: 'ghost',
                      })}
                      to={`/projects/${projectId}/assets`}
                    >
                      {t('projects.viewAll')}
                    </Link>
                  </div>
                  <MediaLibraryGrid>
                    {home.recentAssets.map(asset => (
                      <AssetMediaCard
                        asset={asset}
                        key={asset.id}
                        previewAriaLabel={t('assets.openAsset', {
                          name: asset.name,
                        })}
                        onClick={() => viewer.openAsset(asset.id)}
                      />
                    ))}
                  </MediaLibraryGrid>
                </section>
              )}

              {home.recentWork.length > 0 && (
                <section aria-labelledby="recent-work-heading">
                  <h2
                    className="mb-3 text-base font-semibold"
                    id="recent-work-heading"
                  >
                    {t('projects.recentWork')}
                  </h2>
                  <div className="
                    grid gap-1 border-t pt-2
                    sm:grid-cols-2
                  "
                  >
                    {home.recentWork.map(work => (
                      <ProjectRecentWorkRow
                        key={`${work.type}:${work.id}`}
                        projectId={projectId}
                        work={work}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
      <EditProjectDialog
        open={editOpen}
        project={home.project}
        onOpenChange={setEditOpen}
      />
      <CreateFlowDialog
        open={flowOpen}
        projectId={projectId}
        onOpenChange={setFlowOpen}
      />
      <input
        ref={upload.fileInputRef}
        accept={ACCEPTED_ASSET_MEDIA}
        aria-label={t('assets.chooseFiles')}
        className="sr-only"
        multiple
        type="file"
        onChange={(event) => {
          if (event.target.files)
            void upload.uploadFiles(event.target.files)
          event.target.value = ''
        }}
      />
    </div>
  )
}
