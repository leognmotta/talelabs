import type { FlowValueType } from '@talelabs/flows'
import type { ComponentType } from 'react'

/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */
import { FlowNodePreviewStage } from './flow-node-preview-stage'

export function FlowNodeSelectionStage({
  description,
  icon: Icon,
  label,
  onSelect,
  valueType,
}: {
  description: string
  icon: ComponentType<{ className?: string, stroke?: number }>
  label: string
  onSelect: () => void
  valueType: FlowValueType
}) {
  return (
    <FlowNodePreviewStage valueType={valueType}>
      <button
        className="
          nodrag nopan absolute inset-0 flex flex-col items-center
          justify-center gap-2 p-6 text-center outline-none
          hover:bg-muted/20
          focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset
        "
        type="button"
        onClick={onSelect}
      >
        <Icon className="size-10 text-foreground/30" stroke={1.25} />
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </button>
    </FlowNodePreviewStage>
  )
}
