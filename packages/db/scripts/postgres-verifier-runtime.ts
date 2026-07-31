/**
 * Owns the isolated PostgreSQL container lifecycle for destructive verifiers.
 */

import { execFile } from 'node:child_process'
import process from 'node:process'

const POSTGRES_DATABASE = 'postgres'
const POSTGRES_IMAGE = 'postgres:17-alpine'
const POSTGRES_PASSWORD = 'talelabs-verifier'
const POSTGRES_USER = 'postgres'
const POSTGRES_READY_ATTEMPTS = 60
const POSTGRES_READY_INTERVAL_MS = 250
const DOCKER_COMMAND_TIMEOUT_MS = 120_000

/** Rejects a disposable database name that could escape quoted SQL identity. */
export function assertSafeDatabaseName(name: string) {
  if (!/^[a-z0-9_]+$/.test(name))
    throw new Error('unsafe_disposable_database_name')
}

/** Replaces only the database pathname on an administrative verifier URL. */
export function connectionStringForDatabase(
  adminConnectionString: string,
  databaseName: string,
) {
  assertSafeDatabaseName(databaseName)
  const value = new URL(adminConnectionString)
  value.pathname = `/${databaseName}`
  return value.toString()
}

function executeDocker(args: string[]) {
  return new Promise<string>((resolve, reject) => {
    execFile(
      'docker',
      args,
      {
        encoding: 'utf8',
        timeout: DOCKER_COMMAND_TIMEOUT_MS,
      },
      (error, stdout) => {
        if (error) {
          reject(error)
          return
        }
        resolve(stdout)
      },
    )
  })
}

function delay(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function waitForPostgres(containerName: string) {
  let lastError: unknown
  for (let attempt = 1; attempt <= POSTGRES_READY_ATTEMPTS; attempt += 1) {
    try {
      await executeDocker([
        'exec',
        containerName,
        'pg_isready',
        '--username',
        POSTGRES_USER,
        '--dbname',
        POSTGRES_DATABASE,
        '--host',
        '127.0.0.1',
      ])
      return
    }
    catch (error) {
      lastError = error
      await delay(POSTGRES_READY_INTERVAL_MS)
    }
  }
  throw new Error('Disposable PostgreSQL did not become ready.', {
    cause: lastError,
  })
}

function parsePublishedPort(output: string) {
  const match = output.match(/:(\d+)\s*$/m)
  if (!match?.[1])
    throw new Error('Docker did not publish the PostgreSQL port.')
  return match[1]
}

/**
 * Runs one verifier against a temporary PostgreSQL 17 container and removes it
 * before returning, without connecting to the configured application database.
 */
export async function withDisposablePostgres<T>(
  scope: string,
  verify: (adminConnectionString: string) => Promise<T>,
) {
  if (!/^[a-z][a-z0-9-]*$/.test(scope))
    throw new Error('PostgreSQL verifier scope is invalid.')

  const containerName = [
    'talelabs-postgres-verifier',
    scope,
    process.pid,
    Date.now(),
  ].join('-')
  let started = false
  let result: T | undefined
  let verificationError: unknown

  try {
    await executeDocker([
      'run',
      '--detach',
      '--name',
      containerName,
      '--env',
      `POSTGRES_DB=${POSTGRES_DATABASE}`,
      '--env',
      `POSTGRES_PASSWORD=${POSTGRES_PASSWORD}`,
      '--env',
      `POSTGRES_USER=${POSTGRES_USER}`,
      '--publish',
      '127.0.0.1::5432',
      POSTGRES_IMAGE,
    ])
    started = true
    await waitForPostgres(containerName)
    const port = parsePublishedPort(
      await executeDocker(['port', containerName, '5432/tcp']),
    )
    const adminConnectionString = [
      `postgres://${POSTGRES_USER}`,
      `:${encodeURIComponent(POSTGRES_PASSWORD)}`,
      `@127.0.0.1:${port}/${POSTGRES_DATABASE}`,
    ].join('')
    result = await verify(adminConnectionString)
  }
  catch (error) {
    verificationError = error
  }

  let cleanupError: unknown
  if (started) {
    try {
      await executeDocker(['rm', '--force', containerName])
    }
    catch (error) {
      cleanupError = error
    }
  }

  if (verificationError && cleanupError) {
    throw new AggregateError(
      [verificationError, cleanupError],
      'PostgreSQL verification and container cleanup both failed.',
    )
  }
  if (verificationError)
    throw verificationError
  if (cleanupError)
    throw cleanupError
  return result as T
}
