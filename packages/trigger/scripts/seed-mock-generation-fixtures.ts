import {
  seedMockGenerationFixtures,
  verifyMockGenerationFixtures,
} from './mock-fixture-storage.js'

await seedMockGenerationFixtures()
await verifyMockGenerationFixtures()
console.log('Mock generation fixtures seeded and verified')
