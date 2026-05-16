import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { writeOpenApiSpec } from './write-openapi.ts'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const apiSource = resolve(packageRoot, '../../apps/api/src')
const sdkConfig = resolve(packageRoot, 'kubb.config.ts')

let isGenerating = false
let pendingGeneration = false
let debounceTimer: ReturnType<typeof setTimeout> | undefined

function runKubbGenerate() {
  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn('kubb', ['generate', '--config', 'kubb.config.ts'], {
      cwd: packageRoot,
      shell: true,
      stdio: 'inherit',
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }

      reject(new Error(`kubb generate exited with ${code}`))
    })
  })
}

async function generate() {
  if (isGenerating) {
    pendingGeneration = true
    return
  }

  isGenerating = true

  try {
    await writeOpenApiSpec()
    await runKubbGenerate()
  }
  catch (error) {
    console.error(error)
  }
  finally {
    isGenerating = false

    if (pendingGeneration) {
      pendingGeneration = false
      await generate()
    }
  }
}

function scheduleGenerate() {
  if (debounceTimer)
    clearTimeout(debounceTimer)

  debounceTimer = setTimeout(() => {
    void generate()
  }, 150)
}

await generate()

const watchers = [
  watch(apiSource, { recursive: true }, scheduleGenerate),
  watch(sdkConfig, scheduleGenerate),
]

console.log('Watching API OpenAPI sources for SDK generation.')

process.on('SIGINT', () => {
  for (const watcher of watchers)
    watcher.close()

  process.exit(0)
})
