/** Opt-in watcher that regenerates the SDK only for changed API contracts. */

import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const apiSource = resolve(packageRoot, '../../apps/api/src')
const providersBuild = resolve(packageRoot, '../providers/dist')
const sdkConfig = resolve(packageRoot, 'kubb.config.ts')

let isGenerating = false
let pendingMode: GenerationMode | undefined
let scheduledMode: GenerationMode | undefined
let debounceTimer: ReturnType<typeof setTimeout> | undefined

type GenerationMode = 'force' | 'if-contract-changed'

function mergeGenerationModes(
  current: GenerationMode | undefined,
  incoming: GenerationMode,
): GenerationMode {
  return current === 'force' || incoming === 'force' ? 'force' : 'if-contract-changed'
}

function runGenerate(mode: GenerationMode) {
  return new Promise<void>((resolvePromise, reject) => {
    const args = mode === 'force'
      ? ['run', 'generate']
      : ['run', 'generate', '--', '--if-contract-changed']
    const child = spawn('npm', args, {
      cwd: packageRoot,
      shell: false,
      stdio: 'inherit',
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }

      reject(new Error(`SDK generation exited with ${code}`))
    })
  })
}

async function generate(mode: GenerationMode) {
  if (isGenerating) {
    pendingMode = mergeGenerationModes(pendingMode, mode)
    return
  }

  isGenerating = true

  try {
    await runGenerate(mode)
  }
  catch (error) {
    console.error(error)
  }
  finally {
    isGenerating = false

    if (pendingMode) {
      const nextMode = pendingMode
      pendingMode = undefined
      await generate(nextMode)
    }
  }
}

function scheduleGenerate(mode: GenerationMode) {
  scheduledMode = mergeGenerationModes(scheduledMode, mode)
  if (debounceTimer)
    clearTimeout(debounceTimer)

  debounceTimer = setTimeout(() => {
    const nextMode = scheduledMode ?? 'if-contract-changed'
    scheduledMode = undefined
    void generate(nextMode)
  }, 150)
}

await generate('force')

const watchers = [
  watch(apiSource, { recursive: true }, () => scheduleGenerate('if-contract-changed')),
  watch(providersBuild, { recursive: true }, () => scheduleGenerate('if-contract-changed')),
  watch(sdkConfig, () => scheduleGenerate('force')),
]

console.log('Watching API contract sources. Unchanged OpenAPI does not republish the SDK.')

process.on('SIGINT', () => {
  for (const watcher of watchers)
    watcher.close()

  process.exit(0)
})
