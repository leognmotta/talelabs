/** Browser-only type and bundle probe for every universal package entry point. */

import * as providerRoot from '@talelabs/providers'
import * as providerBrowser from '@talelabs/providers/browser'
import * as providerCore from '@talelabs/providers/core'

const verifiedProviderEntries = {
  browser: providerBrowser,
  core: providerCore,
  root: providerRoot,
}

void verifiedProviderEntries
