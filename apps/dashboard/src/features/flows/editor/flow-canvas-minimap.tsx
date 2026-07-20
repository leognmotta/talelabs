/** Collapsible minimap panel with a persisted open/closed preference. */

import { IconMap, IconX } from '@tabler/icons-react'
import { MiniMap, Panel } from '@xyflow/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlowToolbarButton } from '../nodes/shared/toolbars/flow-toolbar-button'

const MINIMAP_COLLAPSED_KEY = 'talelabs.flow.minimapCollapsed'

/** Reads the persisted collapse preference, defaulting to expanded. */
function readCollapsedPreference(): boolean {
  if (typeof window === 'undefined')
    return false
  return window.localStorage.getItem(MINIMAP_COLLAPSED_KEY) === 'true'
}

/** Renders the minimap or its collapsed toggle, persisting the choice locally. */
export function FlowCanvasMinimap() {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(readCollapsedPreference)

  function updateCollapsed(next: boolean) {
    setCollapsed(next)
    if (typeof window !== 'undefined')
      window.localStorage.setItem(MINIMAP_COLLAPSED_KEY, String(next))
  }

  if (collapsed) {
    return (
      <Panel className="m-5!" position="bottom-right">
        <div className="rounded-full p-0.5" data-flow-chrome>
          <FlowToolbarButton
            icon={IconMap}
            label={t('flows.minimapShow')}
            onClick={() => updateCollapsed(false)}
          />
        </div>
      </Panel>
    )
  }

  return (
    <Panel className="m-5!" position="bottom-right">
      <div
        className="group/minimap relative overflow-hidden rounded-xl"
        data-flow-chrome
        data-flow-chrome-enter
      >
        <div
          className="
            absolute top-1 right-1 z-10 opacity-0 transition-opacity
            duration-(--flow-motion-fast)
            group-hover/minimap:opacity-100
          "
        >
          <FlowToolbarButton
            icon={IconX}
            label={t('flows.minimapHide')}
            onClick={() => updateCollapsed(true)}
          />
        </div>
        <MiniMap
          ariaLabel={t('flows.a11y.minimap')}
          className="m-0! rounded-none! border-0! bg-transparent! shadow-none!"
          maskColor="color-mix(in oklab, var(--background) 75%, transparent)"
          nodeColor="var(--muted-foreground)"
          pannable
          zoomable
        />
      </div>
    </Panel>
  )
}
