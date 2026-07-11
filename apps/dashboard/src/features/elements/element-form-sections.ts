export const ELEMENT_FORM_SECTIONS = {
  assets: 'element-assets',
  data: 'element-data',
} as const

export const ELEMENT_FORM_SECTION_ORDER = [
  ELEMENT_FORM_SECTIONS.data,
  ELEMENT_FORM_SECTIONS.assets,
] as const
