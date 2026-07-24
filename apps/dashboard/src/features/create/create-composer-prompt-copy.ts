/**
 * Localized-copy keys shared by direct Create prompt presentations.
 */

import type { CreateDraft } from './create-draft'

type CreatePromptContext = Pick<CreateDraft, 'audioIntent' | 'mode'>

/** Returns the localized accessible label key for one direct Create prompt. */
export function getCreatePromptLabelKey(context: CreatePromptContext) {
  if (context.mode === 'image')
    return 'create.composer.imageLabel' as const
  if (context.mode === 'video')
    return 'create.composer.videoLabel' as const
  if (context.audioIntent === 'speechGeneration')
    return 'create.composer.speechLabel' as const
  if (context.audioIntent === 'musicGeneration')
    return 'create.composer.musicLabel' as const
  return 'create.composer.soundEffectLabel' as const
}

/** Returns the localized empty guidance key for one direct Create prompt. */
export function getCreatePromptPlaceholderKey(context: CreatePromptContext) {
  if (context.mode === 'image')
    return 'create.composer.imagePlaceholder' as const
  if (context.mode === 'video')
    return 'create.composer.videoPlaceholder' as const
  if (context.audioIntent === 'speechGeneration')
    return 'create.composer.speechPlaceholder' as const
  if (context.audioIntent === 'musicGeneration')
    return 'create.composer.musicPlaceholder' as const
  return 'create.composer.soundEffectPlaceholder' as const
}
