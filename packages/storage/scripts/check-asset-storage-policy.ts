import assert from 'node:assert/strict'

import {
  buildAssetStorageKey,
  buildAssetThumbnailKey,
  CURRENT_GENERATED_OUTPUT_VISIBILITY,
  getAssetBucket,
  TALELABS_PRIVATE_BUCKET,
  TALELABS_PUBLIC_BUCKET,
} from '../src/index.js'

const organizationId = 'org_sensitive_tenant'
const assetId = 'a0123456789abcdefghijklmn'

assert.equal(CURRENT_GENERATED_OUTPUT_VISIBILITY, 'public')
assert.equal(getAssetBucket('private'), TALELABS_PRIVATE_BUCKET)
assert.equal(getAssetBucket('public'), TALELABS_PUBLIC_BUCKET)

const publicOriginal = buildAssetStorageKey({
  assetId,
  organizationId,
  visibility: 'public',
})
const publicThumbnail = buildAssetThumbnailKey({
  assetId,
  organizationId,
  visibility: 'public',
})
assert.equal(publicOriginal, `generated/${assetId}/original`)
assert.equal(publicThumbnail, `generated/${assetId}/thumbnail.jpg`)
assert.equal(publicOriginal.includes(organizationId), false)
assert.equal(publicThumbnail.includes(organizationId), false)

const privateOriginal = buildAssetStorageKey({
  assetId,
  organizationId,
  visibility: 'private',
})
const privateThumbnail = buildAssetThumbnailKey({
  assetId,
  organizationId,
  visibility: 'private',
})
assert.match(privateOriginal, /^organizations\/org_sensitive_tenant\/originals\//)
assert.match(privateThumbnail, /^organizations\/org_sensitive_tenant\/thumbnails\//)

assert.throws(
  () => getAssetBucket('unknown' as 'private'),
  /Unsupported Asset visibility/,
)

console.log('Asset storage policy scenarios passed.')
