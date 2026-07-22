/** Deterministic Voice Isolation migration from one union input to typed inputs. */

import { VoiceIsolationNodeDataSchemaV1 } from '../data/schemas.js'

/** Preserves the legacy selection for either compatible typed source input. */
export function migrateVoiceIsolationNodeDataV1(data: unknown) {
  const parsed = VoiceIsolationNodeDataSchemaV1.parse(data)
  const legacySelection = parsed.inputSelections.sourceMedia ?? { mode: 'auto' }
  return {
    ...parsed,
    inputSelections: {
      sourceAudio: parsed.inputSelections.sourceAudio ?? legacySelection,
      sourceVideo: parsed.inputSelections.sourceVideo ?? legacySelection,
    },
  }
}
