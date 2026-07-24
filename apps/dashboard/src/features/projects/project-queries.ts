/** TanStack Query composition for Project lists, Home, and Brief reads. */

import type {
  GetProjectsQueryParams,
  ProjectListResponse,
} from '@talelabs/sdk'

import {
  getProjects,
  getProjectsProjectid,
  getProjectsProjectidBrief,
  getProjectsProjectidBriefMentions,
  getProjectsProjectidHome,
} from '@talelabs/sdk'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { projectQueryKeys } from './project-query-keys'

const PROJECT_PAGE_SIZE = 24

/** Loads a searched cursor-paginated active or archived Project collection. */
export function useProjectListQuery(input: {
  archive?: 'active' | 'all' | 'archived'
  enabled?: boolean
  search?: string
}) {
  const organizationId = useActiveOrganizationId()
  const params: GetProjectsQueryParams = {
    archive: input.archive ?? 'active',
    limit: PROJECT_PAGE_SIZE,
    search: input.search || undefined,
  }
  return useInfiniteQuery({
    enabled: input.enabled !== false && Boolean(organizationId),
    getNextPageParam: (page: ProjectListResponse) =>
      page.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getProjects(
      { params: { ...params, cursor: pageParam } },
      {
        headers: getOrganizationRequestHeaders(organizationId!),
        signal,
      },
    ),
    queryKey: projectQueryKeys.list(organizationId, params),
  })
}

/** Loads one tenant-owned Project identity and grouped sidebar counts. */
export function useProjectQuery(projectId: null | string) {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    enabled: Boolean(organizationId && projectId),
    queryFn: ({ signal }) => getProjectsProjectid(
      { projectId: projectId! },
      {
        headers: getOrganizationRequestHeaders(organizationId!),
        signal,
      },
    ),
    queryKey: projectQueryKeys.detail(organizationId, projectId),
    staleTime: 30_000,
  })
}

/** Loads the compact bounded Project Home payload. */
export function useProjectHomeQuery(projectId: null | string) {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    enabled: Boolean(organizationId && projectId),
    queryFn: ({ signal }) => getProjectsProjectidHome(
      { projectId: projectId! },
      {
        headers: getOrganizationRequestHeaders(organizationId!),
        signal,
      },
    ),
    queryKey: projectQueryKeys.home(organizationId, projectId),
  })
}

/** Loads the authoritative Tiptap Project Brief and resolved mentions. */
export function useProjectBriefQuery(projectId: null | string) {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    enabled: Boolean(organizationId && projectId),
    queryFn: ({ signal }) => getProjectsProjectidBrief(
      { projectId: projectId! },
      {
        headers: getOrganizationRequestHeaders(organizationId!),
        signal,
      },
    ),
    queryKey: projectQueryKeys.brief(organizationId, projectId),
  })
}

/** Builds one cacheable bounded Project mention-search request. */
export function projectMentionSearchQueryOptions(input: {
  organizationId: string
  projectId: string
  search: string
}) {
  return {
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      getProjectsProjectidBriefMentions(
        {
          projectId: input.projectId,
          params: { limit: 8, search: input.search },
        },
        {
          headers: getOrganizationRequestHeaders(input.organizationId),
          signal,
        },
      ),
    queryKey: projectQueryKeys.mentions(
      input.organizationId,
      input.projectId,
      input.search,
    ),
    staleTime: 15_000,
  }
}

/** Searches Project-scoped mention candidates in five bounded groups. */
export function useProjectMentionSearchQuery(input: {
  enabled: boolean
  projectId: null | string
  search: string
}) {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    ...projectMentionSearchQueryOptions({
      organizationId: organizationId!,
      projectId: input.projectId!,
      search: input.search,
    }),
    enabled: input.enabled && Boolean(organizationId && input.projectId),
  })
}
