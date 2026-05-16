import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { FileMigrationProvider, Migrator } from 'kysely'

import { db, destroyDb } from './index.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(dirname, 'migrations'),
    }),
  })

  const { error, results } = await migrator.migrateToLatest()

  for (const result of results ?? []) {
    if (result.status === 'Success')
      console.log(`migration "${result.migrationName}" was executed successfully`)
    else if (result.status === 'Error')
      console.error(`failed to execute migration "${result.migrationName}"`)
  }

  await destroyDb()

  if (error) {
    console.error('failed to migrate')
    console.error(error)
    process.exitCode = 1
  }
}

void main()
