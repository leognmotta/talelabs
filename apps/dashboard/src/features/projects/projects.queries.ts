import type {
  CreateProjectMutationRequest,
  UpdateProjectMutationRequest,
} from '@talelabs/sdk'

import {
  createProject,
  deleteProject,
  getProjectQueryKey,
  listProjectsQueryKey,
  updateProject,
} from '@talelabs/sdk'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useCreateProjectMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateProjectMutationRequest) => createProject({ data }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listProjectsQueryKey() })
    },
  })
}

export function useUpdateProjectMutation(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateProjectMutationRequest) => updateProject({
      data,
      projectId,
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: listProjectsQueryKey() }),
        queryClient.invalidateQueries({
          queryKey: getProjectQueryKey({ projectId }),
        }),
      ])
    },
  })
}

export function useDeleteProjectMutation(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => deleteProject({ projectId }),
    onSuccess: async () => {
      queryClient.removeQueries({
        queryKey: getProjectQueryKey({ projectId }),
      })
      await queryClient.invalidateQueries({ queryKey: listProjectsQueryKey() })
    },
  })
}
