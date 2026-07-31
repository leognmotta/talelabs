/**
 * Shared React contract for opening the layout-owned generation access dialog.
 *
 * Creative actions depend only on this narrow command instead of Settings
 * navigation or modal presentation details.
 */

import type { GenerationAccessDialogRequest } from './generation-access-dialog'

import { createContext, use } from 'react'

/** Command exposed by the generation access dialog provider. */
export interface GenerationAccessDialogContextValue {
  /** Opens or replaces the dialog with facts from the latest blocked action. */
  openGenerationAccessDialog: (request: GenerationAccessDialogRequest) => void
}

/** Nullable boundary populated once by the dashboard layout provider. */
export const GenerationAccessDialogContext
  = createContext<GenerationAccessDialogContextValue | null>(null)

/** Returns the layout-owned action for opening generation funding choices. */
export function useGenerationAccessDialog() {
  const value = use(GenerationAccessDialogContext)
  if (!value) {
    throw new Error(
      'useGenerationAccessDialog must be used within GenerationAccessDialogProvider',
    )
  }
  return value
}
