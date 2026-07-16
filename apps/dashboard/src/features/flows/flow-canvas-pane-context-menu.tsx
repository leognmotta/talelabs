import type { FlowNodeType } from '@talelabs/flows'

import {
  IconFocusCentered,
  IconSelectAll,
  IconUpload,
} from '@tabler/icons-react'
import {
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from '@talelabs/ui/components/context-menu'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FLOW_NODE_PICKER_DEFINITIONS,
  FLOW_NODE_PICKER_GROUPS,
} from './flow-dashboard-node-registry'

export function FlowCanvasPaneContextMenu({
  canAddNodeType,
  onAddNode,
  onFitView,
  onSelectAll,
  onUploadAssets,
}: {
  canAddNodeType: (nodeType: FlowNodeType) => boolean
  onAddNode: (nodeType: FlowNodeType) => void
  onFitView: () => void
  onSelectAll: () => void
  onUploadAssets: () => void
}) {
  const { t } = useTranslation()

  return (
    <>
      <ContextMenuGroup>
        <ContextMenuLabel>{t('flows.addNode')}</ContextMenuLabel>
      </ContextMenuGroup>
      {FLOW_NODE_PICKER_GROUPS.map((group, index) => {
        const definitions = FLOW_NODE_PICKER_DEFINITIONS.filter(
          definition => definition.pickerGroup === group.id,
        )
        if (definitions.length === 0)
          return null

        return (
          <Fragment key={group.id}>
            {index > 0 && <ContextMenuSeparator />}
            <ContextMenuGroup>
              <ContextMenuLabel inset>{t(group.labelKey)}</ContextMenuLabel>
              {definitions.map((definition) => {
                const Icon = definition.icon
                const available = canAddNodeType(definition.type)
                return (
                  <ContextMenuItem
                    disabled={!available}
                    key={definition.type}
                    onClick={() => onAddNode(definition.type)}
                  >
                    <Icon />
                    {t(definition.labelKey)}
                    {!available && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {t('flows.modelPicker.unavailable')}
                      </span>
                    )}
                  </ContextMenuItem>
                )
              })}
            </ContextMenuGroup>
          </Fragment>
        )
      })}
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem onClick={onUploadAssets}>
          <IconUpload />
          {t('assets.uploadFiles')}
        </ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem onClick={onSelectAll}>
          <IconSelectAll />
          {t('flows.selectAll')}
        </ContextMenuItem>
        <ContextMenuItem onClick={onFitView}>
          <IconFocusCentered />
          {t('flows.fitView')}
        </ContextMenuItem>
      </ContextMenuGroup>
    </>
  )
}
