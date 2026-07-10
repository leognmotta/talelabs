import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const locales = ['en', 'pt-BR', 'pt-PT', 'es', 'fr', 'de', 'it', 'nl', 'pl', 'ro']

function readCatalog(locale) {
  return JSON.parse(readFileSync(
    join(packageRoot, 'src', 'catalogs', locale, 'dashboard.json'),
    'utf8',
  ))
}

function flatten(value, prefix = '', entries = new Map()) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key

    if (typeof child === 'string')
      entries.set(path, child)
    else if (child && typeof child === 'object' && !Array.isArray(child))
      flatten(child, path, entries)
    else
      throw new TypeError(`Catalog value at ${path} must be a string or object.`)
  }

  return entries
}

function placeholders(message) {
  return [...message.matchAll(/\{\{([^}]+)\}\}/g)]
    .map(match => match[1]?.split(',')[0]?.trim())
    .sort()
    .join(',')
}

const source = flatten(readCatalog('en'))
let hasError = false
const invariantMessages = new Map([
  ['common.appName', 'TaleLabs'],
])
const localizedTerms = {
  'de': { 'navigation.assets': 'Dateien' },
  'es': { 'navigation.assets': 'Archivos' },
  'fr': { 'navigation.assets': 'Fichiers' },
  'it': { 'navigation.assets': 'File' },
  'nl': { 'navigation.assets': 'Bestanden' },
  'pl': { 'navigation.assets': 'Pliki' },
  'pt-BR': { 'navigation.assets': 'Arquivos' },
  'pt-PT': { 'navigation.assets': 'Ficheiros' },
  'ro': { 'navigation.assets': 'Fișiere' },
}

for (const locale of locales.slice(1)) {
  const catalog = flatten(readCatalog(locale))

  for (const key of source.keys()) {
    if (!catalog.has(key)) {
      console.error(`${locale}: missing key ${key}`)
      hasError = true
    }
  }

  for (const [key, expected] of invariantMessages) {
    if (catalog.get(key) !== expected) {
      console.error(`${locale}: ${key} must remain exactly ${expected}`)
      hasError = true
    }
  }

  for (const [key, expected] of Object.entries(localizedTerms[locale])) {
    if (catalog.get(key) !== expected) {
      console.error(`${locale}: ${key} must use the approved term ${expected}`)
      hasError = true
    }
  }

  for (const [key, message] of catalog) {
    const sourceMessage = source.get(key)

    if (!sourceMessage) {
      console.error(`${locale}: unknown key ${key}`)
      hasError = true
      continue
    }

    if (placeholders(message) !== placeholders(sourceMessage)) {
      console.error(`${locale}: interpolation mismatch at ${key}`)
      hasError = true
    }
  }

  const coverage = Math.round((catalog.size / source.size) * 100)
  console.log(`${locale}: ${catalog.size}/${source.size} translated (${coverage}%)`)
}

if (hasError)
  process.exitCode = 1
