import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import app from '../../../apps/api/src/app.ts'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(packageRoot, 'openapi.json')

export async function writeOpenApiSpec() {
  const response = await app.request('/openapi.json')

  if (!response.ok)
    throw new Error(`Failed to generate OpenAPI spec: ${response.status}`)

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(await response.json(), null, 2)}\n`)
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  await writeOpenApiSpec()
