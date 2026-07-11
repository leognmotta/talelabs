import type { ObjectElementData } from '@talelabs/elements'
import type { ElementContextBuilder } from './element-context.types.js'
import {
  addContextSection,
  addElementGuidelines,
} from './add-context-section.js'

export const buildObjectContext: ElementContextBuilder<ObjectElementData> = (input) => {
  const sections = [`Object: ${input.name}`]
  addElementGuidelines(sections, input.data.description)
  addContextSection(sections, 'Interaction guidance', input.data.interactionGuidance)
  return { assets: input.assets, elementId: input.elementId, schemaVersion: input.schemaVersion, text: sections.join('\n'), type: 'object' }
}
