import type { FlowNodeType } from '@talelabs/flows'

import { IconPlus } from '@tabler/icons-react'
import { isFlowNodeType } from '@talelabs/flows'
import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import { useTranslation } from 'react-i18next'
import { SearchablePicker } from '../../shared/components/searchable-picker'
import {
  FLOW_NODE_PICKER_DEFINITIONS,
  FLOW_NODE_PICKER_GROUPS,
  getFlowDashboardNodeDefinition,
} from './flow-dashboard-node-registry'

export function FlowCanvasNodePicker(input: {
  canAddNodeType: (nodeType: FlowNodeType) => boolean
  onAddNode: (nodeType: FlowNodeType) => void
}) {
  const { t } = useTranslation()
  const groups = FLOW_NODE_PICKER_GROUPS.map((group, groupIndex) => ({
    id: group.id,
    items: FLOW_NODE_PICKER_DEFINITIONS
      .filter(definition => definition.pickerGroup === group.id)
      .map((definition) => {
        const {
          descriptionKey,
          icon: Icon,
          labelKey,
          type,
        } = definition
        const disabled = !input.canAddNodeType(type)
        return {
          content: (
            <>
              <span className="
                flex size-9 shrink-0 items-center justify-center rounded-lg
                bg-muted text-foreground
              "
              >
                <Icon aria-hidden className="size-5" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {t(labelKey)}
                  </span>
                  {disabled && (
                    <Badge
                      className="h-4 px-1.5 text-[10px]"
                      variant="outline"
                    >
                      {t('flows.modelPicker.unavailable')}
                    </Badge>
                  )}
                </span>
                <span className="
                  truncate text-xs font-normal text-muted-foreground
                "
                >
                  {t(descriptionKey)}
                </span>
              </span>
            </>
          ),
          disabled,
          id: type,
          searchValue: [
            t(labelKey),
            t(descriptionKey),
            t(group.labelKey),
            disabled ? t('flows.modelPicker.unavailable') : '',
          ].join(' '),
        }
      }),
    label: t(group.labelKey),
    separatorBefore: groupIndex > 0,
  }))
  return (
    <SearchablePicker
      ariaLabel={t('flows.addNode')}
      emptyMessage={t('flows.nodePicker.noResults')}
      groups={groups}
      searchAriaLabel={t('flows.nodePicker.searchPlaceholder')}
      searchPlaceholder={t('flows.nodePicker.searchPlaceholder')}
      showTriggerChevron={false}
      showOverflowAffordance
      side="top"
      sideOffset={12}
      trigger={(
        <Button
          aria-label={t('flows.addNode')}
          size="icon-sm"
          title={t('flows.addNode')}
          variant="ghost"
        />
      )}
      triggerContent={<IconPlus />}
      onSelect={(nodeType) => {
        const definition = isFlowNodeType(nodeType)
          ? getFlowDashboardNodeDefinition(nodeType)
          : undefined
        if (definition?.pickerVisible && input.canAddNodeType(definition.type))
          input.onAddNode(definition.type)
      }}
    />
  )
}
