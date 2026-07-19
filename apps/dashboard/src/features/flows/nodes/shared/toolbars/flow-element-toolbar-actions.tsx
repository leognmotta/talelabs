/** Element-node toolbar commands backed by narrow canvas queries. */

import { IconSwitchHorizontal } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

import { useCanvasStoreApi } from '../../../editor/canvas-state/canvas-store-context'
import { FlowToolbarButton } from './flow-toolbar-button'

/** Opens the Element chooser for one Element node. */
export function FlowElementToolbarActions({ nodeId }: { nodeId: string }) {
  const { t } = useTranslation()
  const store = useCanvasStoreApi()

  return (
    <FlowToolbarButton
      icon={IconSwitchHorizontal}
      label={t('elements.switchElement')}
      onClick={() => store.setState({ elementPickerNodeId: nodeId })}
    />
  )
}
