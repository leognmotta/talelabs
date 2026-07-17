/** Produces the checked-in OpenAPI contract without rewriting identical output. */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(packageRoot, 'openapi.json')

async function readCurrentSpec() {
  try {
    return await readFile(outputPath, 'utf8')
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return null
    throw error
  }
}

/**
 * Writes the API's OpenAPI projection only when its serialized contract changed.
 *
 * @returns Whether the checked-in specification was updated.
 */
export async function writeOpenApiSpec(): Promise<boolean> {
  process.env.POSTGRES_URL ??= 'postgres://talelabs:talelabs@localhost:5432/talelabs'
  process.env.BETTER_AUTH_URL ??= 'http://localhost:5174'
  process.env.DASHBOARD_URL ??= 'http://localhost:5173'

  const { default: app } = await import('../../../apps/api/src/app.ts')
  const response = await app.request('/openapi.json')

  if (!response.ok)
    throw new Error(`Failed to generate OpenAPI spec: ${response.status}`)

  const serializedSpec = `${JSON.stringify(await response.json(), null, 2)}\n`
  if (await readCurrentSpec() === serializedSpec)
    return false

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, serializedSpec)
  return true
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  await writeOpenApiSpec()
