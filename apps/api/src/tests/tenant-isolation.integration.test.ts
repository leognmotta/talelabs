import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
// Node's test runner keeps database integration tests dependency-free.
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

const testDatabaseUrl = process.env.TEST_POSTGRES_URL

test(
  'M1 queries and character relationships enforce organization isolation',
  {
    skip: testDatabaseUrl
      ? false
      : 'Set TEST_POSTGRES_URL to a migrated, isolated database.',
  },
  async () => {
    assert.ok(testDatabaseUrl)
    process.env.POSTGRES_URL = testDatabaseUrl

    const { db, destroyDb } = await import('@talelabs/db')
    const { findBrandById } = await import('../data/brands.queries.js')
    const {
      findCharacterBrandLinks,
      findCharacterById,
      linkBrandCharacter,
      updateCharacterWithBrands,
    } = await import('../data/characters.queries.js')
    const { findProductById } = await import('../data/products.queries.js')
    const { findProjectById } = await import('../data/projects.queries.js')

    const suffix = randomUUID()
    const organizationA = `test-org-a-${suffix}`
    const organizationB = `test-org-b-${suffix}`
    const userId = `test-user-${suffix}`
    const brandA = `test-brand-a-${suffix}`
    const brandB = `test-brand-b-${suffix}`
    const characterA = `test-character-a-${suffix}`
    const characterB = `test-character-b-${suffix}`
    const productA = `test-product-a-${suffix}`
    const projectA = `test-project-a-${suffix}`
    const now = new Date()

    try {
      await db
        .insertInto('user')
        .values({
          createdAt: now,
          email: `${suffix}@example.test`,
          emailVerified: true,
          id: userId,
          name: 'Tenant test user',
          banned: false,
          role: 'user',
          updatedAt: now,
        })
        .execute()
      await db
        .insertInto('organization')
        .values([
          {
            createdAt: now,
            id: organizationA,
            name: 'Tenant A',
            slug: `tenant-a-${suffix}`,
          },
          {
            createdAt: now,
            id: organizationB,
            name: 'Tenant B',
            slug: `tenant-b-${suffix}`,
          },
        ])
        .execute()
      await db
        .insertInto('brands')
        .values([
          {
            createdBy: userId,
            id: brandA,
            name: 'Brand A',
            organizationId: organizationA,
          },
          {
            createdBy: userId,
            id: brandB,
            name: 'Brand B',
            organizationId: organizationB,
          },
        ])
        .execute()
      await db
        .insertInto('characters')
        .values([
          {
            createdBy: userId,
            id: characterA,
            name: 'Original character',
            organizationId: organizationA,
          },
          {
            createdBy: userId,
            id: characterB,
            name: 'Other tenant character',
            organizationId: organizationB,
          },
        ])
        .execute()
      await db
        .insertInto('brandCharacters')
        .values({
          brandId: brandA,
          characterId: characterA,
        })
        .execute()
      await db
        .insertInto('products')
        .values({
          createdBy: userId,
          id: productA,
          name: 'Product A',
          organizationId: organizationA,
        })
        .execute()
      await db
        .insertInto('projects')
        .values({
          createdBy: userId,
          id: projectA,
          name: 'Project A',
          organizationId: organizationA,
        })
        .execute()

      assert.equal(await findBrandById(organizationB, brandA), undefined)
      assert.equal(
        await findCharacterById(organizationB, characterA),
        undefined,
      )
      assert.equal(await findProductById(organizationB, productA), undefined)
      assert.equal(await findProjectById(organizationB, projectA), undefined)
      assert.equal(
        await linkBrandCharacter(organizationA, brandA, characterB),
        false,
      )

      const rejectedUpdate = await updateCharacterWithBrands({
        brandIds: [brandB],
        characterId: characterA,
        name: 'Should roll back',
        organizationId: organizationA,
      })

      assert.deepEqual(rejectedUpdate, {
        ok: false,
        reason: 'brand_not_found',
      })
      assert.equal(
        (await findCharacterById(organizationA, characterA))?.name,
        'Original character',
      )
      assert.deepEqual(await findCharacterBrandLinks([characterA]), [
        {
          brandId: brandA,
          characterId: characterA,
        },
      ])
    }
    finally {
      await db
        .deleteFrom('organization')
        .where('id', 'in', [organizationA, organizationB])
        .execute()
      await db.deleteFrom('user').where('id', '=', userId).execute()
      await destroyDb()
    }
  },
)
