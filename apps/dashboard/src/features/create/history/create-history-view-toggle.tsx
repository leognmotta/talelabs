/** Compact selector for the timeline and grid Create history presentations. */

import type { CreateHistoryView } from './create-history-view-preference'

import { IconGridDots, IconList } from '@tabler/icons-react'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@talelabs/ui/components/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@talelabs/ui/components/tooltip'
import { useTranslation } from 'react-i18next'

/** Switches only the local presentation of the current Create run history. */
export function CreateHistoryViewToggle({
  view,
  onViewChange,
}: {
  /** Currently selected browser-local history presentation. */
  view: CreateHistoryView
  /** Persists and applies the selected presentation. */
  onViewChange: (view: CreateHistoryView) => void
}) {
  const { t } = useTranslation()

  return (
    <ToggleGroup
      aria-label={t('create.history.view')}
      className="rounded-xl p-1"
      data-flow-chrome
      size="sm"
      spacing={1}
      value={[view]}
      onValueChange={(values) => {
        const nextView = values.at(-1)
        if (nextView === 'timeline' || nextView === 'grid')
          onViewChange(nextView)
      }}
    >
      <Tooltip>
        <TooltipTrigger
          render={(
            <ToggleGroupItem
              aria-label={t('create.history.timelineView')}
              className="
                size-8 min-w-8 rounded-lg px-0 text-muted-foreground
                data-[state=on]:text-foreground
              "
              value="timeline"
            />
          )}
        >
          <IconList aria-hidden />
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {t('create.history.timelineView')}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={(
            <ToggleGroupItem
              aria-label={t('create.history.gridView')}
              className="
                size-8 min-w-8 rounded-lg px-0 text-muted-foreground
                data-[state=on]:text-foreground
              "
              value="grid"
            />
          )}
        >
          <IconGridDots aria-hidden />
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {t('create.history.gridView')}
        </TooltipContent>
      </Tooltip>
    </ToggleGroup>
  )
}
