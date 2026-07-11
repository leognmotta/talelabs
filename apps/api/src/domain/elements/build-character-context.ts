import type { CharacterElementData } from '@talelabs/elements'
import type { ElementContextBuilder } from './element-context.types.js'
import {
  addContextSection,
  addElementGuidelines,
} from './add-context-section.js'

export const buildCharacterContext: ElementContextBuilder<CharacterElementData> = (input) => {
  const sections = [`Character: ${input.name}`]
  addElementGuidelines(sections, input.data.description)
  addContextSection(sections, 'Personality', input.data.personality)
  return { assets: input.assets, elementId: input.elementId, schemaVersion: input.schemaVersion, text: sections.join('\n'), type: 'character' }
}
