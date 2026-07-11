import { execFile } from 'node:child_process'
import process from 'node:process'
import { promisify } from 'node:util'

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
  const binary = process.env.FFPROBE_PATH ?? 'ffprobe'
  const { stdout } = await execFileAsync(binary, [
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
