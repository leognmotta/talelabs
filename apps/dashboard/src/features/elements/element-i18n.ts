import type {
  BrandElementData,
  CharacterElementData,
  ELEMENT_TYPE_REGISTRY,
  ElementType,
  LocationElementData,
  ObjectElementData,
  OtherElementData,
  ProductElementData,
  VehicleElementData,
  VoiceElementData,
} from '@talelabs/elements'

type ElementRegistry = typeof ELEMENT_TYPE_REGISTRY
interface ElementDataByType {
  brand: BrandElementData
  character: CharacterElementData
  location: LocationElementData
  object: ObjectElementData
  other: OtherElementData
  product: ProductElementData
  vehicle: VehicleElementData
  voice: VoiceElementData
}
type ElementTypeCopyPart = 'description' | 'label'
type ElementFieldCopyPart = 'description' | 'empty' | 'label' | 'placeholder'
type ElementAssetRoleCopyPart = 'description' | 'label'

export type ElementFieldId<Type extends ElementType = ElementType>
  = Type extends ElementType
    ? (
        Exclude<Extract<keyof ElementDataByType[Type], string>, 'assetRoles'>
        | (Type extends 'other' ? 'instructions' : never)
      )
    : never

export type ElementAssetRoleId<Type extends ElementType = ElementType>
  = Type extends ElementType
    ? ElementRegistry[Type]['assetRoles'][number]['id']
    : never

export function elementTypeTranslationKey<
  Type extends ElementType,
  Part extends ElementTypeCopyPart,
>(type: Type, part: Part): `elements.types.${Type}.${Part}` {
  return `elements.types.${type}.${part}`
}

export function elementFieldTranslationKey<
  Type extends ElementType,
  Field extends ElementFieldId<Type>,
  Part extends ElementFieldCopyPart,
>(type: Type, field: Field, part: Part): `elements.types.${Type}.fields.${Field}.${Part}` {
  return `elements.types.${type}.fields.${field}.${part}`
}

export function elementAssetRoleTranslationKey<
  Type extends ElementType,
  Role extends ElementAssetRoleId<Type>,
  Part extends ElementAssetRoleCopyPart,
>(type: Type, role: Role, part: Part): `elements.types.${Type}.assetRoles.${Role}.${Part}` {
  return `elements.types.${type}.assetRoles.${role}.${part}`
}
