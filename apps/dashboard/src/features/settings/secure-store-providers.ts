/**
 * Providers offered by the browser-local Secure Store, in display order.
 *
 * Adding a browser-BYOK provider adds one entry here; the settings surface and
 * dialog render from this list without per-provider UI branches. A provider
 * without bundled brand glyphs renders a neutral placeholder icon — drop the
 * official SVG in and reference it here to replace the placeholder.
 */

import type { BrowserCredentialProviderId } from '@talelabs/providers/browser'

import falLogo from './fal-glyph.svg'
import openRouterDarkLogo from './openrouter-glyph-dark.svg'
import openRouterLightLogo from './openrouter-glyph-light.svg'

/** One Secure Store provider row's identity, label, and optional themed glyphs. */
export interface SecureStoreProvider {
  /** Browser credential-store provider id. */
  id: BrowserCredentialProviderId
  /** Glyph shown on dark backgrounds; omit to render a neutral placeholder. */
  logoDark?: string
  /** Glyph shown on light backgrounds; omit to render a neutral placeholder. */
  logoLight?: string
  /** i18n key resolving to the provider's display name. */
  nameKey: string
}

/** Providers a user may connect a browser-only API key for. */
export const SECURE_STORE_PROVIDERS: readonly SecureStoreProvider[] = [
  {
    id: 'openrouter',
    logoDark: openRouterDarkLogo,
    logoLight: openRouterLightLogo,
    nameKey: 'secureStore.openRouter',
  },
  {
    id: 'fal',
    logoDark: falLogo,
    logoLight: falLogo,
    nameKey: 'secureStore.fal',
  },
]
