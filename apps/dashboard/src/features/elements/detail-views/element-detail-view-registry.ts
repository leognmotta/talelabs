import type { ElementType } from '@talelabs/elements'
import type { ComponentType } from 'react'
import type { ElementDetailViewProps } from './element-detail-view.types'

import { BrandElementDetail } from './brand-element-detail'
import { CharacterElementDetail } from './character-element-detail'
import { LocationElementDetail } from './location-element-detail'
import { ObjectElementDetail } from './object-element-detail'
import { OtherElementDetail } from './other-element-detail'
import { ProductElementDetail } from './product-element-detail'
import { VehicleElementDetail } from './vehicle-element-detail'
import { VoiceElementDetail } from './voice-element-detail'

export const ELEMENT_DETAIL_VIEW_REGISTRY = {
  brand: BrandElementDetail,
  character: CharacterElementDetail,
  location: LocationElementDetail,
  object: ObjectElementDetail,
  other: OtherElementDetail,
  product: ProductElementDetail,
  vehicle: VehicleElementDetail,
  voice: VoiceElementDetail,
} satisfies Record<ElementType, ComponentType<ElementDetailViewProps>>
