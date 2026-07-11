import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'
import process from 'node:process'

import { config } from 'dotenv'

const envFiles = [
  '.env',
  '.env.development',
  '.env.local',
  '.env.development.local',
  'dev.vars',
]

function findUp(filename, startDir = process.cwd()) {
  let currentDir = startDir

  while (true) {
    const candidate = join(currentDir, filename)

    if (existsSync(candidate))
      return candidate

    const parentDir = dirname(currentDir)

    if (parentDir === currentDir || currentDir === parse(currentDir).root)
      return undefined

    currentDir = parentDir
  }
}

for (const filename of envFiles) {
  const path = findUp(filename)
  if (path)
    config({ override: filename !== '.env', path, quiet: true })
}

const secretKey = process.env.TRIGGER_SECRET_KEY
const projectRef = process.env.TRIGGER_PROJECT_REF
const problems = []

if (!projectRef?.startsWith('proj_'))
  problems.push('TRIGGER_PROJECT_REF must be configured.')

if (!secretKey?.startsWith('tr_dev_'))
  problems.push('TRIGGER_SECRET_KEY must use the project\'s tr_dev_ key, not a production key.')

if (process.argv.includes('--worker')) {
  const binaries = [
    process.env.FFMPEG_PATH ?? 'ffmpeg',
    process.env.FFPROBE_PATH ?? 'ffprobe',
  ]

  for (const binary of binaries) {
    if (spawnSync(binary, ['-version'], { stdio: 'ignore' }).status !== 0)
      problems.push(`${binary} must be installed and available to the local Trigger worker.`)
  }
}

if (problems.length > 0)
  throw new Error(`Trigger.dev development prerequisites failed:\n- ${problems.join('\n- ')}`)
