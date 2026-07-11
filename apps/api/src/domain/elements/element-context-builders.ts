import type {
  BrandElementData,
  CharacterElementData,
  ElementType,
  LocationElementData,
  ObjectElementData,
  OtherElementData,
  ProductElementData,
  VehicleElementData,
  VoiceElementData,
} from '@talelabs/elements'
import type {
  ElementContextBuilder,
  OtherElementContextBuilder,
} from './element-context.types.js'

import { buildBrandContext } from './build-brand-context.js'
import { buildCharacterContext } from './build-character-context.js'
import { buildLocationContext } from './build-location-context.js'
import { buildObjectContext } from './build-object-context.js'
import { buildOtherContext } from './build-other-context.js'
import { buildProductContext } from './build-product-context.js'
import { buildVehicleContext } from './build-vehicle-context.js'
import { buildVoiceContext } from './build-voice-context.js'

interface ElementContextBuilderMap {
  brand: ElementContextBuilder<BrandElementData>
  character: ElementContextBuilder<CharacterElementData>
  location: ElementContextBuilder<LocationElementData>
  object: ElementContextBuilder<ObjectElementData>
  other: OtherElementContextBuilder<OtherElementData>
  product: ElementContextBuilder<ProductElementData>
  vehicle: ElementContextBuilder<VehicleElementData>
  voice: ElementContextBuilder<VoiceElementData>
}

export const ELEMENT_CONTEXT_BUILDERS = {
  brand: buildBrandContext,
  character: buildCharacterContext,
  location: buildLocationContext,
  object: buildObjectContext,
  other: buildOtherContext,
  product: buildProductContext,
  vehicle: buildVehicleContext,
  voice: buildVoiceContext,
} satisfies ElementContextBuilderMap

export function getElementContextBuilder(
  type: Exclude<ElementType, 'other'>,
) {
  return ELEMENT_CONTEXT_BUILDERS[type] as ElementContextBuilder<Record<string, unknown>>
}
