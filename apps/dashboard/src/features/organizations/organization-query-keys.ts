export const organizationQueryKeys = {
  scope: (organizationId: null | string) => [
    'organization',
    organizationId,
  ] as const,
}
