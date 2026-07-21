/** Offline scenarios for immutable browser-run provider credential checks. */

import assert from 'node:assert/strict'

import { missingBrowserCredentialProviders } from '../src/browser/credential-scope.js'

assert.deepEqual(
  missingBrowserCredentialProviders(['fal'], ['fal']),
  [],
)
assert.deepEqual(
  missingBrowserCredentialProviders(['fal', 'openrouter'], ['fal']),
  ['openrouter'],
)
assert.deepEqual(
  missingBrowserCredentialProviders(
    ['fal', 'openrouter'],
    ['openrouter', 'fal'],
  ),
  [],
)
assert.deepEqual(
  missingBrowserCredentialProviders(['fal'], []),
  ['fal'],
)

console.log('Verified fal-only, mixed-provider, and deleted-key browser recovery.')
