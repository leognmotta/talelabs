import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- package tests use the Node test runner via tsx.
import test from 'node:test'

import {
  DEFAULT_LOCALE,
  normalizeLocale,
  resolveLocale,
} from './locales.js'

test('uses an exact supported browser locale when available', () => {
  assert.equal(resolveLocale(['pt-BR', 'en-US']), 'pt-BR')
  assert.equal(resolveLocale(['pt-PT', 'en-US']), 'pt-PT')
})

test('falls back from a regional browser locale to its supported language', () => {
  assert.equal(resolveLocale(['es-MX']), 'es')
  assert.equal(resolveLocale(['fr-CA']), 'fr')
  assert.equal(resolveLocale(['en-GB']), 'en')
})

test('uses English when no browser language is supported', () => {
  assert.equal(resolveLocale(['ja-JP', 'ko-KR']), DEFAULT_LOCALE)
  assert.equal(resolveLocale([]), DEFAULT_LOCALE)
})

test('normalizes browser locale casing and separators', () => {
  assert.equal(normalizeLocale('PT_br'), 'pt-BR')
  assert.equal(normalizeLocale('de-DE'), 'de')
})
