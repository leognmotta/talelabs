import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { getObject } from '@talelabs/storage'

export async function downloadAssetSourceToFile(
  bucket: string,
  key: string,
  path: string,
) {
  const object = await getObject({ bucket, key })
  if (!object.Body)
    throw new Error('Stored media has no body.')

  if (object.Body instanceof Readable) {
    const { createWriteStream } = await import('node:fs')
    await pipeline(object.Body, createWriteStream(path))
    return
  }

  const bytes = await object.Body.transformToByteArray()
  const { writeFile } = await import('node:fs/promises')
  await writeFile(path, bytes)
}
