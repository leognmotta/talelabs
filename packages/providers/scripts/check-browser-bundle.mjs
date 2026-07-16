/**
 * Bundles public universal entry points for browsers and rejects Node imports.
 */

import { build } from 'esbuild'

const result = await build({
  bundle: true,
  entryPoints: ['scripts/browser-entry.ts'],
  format: 'esm',
  logLevel: 'silent',
  metafile: true,
  platform: 'browser',
  treeShaking: false,
  write: false,
})
const forbiddenInputs = Object.keys(result.metafile.inputs)
  .filter(path => path.startsWith('node:'))

if (forbiddenInputs.length > 0)
  throw new Error(`browser_provider_boundary_contains_node_builtins:${forbiddenInputs.join(',')}`)

console.log('Verified browser bundles for @talelabs/providers, /core, and /browser.')
