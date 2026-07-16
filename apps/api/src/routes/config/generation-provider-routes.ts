/**
 * API startup boundary for the code-owned private provider route registry.
 * Importing this module fails closed when the active catalog and executable
 * routes drift.
 */
import { assertGenerationProviderRoutes } from '@talelabs/openrouter'

assertGenerationProviderRoutes()

export {
  GENERATION_PROVIDER_ROUTES,
  getGenerationProviderRoute,
  validateGenerationProviderRoutes,
} from '@talelabs/openrouter'
