/**
 * Aspect-ratio-aware row packing for the Create media history gallery.
 *
 * Rows keep source order and become the stable presentation unit that a future
 * virtualizer can measure without teaching result cards about list ownership.
 */

import type { FlowRunAssetOutput, FlowRunSummary } from '@talelabs/sdk'

const COMPLETE_ROW_TARGET_RATIO = 6.2
const LAST_ROW_MIN_WIDTH_PERCENT = 24
const MAX_ROW_ITEM_COUNT = 4

/** One output, active reservation, or terminal empty state in the grid. */
export interface CreateRunGridEntry {
  /** Source ratio used to size the card without cropping its media. */
  aspectRatio: number
  /** Stable identity across pagination, realtime refreshes, and row repacking. */
  key: string
  /** Canonical output when the generation has materialized one. */
  output: FlowRunAssetOutput | null
  /** Whether this is the first entry associated with the owning run. */
  primary: boolean
  /** Whether this entry reserves space for an active generation output. */
  reserved: boolean
  /** Creator-scoped direct run that owns this entry. */
  run: FlowRunSummary
}

/** Stable row geometry consumed by the gallery presentation. */
export interface CreateRunGridRow {
  /** Whether the row reached its density target and should fill the viewport. */
  complete: boolean
  /** Ordered entries presented together at one visual row boundary. */
  entries: readonly CreateRunGridEntry[]
  /** Stable row identity derived from its first immutable entry. */
  key: string
  /** Proportional desktop columns that preserve every entry's aspect ratio. */
  templateColumns: string
  /** Desktop width that prevents a sparse final row from stretching. */
  width: string
}

function parseAspectRatio(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0)
    return value
  if (typeof value !== 'string')
    return null

  const match = value.trim().match(
    /^(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)$/i,
  )
  if (!match)
    return null

  const width = Number(match[1])
  const height = Number(match[2])
  return width > 0 && height > 0 ? width / height : null
}

/**
 * Resolves deterministic card geometry from persisted media metadata first.
 *
 * Active placeholders fall back to the admitted request ratio so the grid does
 * not jump when an output replaces its reservation.
 */
export function resolveCreateRunGridAspectRatio(
  output: FlowRunAssetOutput | null,
  run: FlowRunSummary,
) {
  if (
    output?.width
    && output.height
    && output.width > 0
    && output.height > 0
  ) {
    return output.width / output.height
  }

  const requestedRatio = parseAspectRatio(
    run.requestSummary?.settings.aspectRatio,
  )
  if (requestedRatio)
    return requestedRatio

  const mediaType = output?.type ?? run.requestSummary?.mediaType
  if (mediaType === 'audio')
    return 2.4
  if (mediaType === 'video')
    return 16 / 9
  if (mediaType === 'document')
    return 4 / 3
  return 1
}

function createRow(
  entries: readonly CreateRunGridEntry[],
  complete: boolean,
): CreateRunGridRow {
  const totalRatio = entries.reduce(
    (total, entry) => total + entry.aspectRatio,
    0,
  )
  const widthPercent = complete
    ? 100
    : Math.min(
        100,
        Math.max(
          LAST_ROW_MIN_WIDTH_PERCENT,
          (totalRatio / COMPLETE_ROW_TARGET_RATIO) * 100,
        ),
      )

  return {
    complete,
    entries,
    key: entries[0]!.key,
    templateColumns: entries
      .map(entry => `${entry.aspectRatio}fr`)
      .join(' '),
    width: `${widthPercent}%`,
  }
}

/**
 * Packs newest-first entries into justified rows without changing DOM order.
 *
 * Each completed row fills available width. The final partial row keeps the
 * same target media height instead of inflating one or two outputs into heroes.
 */
export function packCreateRunGridRows(
  entries: readonly CreateRunGridEntry[],
) {
  const rows: CreateRunGridRow[] = []
  let currentEntries: CreateRunGridEntry[] = []
  let currentRatio = 0

  for (const entry of entries) {
    currentEntries.push(entry)
    currentRatio += entry.aspectRatio

    if (
      currentEntries.length >= MAX_ROW_ITEM_COUNT
      || currentRatio >= COMPLETE_ROW_TARGET_RATIO
    ) {
      rows.push(createRow(currentEntries, true))
      currentEntries = []
      currentRatio = 0
    }
  }

  if (currentEntries.length > 0)
    rows.push(createRow(currentEntries, false))

  return rows
}
