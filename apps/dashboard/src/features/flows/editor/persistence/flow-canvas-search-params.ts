/** Typed URL state for the Flow canvas. */

import { parseAsBoolean } from 'nuqs'

/** Query parsers for shareable, reload-safe canvas state. */
export const flowCanvasSearchParams = {
  debug: parseAsBoolean
    .withDefault(false)
    .withOptions({ history: 'replace' }),
}
