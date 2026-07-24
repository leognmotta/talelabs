/** Interactive, aspect-ratio-aware Asset preview for a Project Brief mention. */

import type { ProjectMentionResolution } from '@talelabs/sdk'
import type {
  ProjectEntityMentionAttributes,
  ProjectEntityMentionRuntimeOptions,
} from './project-brief-extensions'

import { NodeViewWrapper } from '@tiptap/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ProjectBriefActiveAssetPreview } from './project-brief-active-asset-preview'
import { ProjectBriefAssetPoster } from './project-brief-asset-poster'
import { projectMentionHref } from './project-brief-extensions'

function mediaAspectRatio(resolution: ProjectMentionResolution) {
  if (resolution.asset?.type === 'audio')
    return 3.5
  const { height, width } = resolution.asset ?? {}
  return height && width ? width / height : 16 / 9
}

/** Opens Assets in-place and plays video or audio only during interaction. */
export function ProjectBriefAssetMentionPreview({
  attributes,
  options,
  resolution,
}: {
  /** Stable attributes persisted in the Tiptap mention node. */
  attributes: ProjectEntityMentionAttributes
  /** Project route and ephemeral mention presentation behavior. */
  options: ProjectEntityMentionRuntimeOptions
  /** Current presentation-only metadata for the mentioned Asset. */
  resolution: ProjectMentionResolution
}) {
  const { t } = useTranslation()
  const [previewActive, setPreviewActive] = useState(false)
  const playable = resolution.asset?.type === 'audio'
    || resolution.asset?.type === 'video'
  const aspectRatio = mediaAspectRatio(resolution)
  const href = projectMentionHref(options.projectId, attributes)
  const maxWidth = aspectRatio < 0.85 ? '30rem' : '42rem'

  return (
    <NodeViewWrapper
      as="span"
      className="my-3 inline-flex w-full align-middle"
      data-project-entity-mention=""
    >
      <a
        aria-label={t('assets.openAsset', { name: resolution.label })}
        className="
          relative inline-flex w-full overflow-hidden rounded-2xl border
          border-border bg-black/20 shadow-sm transition
          hover:border-foreground/25 hover:shadow-lg
          focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:outline-none
        "
        data-project-asset-mention-preview=""
        href={href}
        style={{ aspectRatio, maxWidth }}
        title={resolution.label}
        onBlur={() => setPreviewActive(false)}
        onClick={(event) => {
          if (!options.presentation?.onOpenAsset)
            return
          event.preventDefault()
          options.presentation.onOpenAsset(attributes.entityId)
        }}
        onFocus={() => playable && setPreviewActive(true)}
        onMouseEnter={() => playable && setPreviewActive(true)}
        onMouseLeave={() => setPreviewActive(false)}
      >
        {playable && previewActive
          ? (
              <ProjectBriefActiveAssetPreview
                assetId={attributes.entityId}
                resolution={resolution}
              />
            )
          : <ProjectBriefAssetPoster resolution={resolution} />}
      </a>
    </NodeViewWrapper>
  )
}
