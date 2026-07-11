import type { BrandElementData } from '@talelabs/elements'
import type { ElementContextBuilder } from './element-context.types.js'
import {
  addContextSection,
  addElementGuidelines,
} from './add-context-section.js'

export const buildBrandContext: ElementContextBuilder<BrandElementData> = (input) => {
  const sections = [`Brand: ${input.name}`]
  addElementGuidelines(sections, input.data.description)
  addContextSection(sections, 'Communication style', input.data.communicationStyle)
  if (input.data.colors.length)
    sections.push(`Colors: ${input.data.colors.join(', ')}`)
  return { assets: input.assets, elementId: input.elementId, schemaVersion: input.schemaVersion, text: sections.join('\n'), type: 'brand' }
}
