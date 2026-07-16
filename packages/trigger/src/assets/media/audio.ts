import type { MediaProcessor } from './contracts.js'

import { InvalidMediaError } from './contracts.js'
import { ffprobe, safeNumber } from './ffprobe.js'

export const audioProcessor: MediaProcessor = {
  async process({ sourcePath }) {
    const probe = await ffprobe(sourcePath)
    const audio = probe.streams?.find(stream => stream.codec_type === 'audio')
    if (!audio)
      throw new InvalidMediaError('Audio stream could not be read.')

    return {
      durationSeconds: safeNumber(probe.format?.duration),
      height: null,
      metadata: {
        bitRate: safeNumber(probe.format?.bit_rate),
        channels: audio.channels ?? null,
        codec: audio.codec_name ?? null,
        format: probe.format?.format_name ?? null,
        sampleRate: safeNumber(audio.sample_rate),
      },
      thumbnail: null,
      width: null,
    }
  },
}
