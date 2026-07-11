import type { ProductElementData } from '@talelabs/elements'
import type { ElementContextBuilder } from './element-context.types.js'
import { addElementGuidelines } from './add-context-section.js'

export const buildProductContext: ElementContextBuilder<ProductElementData> = (input) => {
  const sections = [`Product: ${input.name}`]
  addElementGuidelines(sections, input.data.description)
  if (input.data.sellingPoints.length)
    sections.push(`Selling points:\n${input.data.sellingPoints.map(point => `- ${point}`).join('\n')}`)
  return { assets: input.assets, elementId: input.elementId, schemaVersion: input.schemaVersion, text: sections.join('\n'), type: 'product' }
}
