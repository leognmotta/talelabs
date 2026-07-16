/**
 * Locale-independent UTF-16 ordering for persisted IDs and canonical plan data.
 * This is the ordering used by JavaScript's default string sort, made explicit
 * so planner output cannot vary with the host ICU locale.
 */
export function compareStableStrings(left: string, right: string) {
  if (left === right)
    return 0
  return left < right ? -1 : 1
}
