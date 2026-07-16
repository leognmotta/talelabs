import { existsSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'
import process from 'node:process'
import { config } from 'dotenv'

function findUp(filename: string, startDir = process.cwd()) {
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

const developmentEnvFiles = [
  '.env',
  '.env.development',
  '.env.local',
  '.env.development.local',
  'dev.vars',
]
const envFiles = process.env.NODE_ENV === 'development'
  ? developmentEnvFiles
  : ['.env']

for (const filename of envFiles) {
  const envPath = findUp(filename)
  if (envPath)
    config({ override: filename !== '.env', path: envPath })
}
