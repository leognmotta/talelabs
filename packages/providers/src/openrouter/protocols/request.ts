/**
 * Provider-neutral request accessors shared by OpenRouter protocols.
 *
 * The implementations are owned by the shared `generation-request` module; this
 * boundary keeps the historical OpenRouter import path stable.
 */

export {
  assertOnlySettings,
  inputAssets,
  requestText,
} from '../../generation-request.js'
