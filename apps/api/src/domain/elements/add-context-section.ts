export function addContextSection(sections: string[], label: string, value: string) {
  if (value)
    sections.push(`${label}: ${value}`)
}

export function addElementGuidelines(sections: string[], value: string) {
  addContextSection(sections, 'Guidelines', value)
}
