import type { ElementType } from '@talelabs/elements'
import type { ElementFormRegistryEntry } from './element-form.types'

import { BrandElementForm } from './brand-element-form'
import { CharacterElementForm } from './character-element-form'
import { LocationElementForm } from './location-element-form'
import { ObjectElementForm } from './object-element-form'
import { OtherElementForm } from './other-element-form'
import { ProductElementForm } from './product-element-form'
import { VehicleElementForm } from './vehicle-element-form'
import { VoiceElementForm } from './voice-element-form'

type ElementFormRegistry = {
  [Type in ElementType]: Omit<ElementFormRegistryEntry, 'type'> & {
    type: Type
  };
}

export const ELEMENT_FORM_REGISTRY: ElementFormRegistry = {
  brand: { Form: BrandElementForm, type: 'brand' },
  character: { Form: CharacterElementForm, type: 'character' },
  location: { Form: LocationElementForm, type: 'location' },
  object: { Form: ObjectElementForm, type: 'object' },
  other: { Form: OtherElementForm, type: 'other' },
  product: { Form: ProductElementForm, type: 'product' },
  vehicle: { Form: VehicleElementForm, type: 'vehicle' },
  voice: { Form: VoiceElementForm, type: 'voice' },
}

export function getElementForm(type: ElementType) {
  return ELEMENT_FORM_REGISTRY[type].Form
}
