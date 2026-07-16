import type {
  GenerationCandidateOrigin,
  GenerationCandidateSelectionSnapshot,
  GenerationReferenceCandidate,
} from '../registry/types.js'

export function isExecutableGenerationCandidate(
  value: unknown,
): value is GenerationReferenceCandidate {
  if (!value || typeof value !== 'object')
    return false
  const candidate = value as Partial<GenerationReferenceCandidate>
  if (
    typeof candidate.assetId !== 'string'
    || typeof candidate.candidateId !== 'string'
    || typeof candidate.order !== 'number'
    || !Number.isInteger(candidate.order)
    || candidate.order < 0
    || typeof candidate.slotId !== 'string'
    || !['audio', 'image', 'video'].includes(candidate.mediaType ?? '')
    || !candidate.origin
    || typeof candidate.origin !== 'object'
  ) {
    return false
  }
  const origin = candidate.origin as Partial<GenerationCandidateOrigin>
  if (origin.kind === 'nodeOutput') {
    return typeof origin.nodeId === 'string'
      && typeof origin.outputIndex === 'number'
      && Number.isInteger(origin.outputIndex)
      && origin.outputIndex >= 0
  }
  return origin.kind === 'asset'
}

export function validateGenerationCandidateSelectionSnapshot(
  snapshot: GenerationCandidateSelectionSnapshot,
) {
  const errors: string[] = []
  const consideredById = new Map(
    snapshot.considered.map(item => [item.candidate.candidateId, item]),
  )
  if (consideredById.size !== snapshot.considered.length)
    errors.push('considered candidate ids must be unique')
  const consideredOrderKeys = snapshot.considered.map(
    item => `${item.candidate.slotId}:${item.candidate.order}`,
  )
  if (new Set(consideredOrderKeys).size !== consideredOrderKeys.length)
    errors.push('considered candidate order must be unique within each slot')

  for (const item of snapshot.considered) {
    const candidateId = item.candidate.candidateId
    if (!isExecutableGenerationCandidate(item.candidate as unknown))
      errors.push(`${candidateId}: candidate is not executable`)
    if (item.selected && item.exclusionReasons.length) {
      errors.push(
        `${item.candidate.candidateId}: selected candidate cannot have exclusions`,
      )
    }
    if (!item.selected && !item.exclusionReasons.length) {
      errors.push(
        `${item.candidate.candidateId}: excluded candidate requires a reason`,
      )
    }
  }

  const selectedIds = snapshot.selectedInputs.map(input => input.candidateId)
  if (new Set(selectedIds).size !== selectedIds.length)
    errors.push('selected provider input candidate ids must be unique')
  const selectedOrders = snapshot.selectedInputs.map(input => input.order)
  if (
    selectedOrders.some(order => !Number.isInteger(order) || order < 0)
    || new Set(selectedOrders).size !== selectedOrders.length
  ) {
    errors.push(
      'selected provider input order must be unique non-negative integers',
    )
  }
  for (const [index, input] of snapshot.selectedInputs.entries()) {
    if (input.order !== index) {
      errors.push(
        `${input.candidateId}: selected provider input order must match payload order`,
      )
    }
    const considered = consideredById.get(input.candidateId)
    if (!considered?.selected) {
      errors.push(
        `${input.candidateId}: selected provider input was not selected from candidates`,
      )
    }
    else if (
      input.assetId !== considered.candidate.assetId
      || input.slotId !== considered.candidate.slotId
    ) {
      errors.push(
        `${input.candidateId}: selected provider input does not match its candidate`,
      )
    }
  }
  const expectedIds = snapshot.considered
    .filter(item => item.selected)
    .map(item => item.candidate.candidateId)
    .toSorted()
  if (JSON.stringify([...selectedIds].toSorted()) !== JSON.stringify(expectedIds)) {
    errors.push(
      'selected provider inputs must preserve the exact selected candidate subset',
    )
  }
  return errors
}
