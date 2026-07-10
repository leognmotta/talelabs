import { IconFolder } from '@tabler/icons-react'
import { useGetProject } from '@talelabs/sdk'
import { Button } from '@talelabs/ui/components/button'
import { Skeleton } from '@talelabs/ui/components/skeleton'
import { useNavigate, useParams } from 'react-router'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { ContextEmptyState } from '../context/context-empty-state'
import { ProjectForm } from './project-form'

export function ProjectEdit() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const projectQuery = useGetProject({ projectId })

  if (projectQuery.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-8 py-7">
        <Skeleton className="h-7 w-48 rounded-md" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    )
  }

  if (projectQuery.error || !projectQuery.data) {
    return (
      <ContextEmptyState
        action={<Button variant="outline" onClick={() => navigate('/projects')}>Back to projects</Button>}
        description={getApiErrorMessage(projectQuery.error, 'Project not found.')}
        icon={IconFolder}
        title="Project unavailable"
      />
    )
  }

  return <ProjectForm project={projectQuery.data} />
}
