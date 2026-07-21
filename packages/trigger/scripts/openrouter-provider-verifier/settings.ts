/** Provider-neutral default-setting fixtures derived from catalog operations. */

import type { ProviderRequestRoute } from './requests.js'

import assert from 'node:assert/strict'

/** Resolves provider-neutral defaults for one catalog operation fixture. */
export function defaultSettings(route: ProviderRequestRoute) {
  return Object.fromEntries(route.operation.settingIds.map((settingId) => {
    const setting = route.model.settings.find(candidate => candidate.id === settingId)
    assert.ok(setting)
    return [settingId, setting.default]
  }))
}
