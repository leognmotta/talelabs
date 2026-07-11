import {
  IconCar,
  IconCube,
  IconMapPin,
  IconMicrophone,
  IconPackage,
  IconPalette,
  IconPlus,
  IconUser,
} from '@tabler/icons-react'

export const ELEMENT_TYPE_ICONS = {
  brand: IconPalette,
  character: IconUser,
  location: IconMapPin,
  object: IconCube,
  other: IconPlus,
  product: IconPackage,
  vehicle: IconCar,
  voice: IconMicrophone,
} as const
