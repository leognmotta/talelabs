import { IconFolder } from '@tabler/icons-react'
import { listProjects, listProjectsQueryKey } from '@talelabs/sdk'
import { Outlet, useLocation } from 'react-router'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { ContextResourceList } from '../context/context-resource-list'
import { ContextWorkspace } from '../context/context-workspace'
import { useContextInfiniteList } from '../context/use-context-infinite-list'
import { useContextListSearch } from '../context/use-context-list-search'

export function ProjectsLayout() {
  const location = useLocation()
  const { deferredSearch, search, setSearch } = useContextListSearch()
  const params = { limit: 50, search: deferredSearch }
  const projectsQuery = useContextInfiniteList({
    queryKey: listProjectsQueryKey(params),
    loadPage: cursor => listProjects({ params: { ...params, cursor } }),
  })
  const errorMessage = projectsQuery.error
    ? getApiErrorMessage(projectsQuery.error, 'Could not load projects.')
    : null

  return (
    <ContextWorkspace
      isDetailOpen={location.pathname !== '/projects'}
      sidebar={(
        <ContextResourceList
          basePath="/projects"
          createLabel="New project"
          error={errorMessage}
          icon={IconFolder}
          hasNextPage={projectsQuery.hasNextPage}
          isFetchingNextPage={projectsQuery.isFetchingNextPage}
          items={projectsQuery.items}
          loading={projectsQuery.isPending}
          onLoadMore={() => void projectsQuery.fetchNextPage()}
          onRetry={() => void projectsQuery.refetch()}
          onSearch={setSearch}
          resourceName="Projects"
          search={search}
        />
      )}
      detail={<Outlet />}
    />
  )
}
