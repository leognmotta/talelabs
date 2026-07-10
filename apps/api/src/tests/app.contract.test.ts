import assert from 'node:assert/strict'
// Node's test runner keeps API contract tests dependency-free.
// eslint-disable-next-line test/no-import-node-test
import test, { after } from 'node:test'
import { destroyDb } from '@talelabs/db'

import app from '../app.js'

after(destroyDb)

test('M1 routes require authentication with the structured error contract', async () => {
  const paths = ['/brands', '/characters', '/products', '/projects']

  for (const path of paths) {
    const response = await app.request(path)

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      error: {
        code: 'unauthenticated',
        message: 'Authentication required',
      },
    })
  }
})

test('OpenAPI exposes brand characters and atomic character brand replacement', async () => {
  const response = await app.request('/openapi.json')
  const document = (await response.json()) as {
    paths: Record<
      string,
      {
        get?: unknown
        patch?: {
          requestBody?: {
            content?: {
              'application/json'?: {
                schema?: { $ref?: string }
              }
            }
          }
        }
      }
    >
    components?: {
      schemas?: Record<
        string,
        {
          properties?: Record<string, unknown>
        }
      >
    }
  }

  assert.ok(document.paths['/brands/{brandId}/characters']?.get)

  const updateReference
    = document.paths['/characters/{characterId}']?.patch?.requestBody?.content?.[
      'application/json'
    ]?.schema?.$ref
  const schemaName = updateReference?.split('/').at(-1)

  assert.ok(schemaName)
  assert.ok(document.components?.schemas?.[schemaName]?.properties?.brandIds)
})
