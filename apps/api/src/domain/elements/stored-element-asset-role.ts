import {
  getElementAssetRole,
  isElementType,
  upcastElementData,
} from '@talelabs/elements'

export function getStoredElementAssetRole(
  element: { data: unknown, schemaVersion: number, type: string },
  role: string,
) {
  if (!isElementType(element.type))
    throw new Error(`Stored Element type is not registered: ${element.type}`)

  const parsed = upcastElementData(
    element.type,
    element.schemaVersion,
    element.data,
  )
  return getElementAssetRole(element.type, role, parsed.data)
}
