/** Add-node picker derived from canonical node presentation metadata. */

import type { FlowNodeType } from '@talelabs/flows'
import type { FlowNodePickerFilter } from '../../nodes/flow-node-metadata'

import { IconPlus } from '@tabler/icons-react'
import { isFlowNodeType } from '@talelabs/flows'
import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import { Separator } from '@talelabs/ui/components/separator'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@talelabs/ui/components/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@talelabs/ui/components/tooltip'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SearchablePicker } from '../../../../shared/components/searchable-picker'
import {
  FLOW_NODE_PICKER_CATEGORIES,
  FLOW_NODE_PICKER_DEFINITIONS,
  FLOW_NODE_PICKER_GROUPS,
  getFlowNodeMetadata,
} from '../../nodes/flow-node-metadata'

/** Presents searchable, capability-aware node metadata and dispatches add commands. */
export function FlowCanvasNodePicker(input: {
  canAddNodeType: (nodeType: FlowNodeType) => boolean
  onAddNode: (nodeType: FlowNodeType) => void
}) {
  const { t } = useTranslation()
  const [category, setCategory] = useState<FlowNodePickerFilter>('all')
  const visibleDefinitions
    = category === 'all'
      ? FLOW_NODE_PICKER_DEFINITIONS
      : FLOW_NODE_PICKER_DEFINITIONS.filter(
          definition => definition.pickerCategory === category,
        )
  const groups = FLOW_NODE_PICKER_GROUPS.map(group => ({
    id: group.id,
    items: visibleDefinitions
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
            t(
              FLOW_NODE_PICKER_CATEGORIES.find(
                categoryDefinition =>
                  categoryDefinition.id === definition.pickerCategory,
              )?.labelKey ?? group.labelKey,
            ),
            disabled ? t('flows.modelPicker.unavailable') : '',
          ].join(' '),
        }
      }),
    label: t(group.labelKey),
  }))
    .filter(group => group.items.length > 0)
    .map((group, groupIndex) => ({
      ...group,
      separatorBefore: groupIndex > 0,
    }))
  return (
    <SearchablePicker
      ariaLabel={t('flows.addNode')}
      controls={(
        <>
          <ToggleGroup
            aria-label={t('flows.nodePicker.categoryFilterLabel')}
            className="mx-2 mt-2"
            size="sm"
            value={[category]}
            variant="filled"
            onValueChange={(values) => {
              const nextCategory = values.at(-1)
              const matchedCategory = FLOW_NODE_PICKER_CATEGORIES.find(
                definition => definition.id === nextCategory,
              )
              if (matchedCategory)
                setCategory(matchedCategory.id)
            }}
          >
            {FLOW_NODE_PICKER_CATEGORIES.map((definition) => {
              const CategoryIcon = definition.icon
              const label = t(definition.labelKey)
              return (
                <Tooltip key={definition.id}>
                  <TooltipTrigger
                    render={(
                      <ToggleGroupItem
                        aria-label={label}
                        value={definition.id}
                      />
                    )}
                  >
                    <CategoryIcon aria-hidden />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{label}</TooltipContent>
                </Tooltip>
              )
            })}
          </ToggleGroup>
          <Separator className="mt-2" />
        </>
      )}
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
          ? getFlowNodeMetadata(nodeType)
          : undefined
        if (definition?.pickerVisible && input.canAddNodeType(definition.type))
          input.onAddNode(definition.type)
      }}
    />
  )
}
