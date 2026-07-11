import type { VehicleElementData } from '@talelabs/elements'
import type { ElementContextBuilder } from './element-context.types.js'
import {
  addContextSection,
  addElementGuidelines,
} from './add-context-section.js'

export const buildVehicleContext: ElementContextBuilder<VehicleElementData> = (input) => {
  const sections = [`Vehicle: ${input.name}`]
  addElementGuidelines(sections, input.data.description)
  addContextSection(sections, 'Motion guidance', input.data.motionGuidance)
  return { assets: input.assets, elementId: input.elementId, schemaVersion: input.schemaVersion, text: sections.join('\n'), type: 'vehicle' }
}
