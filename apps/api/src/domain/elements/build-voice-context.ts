import type { VoiceElementData } from '@talelabs/elements'
import type { ElementContextBuilder } from './element-context.types.js'
import {
  addContextSection,
  addElementGuidelines,
} from './add-context-section.js'

export const buildVoiceContext: ElementContextBuilder<VoiceElementData> = (input) => {
  const sections = [`Voice: ${input.name}`]
  addElementGuidelines(sections, input.data.description)
  addContextSection(sections, 'Language and accent', input.data.languageAccent)
  addContextSection(sections, 'Tone', input.data.tone)
  return { assets: input.assets, elementId: input.elementId, schemaVersion: input.schemaVersion, text: sections.join('\n'), type: 'voice' }
}
