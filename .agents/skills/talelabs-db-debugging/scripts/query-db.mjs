#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'
import process from 'node:process'
import { stdin } from 'node:process'
import { config } from 'dotenv'
import pg from 'pg'

const { Pool } = pg

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

function readStdin() {
  if (stdin.isTTY)
    return Promise.resolve('')

  return new Promise((resolve, reject) => {
    let body = ''

    stdin.setEncoding('utf8')
    stdin.on('data', chunk => body += chunk)
    stdin.on('error', reject)
    stdin.on('end', () => resolve(body))
  })
}

function assertReadOnly(sql) {
  const normalized = sql.trim().replace(/^\/\*[\s\S]*?\*\//, '').trim().toLowerCase()
  const allowed = ['select', 'with', 'show', 'explain']

  if (!allowed.some(prefix => normalized.startsWith(prefix))) {
    throw new Error(
      'Refusing to run non-read-only SQL. Ask the user for explicit approval before database mutations.',
    )
  }
}

const envPath = findUp('.env')

if (envPath)
  config({ path: envPath })

const query = (process.argv.slice(2).join(' ') || await readStdin()).trim()

if (!query) {
  throw new Error(
    'Provide SQL as an argument or on stdin. Example: node .agents/skills/talelabs-db-debugging/scripts/query-db.mjs "select now()"',
  )
}

assertReadOnly(query)

if (!process.env.POSTGRES_URL)
  throw new Error('POSTGRES_URL is required in the root .env file.')

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})

try {
  const result = await pool.query(query)
  console.log(JSON.stringify(result.rows, null, 2))
}
finally {
  await pool.end()
}
