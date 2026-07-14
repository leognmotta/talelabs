import type { Database, JsonValue } from '@talelabs/db'
import type { ElementReferenceKind } from '@talelabs/elements'
import type { Transaction } from 'kysely'

import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { FileMigrationProvider, Migrator } from 'kysely'

type BudgetValidator = (executor: Transaction<Database>) => Promise<void>

interface ElementFixture {
  folderId: string
  id: string
  organizationId: string
}

interface FixtureScope {
  organizationId: string
  userId: string
}

const SCRIPT_NAME = 'M4.5 Element consistency invariant verification'
const CONCURRENCY_TIMEOUT_MS = 20_000
const verificationSchema = `m45_verify_${randomUUID().replaceAll('-', '')}`

function findUp(filename: string, startDirectory = process.cwd()) {
  let currentDirectory = path.resolve(startDirectory)
  while (true) {
    const candidate = path.join(currentDirectory, filename)
    if (existsSync(candidate))
      return candidate
    const parentDirectory = path.dirname(currentDirectory)
    if (parentDirectory === currentDirectory)
      return null
    currentDirectory = parentDirectory
  }
}

function configureVerificationDatabase(schemaName: string) {
  const envPath = findUp('.env')
  if (envPath)
    process.loadEnvFile(envPath)

  if (process.env.NODE_ENV === 'production')
    throw new Error(`${SCRIPT_NAME} refuses to run with NODE_ENV=production.`)

  const value = process.env.TEST_POSTGRES_URL
  if (!value) {
    throw new Error(
      `${SCRIPT_NAME} requires TEST_POSTGRES_URL. It never falls back to POSTGRES_URL.`,
    )
  }

  const url = new URL(value)
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('TEST_POSTGRES_URL must use the postgres protocol.')

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!databaseName || !databaseName.toLowerCase().includes('test')) {
    throw new Error(
      'TEST_POSTGRES_URL must name an isolated database containing "test" in its name.',
    )
  }

  const applicationUrl = process.env.POSTGRES_URL
  if (applicationUrl && new URL(applicationUrl).toString() === url.toString()) {
    throw new Error(
      'TEST_POSTGRES_URL must not be the same database as POSTGRES_URL.',
    )
  }

  // Every connection used by the concurrent lock check fails closed instead of
  // waiting indefinitely if the global lock hierarchy regresses.
  const existingOptions = url.searchParams.get('options') ?? ''
  url.searchParams.set(
    'options',
    `${existingOptions} -c search_path=${schemaName},public -c statement_timeout=15000 -c lock_timeout=5000`.trim(),
  )
  process.env.POSTGRES_URL = url.toString()
}

function uniqueId(label: string) {
  return `m45-${label}-${randomUUID()}`
}

function asJson(value: unknown) {
  return value as JsonValue
}

function isDatabaseError(
  value: unknown,
): value is { code?: string, constraint?: string } {
  return Boolean(value) && typeof value === 'object'
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number) {
  let timeout: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(
          `Concurrent lock check exceeded ${milliseconds}ms.`,
        )), milliseconds)
      }),
    ])
  }
  finally {
    if (timeout)
      clearTimeout(timeout)
  }
}

configureVerificationDatabase(verificationSchema)

async function main() {
  const [{ db, destroyDb, sql }, elementContracts] = await Promise.all([
    import('@talelabs/db'),
    import('@talelabs/elements'),
  ])
  const {
    createElementAssetLinkRow,
    updateElementAssetLinkRow,
  } = await import('../src/data/element-asset-links.data.js')
  const {
    insertUploadedAsset,
    requestAssetPurgeInTransaction,
  } = await import('../src/data/assets.data.js')
  const { lockFlowReferenceBudget } = await import(
    '../src/data/flow-reference-budget.data.js',
  )
  const { buildElementContext } = await import(
    '../src/domain/elements/build-element-context.js',
  )
  const { assertElementFlowReferenceBudgets } = await import(
    '../src/services/flow-reference-budget.js',
  )
  const { persistUploadedAssetRegistration } = await import(
    '../src/services/upload-registration-persistence.service.js',
  )

  const fixtureScopes: FixtureScope[] = []
  let passedChecks = 0
  let primaryFailure: unknown
  let schemaCreated = false

  const verify = async (name: string, check: () => Promise<void>) => {
    await check()
    passedChecks += 1
    console.log(`PASS ${name}`)
  }

  const createMigrator = () => {
    const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
    return new Migrator({
      db,
      provider: new FileMigrationProvider({
        fs,
        path,
        migrationFolder: path.resolve(
          scriptDirectory,
          '../../../packages/db/src/migrations',
        ),
      }),
    })
  }

  const assertMigrationResult = (
    result: Awaited<ReturnType<Migrator['migrateToLatest']>>,
  ) => {
    const { error, results } = result
    if (error)
      throw error
    const failed = results?.find(result => result.status === 'Error')
    if (failed)
      throw new Error(`Migration ${failed.migrationName} failed.`)
  }

  const createScope = async (): Promise<FixtureScope> => {
    const organizationId = uniqueId('organization')
    const userId = uniqueId('user')
    const now = new Date()
    await db.insertInto('user').values({
      banned: false,
      banExpires: null,
      banReason: null,
      email: `${userId}@example.invalid`,
      emailVerified: false,
      id: userId,
      image: null,
      locale: null,
      name: 'M4.5 verification user',
      role: 'user',
    }).execute()
    await db.insertInto('organization').values({
      createdAt: now,
      id: organizationId,
      logo: null,
      metadata: null,
      name: 'M4.5 verification organization',
      slug: organizationId,
    }).execute()
    fixtureScopes.push({ organizationId, userId })
    return { organizationId, userId }
  }

  const createElement = async (
    scope: FixtureScope,
    input: {
      data?: unknown
      name?: string
      schemaVersion?: number
      type?: 'product'
    } = {},
  ): Promise<ElementFixture> => {
    const id = uniqueId('element')
    const folderId = uniqueId('folder')
    const type = input.type ?? 'product'
    const schemaVersion = input.schemaVersion
      ?? elementContracts.getElementTypeDefinition(type).currentVersion
    const data = input.data ?? elementContracts.parseElementData(type, {})
    await db.insertInto('folders').values({
      id: folderId,
      name: `${input.name ?? 'Verification Element'} references`,
      organizationId: scope.organizationId,
      parentId: null,
    }).execute()
    await db.insertInto('elements').values({
      assetFolderId: folderId,
      createdBy: scope.userId,
      data: asJson(data),
      id,
      instructions: null,
      name: input.name ?? 'Verification Element',
      organizationId: scope.organizationId,
      schemaVersion,
      type,
    }).execute()
    return { folderId, id, organizationId: scope.organizationId }
  }

  const createReadyImage = async (
    scope: FixtureScope,
    element: ElementFixture,
    label: string,
  ) => {
    const id = uniqueId(`asset-${label}`)
    await db.insertInto('assets').values({
      createdBy: scope.userId,
      folderId: element.folderId,
      id,
      mimeType: 'image/png',
      name: `${label}.png`,
      organizationId: scope.organizationId,
      processingState: 'ready',
      sizeBytes: 1,
      source: 'upload',
      storageKey: `verification/${id}.png`,
      type: 'image',
      uploadId: null,
    }).execute()
    return id
  }

  const seedLink = async (input: {
    assetId: string
    elementId: string
    isPrimary?: boolean
    organizationId: string
    referenceKind?: ElementReferenceKind
    referenceMetadata?: unknown
    role?: string
    sortOrder?: number
  }) => {
    await db.insertInto('elementAssets').values({
      assetId: input.assetId,
      elementId: input.elementId,
      isPrimary: input.isPrimary ?? false,
      organizationId: input.organizationId,
      ...(input.referenceKind
        ? { referenceKind: input.referenceKind }
        : {}),
      ...(input.referenceMetadata === undefined
        ? {}
        : { referenceMetadata: asJson(input.referenceMetadata) }),
      role: input.role ?? 'packshot',
      sortOrder: input.sortOrder ?? 0,
    }).execute()
  }

  const realBudgetValidator = (
    organizationId: string,
    elementId: string,
  ): BudgetValidator => executor => assertElementFlowReferenceBudgets(executor, {
    elementId,
    organizationId,
  })

  try {
    await sql`create schema ${sql.id(verificationSchema)}`.execute(db)
    schemaCreated = true
    const activeSchema = await sql<{ schema: null | string }>`
      select current_schema() as "schema"
    `.execute(db)
    assert.equal(activeSchema.rows[0]?.schema, verificationSchema)

    const migrator = createMigrator()
    assertMigrationResult(
      await migrator.migrateTo('007_element_asset_folders'),
    )
    const primary = await createScope()
    const foreign = await createScope()
    const historicalElement = await createElement(primary, {
      data: { description: 'Historical data', sellingPoints: [] },
      schemaVersion: 1,
    })
    const historicalAssetId = await createReadyImage(
      primary,
      historicalElement,
      'migration-existing-row',
    )
    // This row has exactly the pre-M4.5 shape. Migration 008 must preserve it
    // and surface it as a master with empty relationship metadata.
    await seedLink({
      assetId: historicalAssetId,
      elementId: historicalElement.id,
      organizationId: primary.organizationId,
    })
    assertMigrationResult(await migrator.migrateToLatest())

    await verify('migration defaults and sequential identity compatibility', async () => {
      const applied = await sql<{ name: string }>`
        select "name"
        from "kysely_migration"
        where "name" = '008_element_consistency'
      `.execute(db)
      assert.equal(
        applied.rows.length,
        1,
        'The additive Element consistency migration must be applied.',
      )
      const columns = await sql<{
        columnDefault: null | string
        columnName: string
        isNullable: 'NO' | 'YES'
      }>`
        select
          "column_name" as "columnName",
          "column_default" as "columnDefault",
          "is_nullable" as "isNullable"
        from information_schema.columns
        where table_schema = current_schema()
          and table_name = 'elementAssets'
          and column_name in ('referenceKind', 'referenceMetadata')
      `.execute(db)
      const byName = new Map(columns.rows.map(column => [column.columnName, column]))
      assert.equal(byName.get('referenceKind')?.isNullable, 'NO')
      assert.match(byName.get('referenceKind')?.columnDefault ?? '', /master/)
      assert.equal(byName.get('referenceMetadata')?.isNullable, 'NO')
      assert.match(byName.get('referenceMetadata')?.columnDefault ?? '', /\{\}/)

      const stored = await db.selectFrom('elementAssets')
        .select(['referenceKind', 'referenceMetadata'])
        .where('organizationId', '=', primary.organizationId)
        .where('elementId', '=', historicalElement.id)
        .where('assetId', '=', historicalAssetId)
        .executeTakeFirstOrThrow()
      assert.equal(stored.referenceKind, 'master')
      assert.deepEqual(stored.referenceMetadata, {})

      const upcasted = elementContracts.upcastElementData(
        'product',
        1,
        { description: 'Historical data', sellingPoints: [] },
      )
      assert.equal(upcasted.schemaVersion, 2)
      assert.deepEqual(upcasted.data.identity, {
        avoid: [],
        mayVary: [],
        mustKeep: [],
        summary: '',
      })
    })

    await verify('PostgreSQL rejects a primary source', async () => {
      const element = await createElement(primary)
      const assetId = await createReadyImage(primary, element, 'primary-source')
      await assert.rejects(
        seedLink({
          assetId,
          elementId: element.id,
          isPrimary: true,
          organizationId: primary.organizationId,
          referenceKind: 'source',
        }),
        (error: unknown) => {
          assert.ok(isDatabaseError(error))
          assert.equal(error.code, '23514')
          assert.equal(error.constraint, 'elementAssetsSourceNotPrimaryCheck')
          return true
        },
      )
    })

    await verify('source attachment and element-wide source capacity', async () => {
      assert.equal(elementContracts.ELEMENT_SOURCE_CAPACITY, 50)
      const element = await createElement(primary)
      const firstAssetId = await createReadyImage(primary, element, 'source-0')
      const first = await createElementAssetLinkRow({
        assetId: firstAssetId,
        elementId: element.id,
        isPrimary: false,
        organizationId: primary.organizationId,
        referenceKind: 'source',
        referenceMetadata: {},
        role: 'packshot',
        validateFlowReferenceBudgets: realBudgetValidator(
          primary.organizationId,
          element.id,
        ),
      })
      assert.equal(first.status, 'created')

      for (let index = 1; index < elementContracts.ELEMENT_SOURCE_CAPACITY; index += 1) {
        const assetId = await createReadyImage(primary, element, `source-${index}`)
        await seedLink({
          assetId,
          elementId: element.id,
          organizationId: primary.organizationId,
          referenceKind: 'source',
          role: 'packshot',
          sortOrder: index,
        })
      }

      const overflowAssetId = await createReadyImage(primary, element, 'source-overflow')
      const overflow = await createElementAssetLinkRow({
        assetId: overflowAssetId,
        elementId: element.id,
        isPrimary: false,
        organizationId: primary.organizationId,
        referenceKind: 'source',
        referenceMetadata: {},
        role: 'detail',
        validateFlowReferenceBudgets: realBudgetValidator(
          primary.organizationId,
          element.id,
        ),
      })
      assert.equal(overflow.status, 'element_source_capacity_reached')
      const count = await db.selectFrom('elementAssets')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('organizationId', '=', primary.organizationId)
        .where('elementId', '=', element.id)
        .where('referenceKind', '=', 'source')
        .executeTakeFirstOrThrow()
      assert.equal(Number(count.count), elementContracts.ELEMENT_SOURCE_CAPACITY)
    })

    await verify('master capacity and promotion rollback', async () => {
      const element = await createElement(primary)
      const data = elementContracts.parseElementData('product', {})
      const role = elementContracts.getElementAssetRole('product', 'packshot', data)
      assert.ok(role)
      assert.equal(role.maxAssets, 8)

      for (let index = 0; index < role.maxAssets - 1; index += 1) {
        const assetId = await createReadyImage(primary, element, `master-${index}`)
        await seedLink({
          assetId,
          elementId: element.id,
          organizationId: primary.organizationId,
          referenceKind: 'master',
          sortOrder: index,
        })
      }
      const promotableId = await createReadyImage(primary, element, 'promotable')
      await seedLink({
        assetId: promotableId,
        elementId: element.id,
        organizationId: primary.organizationId,
        referenceKind: 'source',
      })
      const promoted = await updateElementAssetLinkRow({
        assetId: promotableId,
        elementId: element.id,
        organizationId: primary.organizationId,
        referenceKind: 'master',
        role: 'packshot',
        sortOrder: role.maxAssets - 1,
        validateFlowReferenceBudgets: realBudgetValidator(
          primary.organizationId,
          element.id,
        ),
      })
      assert.equal(promoted.status, 'updated')

      const blockedId = await createReadyImage(primary, element, 'blocked-promotion')
      await seedLink({
        assetId: blockedId,
        elementId: element.id,
        organizationId: primary.organizationId,
        referenceKind: 'source',
        sortOrder: 0,
      })
      const blocked = await updateElementAssetLinkRow({
        assetId: blockedId,
        elementId: element.id,
        organizationId: primary.organizationId,
        referenceKind: 'master',
        role: 'packshot',
        validateFlowReferenceBudgets: realBudgetValidator(
          primary.organizationId,
          element.id,
        ),
      })
      assert.equal(blocked.status, 'element_master_role_capacity_reached')
      const unchanged = await db.selectFrom('elementAssets')
        .select(['referenceKind', 'sortOrder'])
        .where('organizationId', '=', primary.organizationId)
        .where('elementId', '=', element.id)
        .where('assetId', '=', blockedId)
        .where('role', '=', 'packshot')
        .executeTakeFirstOrThrow()
      assert.equal(unchanged.referenceKind, 'source')
      assert.equal(unchanged.sortOrder, 0)
    })

    await verify('primary demotion clears primary and normalizes both orders', async () => {
      const element = await createElement(primary)
      const primaryId = await createReadyImage(primary, element, 'demote-primary')
      const remainingId = await createReadyImage(primary, element, 'demote-remaining')
      const sourceId = await createReadyImage(primary, element, 'demote-source')
      await seedLink({
        assetId: primaryId,
        elementId: element.id,
        isPrimary: true,
        organizationId: primary.organizationId,
        referenceKind: 'master',
        sortOrder: 0,
      })
      await seedLink({
        assetId: remainingId,
        elementId: element.id,
        organizationId: primary.organizationId,
        referenceKind: 'master',
        sortOrder: 1,
      })
      await seedLink({
        assetId: sourceId,
        elementId: element.id,
        organizationId: primary.organizationId,
        referenceKind: 'source',
        sortOrder: 0,
      })

      const demoted = await updateElementAssetLinkRow({
        assetId: primaryId,
        elementId: element.id,
        organizationId: primary.organizationId,
        referenceKind: 'source',
        role: 'packshot',
        sortOrder: 1,
        validateFlowReferenceBudgets: realBudgetValidator(
          primary.organizationId,
          element.id,
        ),
      })
      assert.equal(demoted.status, 'updated')
      if (demoted.status !== 'updated')
        assert.fail('The primary master was not demoted.')
      assert.equal(demoted.isPrimary, false)

      const links = await db.selectFrom('elementAssets')
        .select(['assetId', 'isPrimary', 'referenceKind', 'sortOrder'])
        .where('organizationId', '=', primary.organizationId)
        .where('elementId', '=', element.id)
        .where('role', '=', 'packshot')
        .orderBy('referenceKind')
        .orderBy('sortOrder')
        .execute()
      assert.deepEqual(
        links.filter(link => link.referenceKind === 'master')
          .map(link => [link.assetId, link.sortOrder, link.isPrimary]),
        [[remainingId, 0, false]],
      )
      assert.deepEqual(
        links.filter(link => link.referenceKind === 'source')
          .map(link => [link.assetId, link.sortOrder, link.isPrimary]),
        [[sourceId, 0, false], [primaryId, 1, false]],
      )
    })

    await verify('organization scope fails closed', async () => {
      const localElement = await createElement(primary)
      const foreignElement = await createElement(foreign)
      const foreignAssetId = await createReadyImage(
        foreign,
        foreignElement,
        'foreign-asset',
      )
      const result = await createElementAssetLinkRow({
        assetId: foreignAssetId,
        elementId: localElement.id,
        isPrimary: false,
        organizationId: primary.organizationId,
        referenceKind: 'master',
        referenceMetadata: {},
        role: 'packshot',
        validateFlowReferenceBudgets: realBudgetValidator(
          primary.organizationId,
          localElement.id,
        ),
      })
      assert.equal(result.status, 'asset_not_found')
      const leaked = await db.selectFrom('elementAssets')
        .select('assetId')
        .where('organizationId', '=', primary.organizationId)
        .where('elementId', '=', localElement.id)
        .where('assetId', '=', foreignAssetId)
        .executeTakeFirst()
      assert.equal(leaked, undefined)
    })

    await verify('registry rejects unknown reference metadata atomically', async () => {
      const element = await createElement(primary)
      const assetId = await createReadyImage(primary, element, 'invalid-metadata')
      const result = await createElementAssetLinkRow({
        assetId,
        elementId: element.id,
        isPrimary: false,
        organizationId: primary.organizationId,
        referenceKind: 'master',
        referenceMetadata: { unrecognized: true },
        role: 'packshot',
        validateFlowReferenceBudgets: realBudgetValidator(
          primary.organizationId,
          element.id,
        ),
      })
      assert.equal(result.status, 'invalid_reference_metadata')
      const stored = await db.selectFrom('elementAssets')
        .select('assetId')
        .where('organizationId', '=', primary.organizationId)
        .where('elementId', '=', element.id)
        .where('assetId', '=', assetId)
        .executeTakeFirst()
      assert.equal(stored, undefined)
    })

    await verify('uploaded Asset and default master link commit atomically', async () => {
      const element = await createElement(primary)
      const assetId = uniqueId('uploaded-asset')
      const uploadId = uniqueId('upload')
      const result = await insertUploadedAsset({
        createdBy: primary.userId,
        elementId: element.id,
        folderId: null,
        id: assetId,
        mimeType: 'image/png',
        name: 'atomic-upload.png',
        organizationId: primary.organizationId,
        role: 'packshot',
        sizeBytes: 10,
        storageKey: `verification/${assetId}.png`,
        type: 'image',
        uploadId,
        validateFlowReferenceBudgets: realBudgetValidator(
          primary.organizationId,
          element.id,
        ),
      })
      assert.equal(result.status, 'created')
      const [asset, link] = await Promise.all([
        db.selectFrom('assets')
          .select(['folderId', 'id'])
          .where('organizationId', '=', primary.organizationId)
          .where('id', '=', assetId)
          .executeTakeFirstOrThrow(),
        db.selectFrom('elementAssets')
          .select(['referenceKind', 'referenceMetadata'])
          .where('organizationId', '=', primary.organizationId)
          .where('elementId', '=', element.id)
          .where('assetId', '=', assetId)
          .where('role', '=', 'packshot')
          .executeTakeFirstOrThrow(),
      ])
      assert.equal(asset.folderId, element.folderId)
      assert.equal(link.referenceKind, 'master')
      assert.deepEqual(link.referenceMetadata, {})
    })

    await verify('same-grant concurrent registration reconciles the requested Element link', async () => {
      const element = await createElement(primary)
      const uploadId = uniqueId('concurrent-upload')
      const winningAssetId = uniqueId('concurrent-upload-winner')
      const losingAssetId = uniqueId('concurrent-upload-loser')
      let releaseBudgetLock!: () => void
      let markBudgetLockAcquired!: () => void
      const budgetLockCanRelease = new Promise<void>((resolve) => {
        releaseBudgetLock = resolve
      })
      const budgetLockAcquired = new Promise<void>((resolve) => {
        markBudgetLockAcquired = resolve
      })
      const heldBudgetLock = db.transaction().execute(async (trx) => {
        await lockFlowReferenceBudget(trx, primary.organizationId)
        markBudgetLockAcquired()
        await budgetLockCanRelease
      })
      await budgetLockAcquired

      // The linked request must acquire the budget lock before inserting its
      // candidate Asset. Holding that lock guarantees the folder-only request
      // wins the shared uploadId while the linked request is already in flight.
      const linkedRegistration = persistUploadedAssetRegistration({
        createdBy: primary.userId,
        elementId: element.id,
        folderId: null,
        id: losingAssetId,
        mimeType: 'image/png',
        name: 'same-grant-loser.png',
        organizationId: primary.organizationId,
        role: 'packshot',
        sizeBytes: 10,
        storageKey: `verification/${losingAssetId}.png`,
        type: 'image',
        uploadId,
      })
      const [winningOutcome] = await Promise.allSettled([
        persistUploadedAssetRegistration({
          createdBy: primary.userId,
          folderId: element.folderId,
          id: winningAssetId,
          mimeType: 'image/png',
          name: 'same-grant-winner.png',
          organizationId: primary.organizationId,
          sizeBytes: 10,
          storageKey: `verification/${winningAssetId}.png`,
          type: 'image',
          uploadId,
        }),
      ])
      releaseBudgetLock()

      const [lockOutcome, linkedOutcome] = await withTimeout(
        Promise.allSettled([heldBudgetLock, linkedRegistration]),
        CONCURRENCY_TIMEOUT_MS,
      )
      if (winningOutcome?.status === 'rejected')
        throw winningOutcome.reason
      if (lockOutcome.status === 'rejected')
        throw lockOutcome.reason
      if (linkedOutcome.status === 'rejected')
        throw linkedOutcome.reason
      assert.ok(winningOutcome)
      assert.equal(winningOutcome.value.asset.id, winningAssetId)
      assert.equal(winningOutcome.value.replay, false)
      assert.equal(linkedOutcome.value.asset.id, winningAssetId)
      assert.equal(linkedOutcome.value.replay, true)

      const [assets, links] = await Promise.all([
        db.selectFrom('assets')
          .select(['id'])
          .where('organizationId', '=', primary.organizationId)
          .where('uploadId', '=', uploadId)
          .execute(),
        db.selectFrom('elementAssets')
          .select(['assetId', 'referenceKind', 'referenceMetadata'])
          .where('organizationId', '=', primary.organizationId)
          .where('elementId', '=', element.id)
          .where('assetId', '=', winningAssetId)
          .where('role', '=', 'packshot')
          .execute(),
      ])
      assert.deepEqual(assets.map(asset => asset.id), [winningAssetId])
      assert.equal(links.length, 1)
      const link = links[0]
      assert.ok(link)
      assert.equal(link.assetId, winningAssetId)
      assert.equal(link.referenceKind, 'master')
      assert.deepEqual(link.referenceMetadata, {})
    })

    await verify('upload capacity and budget failures roll back the Asset row', async () => {
      const fullElement = await createElement(primary)
      const role = elementContracts.getElementAssetRole(
        'product',
        'packshot',
        elementContracts.parseElementData('product', {}),
      )
      assert.ok(role)
      for (let index = 0; index < role.maxAssets; index += 1) {
        const assetId = await createReadyImage(primary, fullElement, `upload-cap-${index}`)
        await seedLink({
          assetId,
          elementId: fullElement.id,
          organizationId: primary.organizationId,
          referenceKind: 'master',
          sortOrder: index,
        })
      }
      const capacityAssetId = uniqueId('upload-capacity-rejected')
      const capacity = await insertUploadedAsset({
        createdBy: primary.userId,
        elementId: fullElement.id,
        folderId: null,
        id: capacityAssetId,
        mimeType: 'image/png',
        name: 'capacity-rejected.png',
        organizationId: primary.organizationId,
        role: 'packshot',
        sizeBytes: 10,
        storageKey: `verification/${capacityAssetId}.png`,
        type: 'image',
        uploadId: uniqueId('upload'),
        validateFlowReferenceBudgets: realBudgetValidator(
          primary.organizationId,
          fullElement.id,
        ),
      })
      assert.equal(capacity.status, 'element_master_role_capacity_reached')
      assert.equal(
        await db.selectFrom('assets').select('id').where('organizationId', '=', primary.organizationId).where('id', '=', capacityAssetId).executeTakeFirst(),
        undefined,
      )

      const budgetElement = await createElement(primary)
      const budgetAssetId = uniqueId('upload-budget-rejected')
      const rejection = new Error('verification_budget_rejection')
      await assert.rejects(insertUploadedAsset({
        createdBy: primary.userId,
        elementId: budgetElement.id,
        folderId: null,
        id: budgetAssetId,
        mimeType: 'image/png',
        name: 'budget-rejected.png',
        organizationId: primary.organizationId,
        role: 'packshot',
        sizeBytes: 10,
        storageKey: `verification/${budgetAssetId}.png`,
        type: 'image',
        uploadId: uniqueId('upload'),
        validateFlowReferenceBudgets: async () => {
          throw rejection
        },
      }), error => error === rejection)
      const [asset, link] = await Promise.all([
        db.selectFrom('assets').select('id').where('organizationId', '=', primary.organizationId).where('id', '=', budgetAssetId).executeTakeFirst(),
        db.selectFrom('elementAssets').select('assetId').where('organizationId', '=', primary.organizationId).where('elementId', '=', budgetElement.id).where('assetId', '=', budgetAssetId).executeTakeFirst(),
      ])
      assert.equal(asset, undefined)
      assert.equal(link, undefined)
    })
    await verify('sources are excluded from standalone Element context', async () => {
      const identitySummary = 'Keep the cobalt bottle and white geometric label.'
      const element = await createElement(primary, {
        data: elementContracts.parseElementData('product', {
          description: '',
          identity: {
            avoid: [],
            mayVary: [],
            mustKeep: [],
            summary: identitySummary,
          },
          sellingPoints: [],
        }),
      })
      const masterId = await createReadyImage(primary, element, 'context-master')
      const sourceId = await createReadyImage(primary, element, 'context-source')
      await seedLink({
        assetId: masterId,
        elementId: element.id,
        isPrimary: true,
        organizationId: primary.organizationId,
        referenceKind: 'master',
        referenceMetadata: { background: 'clean', view: 'front' },
      })
      await seedLink({
        assetId: sourceId,
        elementId: element.id,
        organizationId: primary.organizationId,
        referenceKind: 'source',
        referenceMetadata: { background: 'environment', view: 'rear' },
      })
      const context = await buildElementContext({
        elementId: element.id,
        organizationId: primary.organizationId,
      })
      assert.match(context.text, new RegExp(identitySummary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      assert.deepEqual(context.assets.map(asset => asset.assetId), [masterId])
      assert.deepEqual(context.assets[0]?.referenceMetadata, {
        background: 'clean',
        view: 'front',
      })
    })

    await verify('permanent purge serializes against attachment and promotion', async () => {
      const element = await createElement(primary)

      const runPurgeRace = async (
        assetId: string,
        mutate: () => Promise<{ status: string }>,
      ) => {
        let releasePurge!: () => void
        let reportPurgeStarted!: (backendPid: number) => void
        let reportPurgeFailure!: (error: unknown) => void
        const purgeCanCommit = new Promise<void>((resolve) => {
          releasePurge = resolve
        })
        const purgeStarted = new Promise<number>((resolve, reject) => {
          reportPurgeStarted = resolve
          reportPurgeFailure = reject
        })
        const heldPurge = db.transaction().execute(async (trx) => {
          const backend = await sql<{ backendPid: number }>`
            select pg_backend_pid() as "backendPid"
          `.execute(trx)
          const backendPid = backend.rows[0]?.backendPid
          assert.ok(backendPid)
          const result = await requestAssetPurgeInTransaction(
            trx,
            primary.organizationId,
            assetId,
          )
          assert.equal(result.status, 'requested')
          reportPurgeStarted(backendPid)
          await purgeCanCommit
          return result
        })
        void heldPurge.catch(reportPurgeFailure)

        const purgeBackendPid = await purgeStarted
        let mutationSettled = false
        const mutation = mutate().finally(() => {
          mutationSettled = true
        })
        void mutation.catch(() => {})
        let observedAssetLockWait = false
        let blockingProbeFailure: unknown

        try {
          for (let attempt = 0; attempt < 150; attempt += 1) {
            if (mutationSettled)
              break
            const blocking = await sql<{ blocked: boolean }>`
              select exists (
                select 1
                from pg_stat_activity as activity
                where activity.datname = current_database()
                  and ${purgeBackendPid} = any(pg_blocking_pids(activity.pid))
              ) as "blocked"
            `.execute(db)
            if (blocking.rows[0]?.blocked) {
              observedAssetLockWait = true
              break
            }
            await new Promise(resolve => setTimeout(resolve, 20))
          }
        }
        catch (error) {
          blockingProbeFailure = error
        }
        finally {
          releasePurge()
        }

        const [purgeOutcome, mutationOutcome] = await withTimeout(
          Promise.allSettled([heldPurge, mutation]),
          CONCURRENCY_TIMEOUT_MS,
        )
        if (purgeOutcome.status === 'rejected')
          throw purgeOutcome.reason
        if (mutationOutcome.status === 'rejected')
          throw mutationOutcome.reason
        if (blockingProbeFailure)
          throw blockingProbeFailure
        assert.equal(observedAssetLockWait, true)
        assert.equal(purgeOutcome.value.status, 'requested')
        assert.equal(mutationOutcome.value.status, 'asset_not_available')
      }

      const attachAssetId = await createReadyImage(
        primary,
        element,
        'purge-attachment',
      )
      await runPurgeRace(attachAssetId, () => createElementAssetLinkRow({
        assetId: attachAssetId,
        elementId: element.id,
        isPrimary: false,
        organizationId: primary.organizationId,
        referenceKind: 'master',
        referenceMetadata: {},
        role: 'packshot',
        validateFlowReferenceBudgets: realBudgetValidator(
          primary.organizationId,
          element.id,
        ),
      }))
      assert.equal(
        await db.selectFrom('elementAssets')
          .select('assetId')
          .where('organizationId', '=', primary.organizationId)
          .where('elementId', '=', element.id)
          .where('assetId', '=', attachAssetId)
          .executeTakeFirst(),
        undefined,
      )

      const promotionAssetId = await createReadyImage(
        primary,
        element,
        'purge-promotion',
      )
      await seedLink({
        assetId: promotionAssetId,
        elementId: element.id,
        organizationId: primary.organizationId,
        referenceKind: 'source',
      })
      await runPurgeRace(promotionAssetId, () => updateElementAssetLinkRow({
        assetId: promotionAssetId,
        elementId: element.id,
        organizationId: primary.organizationId,
        referenceKind: 'master',
        role: 'packshot',
        validateFlowReferenceBudgets: realBudgetValidator(
          primary.organizationId,
          element.id,
        ),
      }))
      const unchangedSource = await db.selectFrom('elementAssets')
        .select(['isPrimary', 'referenceKind'])
        .where('organizationId', '=', primary.organizationId)
        .where('elementId', '=', element.id)
        .where('assetId', '=', promotionAssetId)
        .where('role', '=', 'packshot')
        .executeTakeFirstOrThrow()
      assert.equal(unchangedSource.referenceKind, 'source')
      assert.equal(unchangedSource.isPrimary, false)
    })

    await verify('concurrent promotion and attachment preserve lock order and capacity', async () => {
      const element = await createElement(primary)
      const data = elementContracts.parseElementData('product', {})
      const role = elementContracts.getElementAssetRole('product', 'packshot', data)
      assert.ok(role)
      for (let index = 0; index < role.maxAssets - 1; index += 1) {
        const assetId = await createReadyImage(primary, element, `concurrent-${index}`)
        await seedLink({
          assetId,
          elementId: element.id,
          organizationId: primary.organizationId,
          referenceKind: 'master',
          sortOrder: index,
        })
      }
      const sourceId = await createReadyImage(primary, element, 'concurrent-source')
      const attachedId = await createReadyImage(primary, element, 'concurrent-attach')
      await seedLink({
        assetId: sourceId,
        elementId: element.id,
        organizationId: primary.organizationId,
        referenceKind: 'source',
      })

      const results = await withTimeout(Promise.all([
        updateElementAssetLinkRow({
          assetId: sourceId,
          elementId: element.id,
          organizationId: primary.organizationId,
          referenceKind: 'master',
          role: 'packshot',
          validateFlowReferenceBudgets: realBudgetValidator(
            primary.organizationId,
            element.id,
          ),
        }),
        createElementAssetLinkRow({
          assetId: attachedId,
          elementId: element.id,
          isPrimary: false,
          organizationId: primary.organizationId,
          referenceKind: 'master',
          referenceMetadata: {},
          role: 'packshot',
          validateFlowReferenceBudgets: realBudgetValidator(
            primary.organizationId,
            element.id,
          ),
        }),
      ]), CONCURRENCY_TIMEOUT_MS)

      const statuses = results.map(result => result.status)
      assert.equal(
        statuses.filter(status => status === 'element_master_role_capacity_reached').length,
        1,
      )
      assert.equal(
        statuses.filter(status => status === 'updated' || status === 'created').length,
        1,
      )
      const masterCount = await db.selectFrom('elementAssets')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('organizationId', '=', primary.organizationId)
        .where('elementId', '=', element.id)
        .where('role', '=', 'packshot')
        .where('referenceKind', '=', 'master')
        .executeTakeFirstOrThrow()
      assert.equal(Number(masterCount.count), role.maxAssets)
    })
  }
  catch (error) {
    primaryFailure = error
  }
  finally {
    try {
      for (const scope of fixtureScopes.toReversed()) {
        await db.deleteFrom('organization')
          .where('id', '=', scope.organizationId)
          .execute()
        await db.deleteFrom('user')
          .where('id', '=', scope.userId)
          .execute()
      }
    }
    catch (cleanupError) {
      primaryFailure ??= cleanupError
      console.error('Fixture cleanup failed.', cleanupError)
    }
    if (schemaCreated) {
      try {
        await sql`drop schema ${sql.id(verificationSchema)} cascade`.execute(db)
      }
      catch (schemaCleanupError) {
        primaryFailure ??= schemaCleanupError
        console.error('Verification schema cleanup failed.', schemaCleanupError)
      }
    }
    await destroyDb()
  }

  if (primaryFailure)
    throw primaryFailure

  console.log(`${SCRIPT_NAME}: ${passedChecks} checks passed; fixtures cleaned.`)
}

void main().catch((error: unknown) => {
  console.error(`${SCRIPT_NAME} failed.`)
  console.error(error)
  process.exitCode = 1
})
