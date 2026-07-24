/** Read-only route state for one archived Project. */

import type { Project } from '@talelabs/sdk'

import { IconArchive, IconRestore } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@talelabs/ui/components/empty'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { getApiErrorMessage } from '../../shared/lib/api-error'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { useProjectMutations } from './project-mutations'

/** Replaces writable Project surfaces until the Project is restored. */
export function ProjectArchivedState({
  project,
}: {
  /** Archived Project resolved by the shared route boundary. */
  project: Project
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const organizationId = useActiveOrganizationId()
  const mutations = useProjectMutations(organizationId)

  async function restore() {
    try {
      await mutations.restore.mutateAsync(project.id)
      toast.success(t('projects.restored'))
      navigate(`/projects/${project.id}`, { replace: true })
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'projects.actionFailed'))
    }
  }

  return (
    <Empty className="min-h-112">
      <EmptyHeader>
        <EmptyMedia variant="icon"><IconArchive /></EmptyMedia>
        <EmptyTitle>{project.name}</EmptyTitle>
        <EmptyDescription>{t('projects.archived')}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          disabled={mutations.restore.isPending}
          onClick={() => void restore()}
        >
          <IconRestore data-icon="inline-start" />
          {t('projects.restore')}
        </Button>
      </EmptyContent>
    </Empty>
  )
}
