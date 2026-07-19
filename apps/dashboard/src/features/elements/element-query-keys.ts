/** TanStack Query key factory for organization-scoped Element reads. */

export const elementQueryKeys = {
  all: (organizationId: string) => ['elements', organizationId] as const,
  detail: (organizationId: string, elementId: string) =>
    ['elements', organizationId, 'detail', elementId] as const,
  list: (organizationId: string, filters?: Record<string, unknown>) =>
    ['elements', organizationId, 'list', filters ?? {}] as const,
}
