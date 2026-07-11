export function assertNoUnhandledElementFields(
  fields: Record<string, never>,
) {
  void fields
}
