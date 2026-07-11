export function getOrganizationRequestHeaders(organizationId: string) {
  return { 'X-TaleLabs-Organization-Id': organizationId }
}
