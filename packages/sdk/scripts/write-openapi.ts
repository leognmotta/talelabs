import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(packageRoot, 'openapi.json')

export async function writeOpenApiSpec() {
  process.env.POSTGRES_URL ??= 'postgres://talelabs:talelabs@localhost:5432/talelabs'
  process.env.BETTER_AUTH_URL ??= 'http://localhost:5174'
  process.env.DASHBOARD_URL ??= 'http://localhost:5173'

  const { default: app } = await import('../../../apps/api/src/app.ts')
  const response = await app.request('/openapi.json')

  if (!response.ok)
    throw new Error(`Failed to generate OpenAPI spec: ${response.status}`)

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(await response.json(), null, 2)}\n`)
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  await writeOpenApiSpec()
