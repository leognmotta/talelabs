import { apiError } from '../../middleware/error.js'

export const invalidCursorError = apiError(
  'validation_error',
  'The cursor is invalid or has expired.',
  [{
    field: 'cursor',
    message: 'Use a cursor returned by this endpoint.',
  }],
)
