import { IconFolder } from '@tabler/icons-react'
import { useGetProject } from '@talelabs/sdk'
import { Button } from '@talelabs/ui/components/button'
import { useNavigate, useParams } from 'react-router'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { ContextDetailHeader } from '../context/context-detail-header'
import { ContextDetailLoading } from '../context/context-detail-loading'
import { ContextEmptyState } from '../context/context-empty-state'
import { ContextProfileField } from '../context/context-profile-field'
import { DeleteResourceDialog } from '../context/delete-resource-dialog'
import { useContextResourceDelete } from '../context/use-context-resource-delete'
import { useDeleteProjectMutation } from './projects.queries'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function ProjectDetail() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const projectQuery = useGetProject({ projectId })
  const deleteMutation = useDeleteProjectMutation(projectId ?? '')
  const deletion = useContextResourceDelete({
    deleteResource: () => deleteMutation.mutateAsync(),
    errorMessage: 'Could not delete project.',
    returnTo: '/projects',
    successMessage: 'Project deleted',
  })

  if (projectQuery.isPending)
    return <ContextDetailLoading />

  if (projectQuery.error || !projectQuery.data) {
    return (
      <ContextEmptyState
        action={(
          <Button variant="outline" onClick={() => navigate('/projects')}>
            Back to projects
          </Button>
        )}
        description={getApiErrorMessage(
          projectQuery.error,
          'Project not found.',
        )}
        icon={IconFolder}
        title="Project unavailable"
      />
    )
  }

  const project = projectQuery.data

  return (
    <article className="flex min-h-full flex-col">
      <ContextDetailHeader
        backTo="/projects"
        deleteLabel="Delete project"
        editTo={`/projects/${project.id}/edit`}
        onDelete={() => deletion.setIsOpen(true)}
        subtitle="Project"
        title={project.name}
      />
      <div
        className="
          grid gap-8 px-5 py-6
          md:grid-cols-[minmax(0,2fr)_minmax(13rem,1fr)] md:px-8
        "
      >
        <ContextProfileField
          fallback="No description"
          label="Description"
          value={project.description}
        />
        <dl className="grid content-start gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Created</dt>
            <dd className="mt-1">
              <time dateTime={project.createdAt}>
                {dateFormatter.format(new Date(project.createdAt))}
              </time>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last updated</dt>
            <dd className="mt-1">
              <time dateTime={project.updatedAt}>
                {dateFormatter.format(new Date(project.updatedAt))}
              </time>
            </dd>
          </div>
        </dl>
      </div>
      <DeleteResourceDialog
        description={`Delete “${project.name}”? This action cannot be undone.`}
        isPending={deleteMutation.isPending}
        onConfirm={() => void deletion.confirmDelete()}
        onOpenChange={deletion.setIsOpen}
        open={deletion.isOpen}
        title="Delete project"
      />
    </article>
  )
}
