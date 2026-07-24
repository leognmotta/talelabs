/** Compact trigger that presents the current Project or Private location. */

import { IconMapPin } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { useTranslation } from 'react-i18next'

import { useProjectQuery } from './project-queries'

/** Displays the current Project or Private location as a compact button. */
export function ProjectLocationControl({
  className,
  disabled,
  projectId,
  onClick,
}: {
  /** Optional layout classes supplied by the owning creative surface. */
  className?: string
  /** Whether the location trigger is unavailable. */
  disabled?: boolean
  /** Current Project identity, or Private when null. */
  projectId: null | string
  /** Opens the owning location dialog. */
  onClick: () => void
}) {
  const { t } = useTranslation()
  const projectQuery = useProjectQuery(projectId)
  const label = projectId
    ? projectQuery.data?.name ?? t('projects.project')
    : t('projects.private')

  return (
    <Button
      aria-label={t('projects.changeLocation')}
      className={className}
      disabled={disabled}
      size="sm"
      title={label}
      type="button"
      variant="ghost"
      onClick={onClick}
    >
      <IconMapPin />
      <span className="max-w-40 truncate">{label}</span>
    </Button>
  )
}
