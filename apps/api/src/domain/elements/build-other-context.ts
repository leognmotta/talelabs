import type { OtherElementData } from '@talelabs/elements'
import type { OtherElementContextBuilder } from './element-context.types.js'
import { addContextSection } from './add-context-section.js'

export const buildOtherContext: OtherElementContextBuilder<OtherElementData> = (input) => {
  const sections = [`Other: ${input.name}`]
  addContextSection(sections, 'Instructions', input.instructions?.trim() ?? '')
  return {
    assets: input.assets,
    elementId: input.elementId,
    schemaVersion: input.schemaVersion,
    text: sections.join('\n'),
    type: 'other',
  }
}
