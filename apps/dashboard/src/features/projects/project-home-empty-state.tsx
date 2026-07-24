/**
 * First-use Project Home composition and its focused starting actions.
 *
 * The launchpad stays compact and unframed so it guides the first useful move
 * without turning the Project Home into a marketing page or dashboard.
 */

import {
  IconFileDescription,
  IconGitBranch,
  IconUpload,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

import { CreateAmbientGradient } from '../create/create-ambient-gradient'
import { ProjectHomeCreateStarter } from './project-home-create-starter'
import { ProjectHomeEmptyAction } from './project-home-empty-action'

/** Renders one focused creation command and three quieter Project setup paths. */
export function ProjectHomeEmptyState({
  onCreateFlow,
  onUpload,
  projectId,
  uploadDisabled,
}: {
  onCreateFlow: () => void
  onUpload: () => void
  projectId: string
  uploadDisabled: boolean
}) {
  const { t } = useTranslation()
  return (
    <section
      aria-labelledby="empty-project-heading"
      className="
        relative isolate py-4
        sm:py-8
      "
    >
      <CreateAmbientGradient
        className="
          absolute -top-32 -bottom-48 left-1/2 -z-10 w-[calc(100%+3rem)]
          -translate-x-1/2
        "
      />
      <div className="mx-auto max-w-4xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            className="
              text-[2rem] leading-tight font-semibold tracking-tight
              sm:text-[2.5rem]
            "
            id="empty-project-heading"
          >
            {t('projects.emptyProjectTitle')}
          </h2>
          <p className="
            mx-auto mt-3 max-w-xl text-sm/relaxed text-muted-foreground
          "
          >
            {t('projects.emptyProjectDescription')}
          </p>
        </div>
        <ProjectHomeCreateStarter projectId={projectId} />
        <div className="
          mt-7 grid divide-y border-t
          sm:grid-cols-3 sm:divide-x sm:divide-y-0
        "
        >
          <ProjectHomeEmptyAction
            description={t('projects.emptyBriefDescription')}
            icon={<IconFileDescription className="size-5" />}
            label={t('projects.emptyBriefTitle')}
            to={`/projects/${projectId}/brief`}
            widthClassName="sm:pr-6"
          />
          <ProjectHomeEmptyAction
            description={t('projects.emptyFlowDescription')}
            icon={<IconGitBranch className="size-5" />}
            label={t('projects.emptyFlowTitle')}
            onClick={onCreateFlow}
            widthClassName="sm:px-6"
          />
          <ProjectHomeEmptyAction
            description={t('projects.emptyUploadDescription')}
            icon={<IconUpload className="size-5" />}
            label={t('projects.emptyUploadTitle')}
            disabled={uploadDisabled}
            onClick={onUpload}
            widthClassName="sm:pl-6"
          />
        </div>
      </div>
    </section>
  )
}
