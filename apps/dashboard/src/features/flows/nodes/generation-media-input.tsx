import type {
  GenerationInputAvailability,
  GenerationInputSlotDefinition,
} from '@talelabs/flows'
import type { FlowInputState } from '../flow-canvas-types'

import { useTranslation } from 'react-i18next'
import { GenerationInputPort } from './generation-input-port'

export type GenerationMediaInputStatus
  = | { kind: 'connections', messageKey: string }
    | { kind: 'items', messageKey: string }

export interface GenerationMediaInputProps {
  availability: GenerationInputAvailability
  className?: string
  connectionBadge?: 'hidden' | 'visible'
  inputState: FlowInputState | null
  namespace: 'audio' | 'image' | 'llm' | 'video'
  nodeEdge?: boolean
  slot: GenerationInputSlotDefinition
  status: GenerationMediaInputStatus
}

/** Shared presenter for every model-adaptive media/text input port. */
export function GenerationMediaInput({
  availability,
  className,
  connectionBadge = 'visible',
  inputState,
  namespace,
  nodeEdge = true,
  slot,
  status,
}: GenerationMediaInputProps) {
  const { t } = useTranslation()
  const connectionCount = inputState?.connectionCount
    ?? (availability.state === 'connected' ? availability.connectionCount : 0)
  const itemCount = inputState?.selectedAvailableCount
    ?? (availability.state === 'connected' ? availability.itemCount : 0)
  const maximum = inputState?.maximum ?? slot.maxItems
  const unavailable = availability.state === 'blocked'
    || availability.state === 'full'
  const connectedReason = status.kind === 'items'
    ? itemCount > 0
      ? t(status.messageKey, { count: itemCount, maximum })
      : null
    : connectionCount > 0
      ? t(status.messageKey, { count: connectionCount, maximum })
      : null
  const reason = unavailable
    ? t(availability.reasonKey, { count: maximum, maximum })
    : connectedReason ?? t(slot.descriptionKey)
  const label = t(slot.labelKey)
  const namespaceAttribute = {
    [`data-${namespace}-input`]: slot.id,
  }

  return (
    <GenerationInputPort
      {...namespaceAttribute}
      ariaLabel={t('flows.handles.input', { input: label })}
      availability={availability}
      className={className}
      connectionCount={connectionCount}
      label={label}
      nodeEdge={nodeEdge}
      reason={reason}
      showConnectionCount={connectionBadge === 'visible'}
      slot={slot}
    />
  )
}
