export function generationProviderRouteKey(input: {
  modelContractVersion: string
  operationId: string
  productModelId: string
}) {
  return `${input.productModelId}:${input.modelContractVersion}:${input.operationId}`
}

export function generationProviderRouteIdentity(input: {
  modelContractVersion: string
  operationId: string
  productModelId: string
  routeVersion: string
}) {
  return `${generationProviderRouteKey(input)}:${input.routeVersion}`
}
