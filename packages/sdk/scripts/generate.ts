/** Generates and content-stably publishes the checked-in TaleLabs SDK. */

import { spawn } from 'node:child_process'
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
} from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as wait } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { writeOpenApiSpec } from './write-openapi.js'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lockParent = resolve(packageRoot, '../../node_modules/.cache')
const lockPath = resolve(lockParent, 'talelabs-sdk-generate.lock')
const generatedPath = resolve(packageRoot, 'src/gen')
const staleLockAgeMs = 120_000

interface PublishStats {
  added: number
  removed: number
  unchanged: number
  updated: number
}

async function acquireGenerationLock() {
  await mkdir(lockParent, { recursive: true })
  let announcedWait = false

  while (true) {
    try {
      await mkdir(lockPath)
      return
    }
    catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST')
        throw error

      const lock = await stat(lockPath).catch(() => null)
      if (lock && Date.now() - lock.mtimeMs > staleLockAgeMs) {
        await rm(lockPath, { force: true, recursive: true })
        continue
      }

      if (!announcedWait) {
        console.log('Waiting for another SDK generation to finish.')
        announcedWait = true
      }
      await wait(100)
    }
  }
}

function runKubbGenerateOnce(stagingPath: string, showDiagnostics: boolean) {
  return new Promise<number>((resolvePromise, reject) => {
    const args = ['generate', '--config', 'kubb.config.ts']
    if (!showDiagnostics)
      args.push('--silent')

    const child = spawn('kubb', args, {
      cwd: packageRoot,
      env: {
        ...process.env,
        TALELABS_SDK_OUTPUT_PATH: stagingPath,
      },
      shell: true,
      stdio: 'inherit',
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      resolvePromise(code ?? 1)
    })
  })
}

async function runKubbGenerate(stagingPath: string) {
  const maxAttempts = 3

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const code = await runKubbGenerateOnce(stagingPath, attempt === maxAttempts)
    if (code === 0)
      return

    if (attempt < maxAttempts) {
      console.warn(`Kubb generation did not complete; retrying (${attempt}/${maxAttempts}).`)
      await wait(attempt * 200)
    }
  }

  throw new Error(`Kubb generation failed after ${maxAttempts} attempts.`)
}

async function copyGeneratedTree(
  source: string,
  destination: string,
  stats: PublishStats,
) {
  await mkdir(destination, { recursive: true })
  const entries = await readdir(source, { withFileTypes: true })
  const orderedEntries = entries.toSorted((left, right) => {
    if (left.name === 'index.ts')
      return 1
    if (right.name === 'index.ts')
      return -1
    return left.name.localeCompare(right.name)
  })

  for (const entry of orderedEntries) {
    const sourceEntry = join(source, entry.name)
    const destinationEntry = join(destination, entry.name)
    const destinationStat = await stat(destinationEntry).catch(() => null)

    if (entry.isDirectory()) {
      if (destinationStat && !destinationStat.isDirectory())
        await rm(destinationEntry, { force: true })
      await copyGeneratedTree(sourceEntry, destinationEntry, stats)
      continue
    }

    if (destinationStat?.isDirectory()) {
      await rm(destinationEntry, { force: true, recursive: true })
      stats.removed += 1
    }

    if (destinationStat?.isFile()) {
      const [sourceContent, destinationContent] = await Promise.all([
        readFile(sourceEntry),
        readFile(destinationEntry),
      ])
      if (sourceContent.equals(destinationContent)) {
        stats.unchanged += 1
        continue
      }
      stats.updated += 1
    }
    else {
      stats.added += 1
    }

    await copyFile(sourceEntry, destinationEntry)
  }
}

async function removeStaleGeneratedEntries(
  source: string,
  destination: string,
  stats: PublishStats,
) {
  const sourceNames = new Set((await readdir(source)).map(name => name))
  const destinationEntries = await readdir(destination, { withFileTypes: true })

  for (const entry of destinationEntries) {
    const destinationEntry = join(destination, entry.name)
    if (!sourceNames.has(entry.name)) {
      await rm(destinationEntry, { force: true, recursive: true })
      stats.removed += 1
      continue
    }

    if (entry.isDirectory())
      await removeStaleGeneratedEntries(join(source, entry.name), destinationEntry, stats)
  }
}

async function publishGeneratedTree(stagingPath: string) {
  const stats: PublishStats = {
    added: 0,
    removed: 0,
    unchanged: 0,
    updated: 0,
  }
  await copyGeneratedTree(stagingPath, generatedPath, stats)
  await removeStaleGeneratedEntries(stagingPath, generatedPath, stats)
  return stats
}

async function generatedTreeExists() {
  return (await stat(generatedPath).catch(() => null))?.isDirectory() === true
}

async function generateSdk() {
  await acquireGenerationLock()

  const stagingPath = resolve(packageRoot, `src/.gen-${process.pid}`)

  try {
    await rm(stagingPath, { force: true, recursive: true })
    const contractChanged = await writeOpenApiSpec()
    const generateOnlyForContractChange = process.argv.includes('--if-contract-changed')

    if (generateOnlyForContractChange && !contractChanged && await generatedTreeExists()) {
      console.log('OpenAPI contract unchanged; SDK generation skipped.')
      return
    }

    await runKubbGenerate(stagingPath)
    const stats = await publishGeneratedTree(stagingPath)
    console.log(
      `SDK publication: ${stats.added} added, ${stats.updated} updated, ${stats.removed} removed, ${stats.unchanged} unchanged.`,
    )
  }
  finally {
    await rm(stagingPath, { force: true, recursive: true })
    await rm(lockPath, { force: true, recursive: true })
  }
}

await generateSdk()
