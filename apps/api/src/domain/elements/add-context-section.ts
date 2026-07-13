import type { ElementIdentity } from '@talelabs/elements'

export function addContextSection(sections: string[], label: string, value: string) {
  if (value)
    sections.push(`${label}: ${value}`)
}

export function addElementGuidelines(sections: string[], value: string) {
  addContextSection(sections, 'Guidelines', value)
}

export function addElementIdentityGuidance(
  sections: string[],
  identity: ElementIdentity,
) {
  addContextSection(sections, 'Consistency guidance', identity.summary)
  if (identity.mustKeep.length) {
    sections.push(`Must keep:\n${identity.mustKeep.map(value => `- ${value}`).join('\n')}`)
  }
  if (identity.mayVary.length) {
    sections.push(`May vary:\n${identity.mayVary.map(value => `- ${value}`).join('\n')}`)
  }
  if (identity.avoid.length)
    sections.push(`Avoid:\n${identity.avoid.map(value => `- ${value}`).join('\n')}`)
}
