import type { FfprobeOutput } from './ffprobe.js'
import type { MediaProcessor } from './media-processor.js'

import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { FFMPEG_BINARY } from '../../media-binaries.js'
import { ffprobe, safeNumber } from './ffprobe.js'
import { InvalidMediaError } from './media-processor.js'

const execFileAsync = promisify(execFile)

function normalizeRotation(value: null | number) {
  if (value === null)
    return 0

  return ((Math.round(value) % 360) + 360) % 360
}

function getVideoRotation(video: NonNullable<FfprobeOutput['streams']>[number]) {
  const displayMatrixRotation = video.side_data_list
    ?.find(sideData => sideData.rotation !== undefined)
    ?.rotation
  return normalizeRotation(
    safeNumber(displayMatrixRotation ?? video.tags?.rotate),
  )
}

export const videoProcessor: MediaProcessor = {
  async process({ directory, sourcePath }) {
    const probe = await ffprobe(sourcePath)
    const video = probe.streams?.find(stream => stream.codec_type === 'video')
    if (!video?.width || !video.height)
      throw new InvalidMediaError('Video dimensions could not be read.')

    const rotationDegrees = getVideoRotation(video)
    const swapsDimensions = rotationDegrees === 90 || rotationDegrees === 270
    const posterPath = join(directory, 'poster.jpg')
    await execFileAsync(FFMPEG_BINARY, [
      '-y',
      '-ss',
      '0',
      '-i',
      sourcePath,
      '-frames:v',
      '1',
      '-vf',
      'scale=640:-2:force_original_aspect_ratio=decrease',
      '-q:v',
      '3',
      posterPath,
    ], { maxBuffer: 4 * 1024 * 1024 })

    return {
      durationSeconds: safeNumber(probe.format?.duration),
      height: swapsDimensions ? video.width : video.height,
      metadata: {
        bitRate: safeNumber(probe.format?.bit_rate),
        codec: video.codec_name ?? null,
        format: probe.format?.format_name ?? null,
        rotationDegrees,
      },
      thumbnail: await readFile(posterPath),
      width: swapsDimensions ? video.height : video.width,
    }
  },
}
