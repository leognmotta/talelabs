import type { LocationElementData } from '@talelabs/elements'
import type { ElementContextBuilder } from './element-context.types.js'
import {
  addContextSection,
  addElementGuidelines,
} from './add-context-section.js'

export const buildLocationContext: ElementContextBuilder<LocationElementData> = (input) => {
  const sections = [`Location: ${input.name}`]
  addElementGuidelines(sections, input.data.description)
  addContextSection(sections, 'Atmosphere', input.data.atmosphere)
  return { assets: input.assets, elementId: input.elementId, schemaVersion: input.schemaVersion, text: sections.join('\n'), type: 'location' }
}
