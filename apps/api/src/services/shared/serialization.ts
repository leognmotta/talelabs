export function serializeTimestamps<
  Row extends { createdAt: Date, updatedAt: Date },
>(row: Row) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function serializeRoleCounts(
  counts: Array<{ count: number | string, role: string }>,
) {
  return Object.fromEntries(
    counts.map(item => [item.role, Number(item.count)]),
  )
}
