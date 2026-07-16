import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { FFPROBE_BINARY } from '../../shared/media/binaries.js'

const execFileAsync = promisify(execFile)

export interface FfprobeOutput {
  format?: {
    bit_rate?: string
    duration?: string
    format_name?: string
  }
  streams?: Array<{
    channels?: number
    codec_name?: string
    codec_type?: string
    height?: number
    sample_rate?: string
    side_data_list?: Array<{
      rotation?: number
      side_data_type?: string
    }>
    tags?: {
      rotate?: string
    }
    width?: number
  }>
}

export async function ffprobe(path: string) {
  const { stdout } = await execFileAsync(FFPROBE_BINARY, [
    '-v',
    'error',
    '-show_format',
    '-show_streams',
    '-of',
    'json',
    path,
  ], { maxBuffer: 4 * 1024 * 1024 })

  return JSON.parse(stdout) as FfprobeOutput
}

export function safeNumber(value: string | number | undefined) {
  if (value === undefined)
    return null
  const result = Number(value)
  return Number.isFinite(result) ? result : null
}
