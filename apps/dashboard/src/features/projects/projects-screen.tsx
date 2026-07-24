/** Searchable cursor-paginated Project library and lifecycle controls. */

import type { Project } from '@talelabs/sdk'

import {
  IconFolder,
  IconPlus,
  IconSearch,
} from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@talelabs/ui/components/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@talelabs/ui/components/input-group'
import { Tabs, TabsList, TabsTrigger } from '@talelabs/ui/components/tabs'
import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import {
  MediaLibraryGrid,
  MediaLibrarySkeleton,
} from '../../shared/components/media-library-card'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { CreateProjectDialog } from './create-project-dialog'
import { ProjectCard } from './project-card'
import { useProjectMutations } from './project-mutations'
import { useProjectListQuery } from './project-queries'

/** Renders active and archived Project collections without eager entity lists. */
export function ProjectsScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const organizationId = useActiveOrganizationId()
  const mutations = useProjectMutations(organizationId)
  const [archive, setArchive] = useState<'active' | 'archived'>('active')
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim())
  const query = useProjectListQuery({
    archive,
    search: deferredSearch || undefined,
  })
  const projects = query.data?.pages.flatMap(page => page.data) ?? []

  async function changeLifecycle(project: Project) {
    try {
      if (project.archivedAt)
        await mutations.restore.mutateAsync(project.id)
      else
        await mutations.archive.mutateAsync(project.id)
      toast.success(t(project.archivedAt
        ? 'projects.restored'
        : 'projects.archived'))
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'projects.actionFailed'))
    }
  }

  return (
    <section className="flex min-h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {t('navigation.projects')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('projects.descriptionText')}
          </p>
        </div>
        <Button className="ml-auto" onClick={() => setCreateOpen(true)}>
          <IconPlus data-icon="inline-start" />
          {t('projects.create')}
        </Button>
      </header>
      <div className="flex flex-wrap items-center gap-3 pb-5">
        <InputGroup className="
          w-full bg-muted/50
          sm:w-80
        "
        >
          <InputGroupAddon><IconSearch /></InputGroupAddon>
          <InputGroupInput
            aria-label={t('projects.search')}
            placeholder={t('projects.searchPlaceholder')}
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </InputGroup>
        <Tabs
          value={archive}
          onValueChange={value =>
            setArchive(value as 'active' | 'archived')}
        >
          <TabsList>
            <TabsTrigger value="active">{t('projects.active')}</TabsTrigger>
            <TabsTrigger value="archived">
              {t('projects.archivedTab')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {query.isPending
        ? <MediaLibrarySkeleton />
        : query.isError
          ? (
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
          : projects.length === 0
            ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><IconFolder /></EmptyMedia>
                    <EmptyTitle>
                      {deferredSearch
                        ? t('projects.noResults')
                        : t('projects.emptyTitle')}
                    </EmptyTitle>
                    <EmptyDescription>
                      {deferredSearch
                        ? t('projects.noResultsDescription')
                        : t('projects.emptyDescription')}
                    </EmptyDescription>
                  </EmptyHeader>
                  {!deferredSearch && archive === 'active' && (
                    <EmptyContent>
                      <Button onClick={() => setCreateOpen(true)}>
                        <IconPlus data-icon="inline-start" />
                        {t('projects.create')}
                      </Button>
                    </EmptyContent>
                  )}
                </Empty>
              )
            : (
                <>
                  <MediaLibraryGrid className="py-5">
                    {projects.map(project => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onLifecycle={item => void changeLifecycle(item)}
                      />
                    ))}
                  </MediaLibraryGrid>
                  {query.hasNextPage && (
                    <div className="flex justify-center pt-6">
                      <Button
                        disabled={query.isFetchingNextPage}
                        variant="outline"
                        onClick={() => void query.fetchNextPage()}
                      >
                        {query.isFetchingNextPage
                          ? t('common.loading')
                          : t('projects.loadMore')}
                      </Button>
                    </div>
                  )}
                </>
              )}
      <CreateProjectDialog
        open={createOpen}
        onCreated={project => navigate(`/projects/${project.id}`)}
        onOpenChange={setCreateOpen}
      />
    </section>
  )
}
