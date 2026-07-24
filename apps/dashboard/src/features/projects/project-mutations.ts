/** Project CRUD, lifecycle, and Brief CAS mutations with scoped invalidation. */

import type {
  ProjectBrief,
  ProjectMentionResolution,
  SaveProjectBriefRequest,
  UpdateProjectRequest,
} from '@talelabs/sdk'

import {
  patchProjectsProjectid,
  patchProjectsProjectidBrief,
  postProjects,
  postProjectsProjectidArchive,
  postProjectsProjectidRestore,
} from '@talelabs/sdk'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import { projectQueryKeys } from './project-query-keys'

function mentionPresentationMatches(
  current: ProjectMentionResolution,
  next: ProjectMentionResolution,
) {
  const assetMatches = (current.asset === null && next.asset === null)
    || (
      current.asset !== null
      && next.asset !== null
      && current.asset.height === next.asset.height
      && current.asset.type === next.asset.type
      && current.asset.width === next.asset.width
    )
  return assetMatches
    && current.available === next.available
    && current.entityId === next.entityId
    && current.entityType === next.entityType
    && current.label === next.label
}

function retainBriefMentionPresentation(
  current: ProjectBrief | undefined,
  next: ProjectBrief,
) {
  if (!current)
    return next
  const currentByKey = new Map(current.mentions.map(mention => [
    `${mention.entityType}:${mention.entityId}`,
    mention,
  ]))
  const mentions = next.mentions.map((mention) => {
    const previous = currentByKey.get(
      `${mention.entityType}:${mention.entityId}`,
    )
    return previous && mentionPresentationMatches(previous, mention)
      ? previous
      : mention
  })
  const unchanged = mentions.length === current.mentions.length
    && mentions.every((mention, index) => mention === current.mentions[index])
  return {
    ...next,
    mentions: unchanged ? current.mentions : mentions,
  }
}

/** Creates and updates Projects while reconciling list/detail/Home caches. */
export function useProjectMutations(organizationId: null | string) {
  const queryClient = useQueryClient()
  const headers = () => getOrganizationRequestHeaders(organizationId!)
  const publish = (project: Awaited<ReturnType<typeof postProjects>>) => {
    queryClient.setQueryData(
      projectQueryKeys.detail(organizationId, project.id),
      project,
    )
    void queryClient.invalidateQueries({
      queryKey: projectQueryKeys.scope(organizationId),
    })
  }
  return {
    create: useMutation({
      mutationFn: (input: { description?: string, name: string }) =>
        postProjects({ data: input }, { headers: headers() }),
      onSuccess: publish,
    }),
    update: useMutation({
      mutationFn: (input: {
        data: UpdateProjectRequest
        projectId: string
      }) => patchProjectsProjectid(
        { data: input.data, projectId: input.projectId },
        { headers: headers() },
      ),
      onSuccess: publish,
    }),
    archive: useMutation({
      mutationFn: (projectId: string) => postProjectsProjectidArchive(
        { projectId },
        { headers: headers() },
      ),
      onSuccess: publish,
    }),
    restore: useMutation({
      mutationFn: (projectId: string) => postProjectsProjectidRestore(
        { projectId },
        { headers: headers() },
      ),
      onSuccess: publish,
    }),
  }
}

/** Saves one Project Brief with compare-and-set revision semantics. */
export function useSaveProjectBriefMutation(input: {
  organizationId: null | string
  projectId: string
}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SaveProjectBriefRequest) =>
      patchProjectsProjectidBrief(
        { data, projectId: input.projectId },
        { headers: getOrganizationRequestHeaders(input.organizationId!) },
      ),
    onSuccess: (brief) => {
      queryClient.setQueryData<ProjectBrief>(
        projectQueryKeys.brief(input.organizationId, input.projectId),
        current => retainBriefMentionPresentation(current, brief),
      )
      void queryClient.invalidateQueries({
        queryKey: projectQueryKeys.home(
          input.organizationId,
          input.projectId,
        ),
      })
    },
  })
}
