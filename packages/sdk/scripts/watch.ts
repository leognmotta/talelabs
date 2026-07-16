import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const apiSource = resolve(packageRoot, '../../apps/api/src')
const openRouterBuild = resolve(packageRoot, '../openrouter/dist')
const sdkConfig = resolve(packageRoot, 'kubb.config.ts')

let isGenerating = false
let pendingGeneration = false
let debounceTimer: ReturnType<typeof setTimeout> | undefined

function runGenerate() {
  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn('npm', ['run', 'generate'], {
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

async function generate() {
  if (isGenerating) {
    pendingGeneration = true
    return
  }

  isGenerating = true

  try {
    await runGenerate()
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
  watch(openRouterBuild, { recursive: true }, scheduleGenerate),
  watch(sdkConfig, scheduleGenerate),
]

console.log('Watching API OpenAPI sources for SDK generation.')

process.on('SIGINT', () => {
  for (const watcher of watchers)
    watcher.close()

  process.exit(0)
})
