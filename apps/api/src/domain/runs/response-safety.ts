/** Safe public projection of internal Flow run failure details. */

import { safeRunFailureForResponse } from '@talelabs/trigger'

/** Projects internal run failures into stable safe API fields. */
export function safeFailureFields(
  errorCode: null | string,
  errorMessage: null | string,
) {
  const failure = safeRunFailureForResponse({
    code: errorCode,
    message: errorMessage,
  })
  return {
    errorCode: failure?.code ?? null,
    errorMessage: failure?.message ?? null,
  }
}
