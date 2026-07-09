const LAST_ORGANIZATION_COOKIE = 'talelabs_last_organization_id'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export function storeLastOrganizationId(organizationId: string) {
  document.cookie = [
    `${LAST_ORGANIZATION_COOKIE}=${encodeURIComponent(organizationId)}`,
    'Path=/',
    `Max-Age=${MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ].join('; ')
}

export function clearLastOrganizationId() {
  document.cookie = [
    `${LAST_ORGANIZATION_COOKIE}=`,
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax',
  ].join('; ')
}
