/** Dashboard acceptance URL creation for organization invitations. */

/** Builds the dashboard URL used in one invitation email and API response. */
export function buildInviteUrl(invitationId: string) {
  const dashboardUrl = process.env.DASHBOARD_URL
    ?? process.env.BETTER_AUTH_URL
    ?? 'http://localhost:5173'
  const url = new URL('/accept-invitation', dashboardUrl)
  url.searchParams.set('token', invitationId)
  return url.toString()
}
