/** Validated Project route boundary shared by every reused feature surface. */

import { Spinner } from '@talelabs/ui/components/spinner'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useParams } from 'react-router'

import { ErrorFallback } from '../../shared/components/error-fallback'
import { ProjectArchivedState } from './project-archived-state'
import { useProjectQuery } from './project-queries'

/** Resolves the URL Project before any nested creative surface may render. */
export function ProjectRouteBoundary() {
  const { t } = useTranslation()
  const { projectId } = useParams<{ projectId: string }>()
  const query = useProjectQuery(projectId ?? null)

  if (!projectId)
    return <Navigate replace to="/projects" />
  if (query.isPending) {
    return (
      <div className="flex min-h-80 flex-1 items-center justify-center">
        <Spinner className="size-6" />
        <span className="sr-only">{t('common.loading')}</span>
      </div>
    )
  }
  if (query.isError || !query.data) {
    return (
      <ErrorFallback
        description={t('projects.couldNotLoadDescription')}
        title={t('projects.couldNotLoad')}
        onRetry={() => void query.refetch()}
      />
    )
  }
  if (query.data.archivedAt)
    return <ProjectArchivedState project={query.data} />
  return <Outlet />
}
