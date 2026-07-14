import type { FlowValueType } from '@talelabs/flows'
import type { ComponentProps, ReactNode } from 'react'

import { Badge } from '@talelabs/ui/components/badge'
import { cn } from '@talelabs/ui/lib/utils'
import { FlowNodePreviewStage } from './flow-node-preview-stage'

type GenerationOutputValueType = Extract<
  FlowValueType,
  'AudioSet' | 'ImageSet' | 'Text' | 'VideoSet'
>

export function GenerationPreviewStage({
  children,
  className,
  readiness,
  readinessMessage,
  valueType,
  ...props
}: Omit<ComponentProps<'div'>, 'children'> & {
  aspectRatio?: number
  children: ReactNode
  readiness: 'incomplete' | 'invalid' | 'ready'
  readinessMessage: string
  valueType: GenerationOutputValueType
}) {
  return (
    <FlowNodePreviewStage
      {...props}
      className={className}
      data-generation-preview-stage
      data-readiness={readiness}
      valueType={valueType}
    >
      {children}
      <div className="absolute inset-x-2 bottom-2 z-10 flex">
        <Badge
          className={cn(
            `
              max-w-full truncate border-border/75 bg-card/78 text-[10px]
              text-foreground/72 shadow-sm backdrop-blur-sm
            `,
            readiness === 'invalid' && 'text-destructive',
            readiness === 'ready' && `
              text-emerald-700
              dark:text-emerald-300
            `,
          )}
          title={readinessMessage}
          variant="outline"
        >
          <span className="truncate">{readinessMessage}</span>
        </Badge>
      </div>
    </FlowNodePreviewStage>
  )
}
