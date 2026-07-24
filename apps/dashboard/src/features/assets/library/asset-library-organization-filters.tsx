/**
 * Global Asset-library location and generation-source filters.
 *
 * The pickers compose existing paginated Project, Flow, and Create-session
 * queries while keeping their selected identities shareable through URL state.
 */

import type { ReactNode } from 'react'
import type { SearchablePickerGroup } from '../../../shared/components/searchable-picker'
import type { AssetLibraryFilters } from './asset-library.types'

import {
  IconFolder,
  IconGitBranch,
  IconLock,
  IconMapPin,
  IconSparkles,
} from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { Spinner } from '@talelabs/ui/components/spinner'
import { useTranslation } from 'react-i18next'

import {
  SearchablePicker,
} from '../../../shared/components/searchable-picker'
import {
  useCreateSessionListQuery,
  useCreateSessionQuery,
} from '../../create/data/create-session.queries'
import { useFlowDetailQuery } from '../../flows/data/flow-detail.queries'
import { useFlowListQuery } from '../../flows/data/flow-list.query'
import { useProjectListQuery, useProjectQuery } from '../../projects/project-queries'

const ALL_LOCATIONS = 'location:all'
const PRIVATE_LOCATION = 'location:private'
const ALL_GENERATORS = 'generator:all'

function itemContent(icon: ReactNode, name: string, type: string) {
  return (
    <>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{name}</span>
        <span className="
          block truncate text-xs font-normal text-muted-foreground
        "
        >
          {type}
        </span>
      </span>
    </>
  )
}

/** Renders global-only organization filters without changing embedded pickers. */
export function AssetLibraryOrganizationFilters({
  filters,
  onFiltersChange,
  onLocationChange,
}: {
  filters: AssetLibraryFilters
  onFiltersChange: (filters: Partial<AssetLibraryFilters>) => void
  onLocationChange: (projectId?: null | string) => void
}) {
  const { t } = useTranslation()
  const projectsQuery = useProjectListQuery({ archive: 'active' })
  const selectedProjectQuery = useProjectQuery(
    typeof filters.projectId === 'string' ? filters.projectId : null,
  )
  const flowsQuery = useFlowListQuery('', undefined)
  const sessionsQuery = useCreateSessionListQuery('', undefined)
  const selectedFlowQuery = useFlowDetailQuery(
    filters.generatedBy?.kind === 'flow'
      ? filters.generatedBy.id
      : null,
  )
  const selectedSessionQuery = useCreateSessionQuery(
    filters.generatedBy?.kind === 'createSession'
      ? filters.generatedBy.id
      : null,
  )

  const projectsById = new Map(
    (projectsQuery.data?.pages.flatMap(page => page.data) ?? [])
      .map(project => [project.id, project]),
  )
  if (selectedProjectQuery.data)
    projectsById.set(selectedProjectQuery.data.id, selectedProjectQuery.data)
  const flowsById = new Map(
    (flowsQuery.data?.pages.flatMap(page => page.data) ?? [])
      .map(flow => [flow.id, flow]),
  )
  if (selectedFlowQuery.data)
    flowsById.set(selectedFlowQuery.data.id, selectedFlowQuery.data)
  const sessionsById = new Map(
    (sessionsQuery.data?.pages.flatMap(page => page.data) ?? [])
      .map(session => [session.id, session]),
  )
  if (selectedSessionQuery.data) {
    sessionsById.set(
      selectedSessionQuery.data.id,
      selectedSessionQuery.data,
    )
  }

  const locationGroups: SearchablePickerGroup[] = [
    {
      id: 'location-scopes',
      items: [
        {
          content: itemContent(
            <IconMapPin className="text-muted-foreground" />,
            t('assets.allLocations'),
            t('navigation.assets'),
          ),
          id: ALL_LOCATIONS,
          searchValue: t('assets.allLocations'),
        },
        {
          content: itemContent(
            <IconLock className="text-muted-foreground" />,
            t('projects.private'),
            t('projects.location'),
          ),
          id: PRIVATE_LOCATION,
          searchValue: t('projects.private'),
        },
      ],
      label: t('projects.location'),
    },
    {
      id: 'projects',
      items: [...projectsById.values()].map(project => ({
        content: itemContent(
          <IconFolder className="text-muted-foreground" />,
          project.name,
          t('projects.project'),
        ),
        id: `project:${project.id}`,
        searchValue: project.name,
      })),
      label: t('navigation.projects'),
      separatorBefore: true,
    },
  ]
  const generatorGroups: SearchablePickerGroup[] = [
    {
      id: 'generator-scopes',
      items: [{
        content: itemContent(
          <IconSparkles className="text-muted-foreground" />,
          t('assets.allGenerators'),
          t('assets.generatedBy'),
        ),
        id: ALL_GENERATORS,
        searchValue: t('assets.allGenerators'),
      }],
      label: t('assets.generatedBy'),
    },
    {
      id: 'flows',
      items: [...flowsById.values()].map(flow => ({
        content: itemContent(
          <IconGitBranch className="text-muted-foreground" />,
          flow.name,
          t('navigation.flows'),
        ),
        id: `flow:${flow.id}`,
        searchValue: flow.name,
      })),
      label: t('navigation.flows'),
      separatorBefore: true,
    },
    {
      id: 'sessions',
      items: [...sessionsById.values()].map(session => ({
        content: itemContent(
          <IconSparkles className="text-muted-foreground" />,
          session.name ?? t('create.sessions.untitled'),
          t('projects.createSessions'),
        ),
        id: `session:${session.id}`,
        searchValue: session.name ?? t('create.sessions.untitled'),
      })),
      label: t('projects.createSessions'),
      separatorBefore: true,
    },
  ]
  const selectedLocationId = filters.projectId === undefined
    ? ALL_LOCATIONS
    : filters.projectId === null
      ? PRIVATE_LOCATION
      : `project:${filters.projectId}`
  const selectedProject = typeof filters.projectId === 'string'
    ? projectsById.get(filters.projectId)
    : null
  const locationLabel = filters.projectId === undefined
    ? t('assets.allLocations')
    : filters.projectId === null
      ? t('projects.private')
      : selectedProject?.name ?? t('projects.project')
  const selectedGeneratorId = filters.generatedBy
    ? `${
      filters.generatedBy.kind === 'createSession' ? 'session' : 'flow'
    }:${filters.generatedBy.id}`
    : ALL_GENERATORS
  const selectedSession = filters.generatedBy?.kind === 'createSession'
    ? sessionsById.get(filters.generatedBy.id)
    : null
  const generatorLabel = filters.generatedBy?.kind === 'flow'
    ? flowsById.get(filters.generatedBy.id)?.name ?? t('navigation.flows')
    : filters.generatedBy?.kind === 'createSession'
      ? selectedSession?.name ?? t('create.sessions.untitled')
      : t('assets.allGenerators')

  return (
    <div className="flex max-w-full gap-2">
      <SearchablePicker
        ariaLabel={t('projects.location')}
        controls={projectsQuery.hasNextPage
          ? (
              <div className="border-b p-2">
                <Button
                  className="w-full"
                  disabled={projectsQuery.isFetchingNextPage}
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => void projectsQuery.fetchNextPage()}
                >
                  {projectsQuery.isFetchingNextPage && (
                    <Spinner data-icon="inline-start" />
                  )}
                  {projectsQuery.isFetchingNextPage
                    ? t('common.loading')
                    : t('projects.loadMore')}
                </Button>
              </div>
            )
          : undefined}
        emptyMessage={t('projects.noResults')}
        groups={locationGroups}
        searchAriaLabel={t('projects.search')}
        searchPlaceholder={t('projects.searchPlaceholder')}
        selectedId={selectedLocationId}
        trigger={<Button size="sm" variant="outline" />}
        triggerContent={(
          <>
            <IconMapPin data-icon="inline-start" />
            <span className="max-w-36 truncate">{locationLabel}</span>
          </>
        )}
        onSelect={(id) => {
          onLocationChange(id === ALL_LOCATIONS
            ? undefined
            : id === PRIVATE_LOCATION
              ? null
              : id.slice('project:'.length))
        }}
      />
      <SearchablePicker
        ariaLabel={t('assets.generatedBy')}
        controls={
          flowsQuery.hasNextPage || sessionsQuery.hasNextPage
            ? (
                <div className="flex gap-1 border-b p-2">
                  {flowsQuery.hasNextPage && (
                    <Button
                      className="flex-1"
                      disabled={flowsQuery.isFetchingNextPage}
                      size="sm"
                      type="button"
                      variant="ghost"
                      onClick={() => void flowsQuery.fetchNextPage()}
                    >
                      {flowsQuery.isFetchingNextPage
                        ? t('common.loading')
                        : t('flows.loadMore')}
                    </Button>
                  )}
                  {sessionsQuery.hasNextPage && (
                    <Button
                      className="flex-1"
                      disabled={sessionsQuery.isFetchingNextPage}
                      size="sm"
                      type="button"
                      variant="ghost"
                      onClick={() => void sessionsQuery.fetchNextPage()}
                    >
                      {sessionsQuery.isFetchingNextPage
                        ? t('common.loading')
                        : t('create.sessions.loadMore')}
                    </Button>
                  )}
                </div>
              )
            : undefined
        }
        emptyMessage={t('assets.noGenerators')}
        groups={generatorGroups}
        searchAriaLabel={t('assets.searchGenerators')}
        searchPlaceholder={t('assets.searchGenerators')}
        selectedId={selectedGeneratorId}
        trigger={<Button size="sm" variant="outline" />}
        triggerContent={(
          <>
            <IconSparkles data-icon="inline-start" />
            <span className="max-w-36 truncate">{generatorLabel}</span>
          </>
        )}
        onSelect={(id) => {
          if (id === ALL_GENERATORS) {
            onFiltersChange({ generatedBy: undefined })
            return
          }
          const [kind, sourceId] = id.split(':')
          if (sourceId) {
            onFiltersChange({
              generatedBy: {
                id: sourceId,
                kind: kind === 'session' ? 'createSession' : 'flow',
              },
            })
          }
        }}
      />
    </div>
  )
}
