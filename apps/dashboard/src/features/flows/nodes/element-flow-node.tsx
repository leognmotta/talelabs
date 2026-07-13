import type { NodeProps } from '@xyflow/react'
import type { CanvasNode } from '../flow-canvas-types'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */
import { IconComponents } from '@tabler/icons-react'
import {
  getElementAssetRoles,
  getElementTypeDefinition,
} from '@talelabs/elements'
import { assetTypeToValueType } from '@talelabs/flows'
import { useUpdateNodeInternals } from '@xyflow/react'
import { memo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AssetMediaPreview } from '../../assets/asset-media-preview'
import { elementTypeTranslationKey } from '../../elements/element-i18n'
import { ELEMENT_TYPE_ICONS } from '../../elements/element-type-icons'
import { useFlowCanvas } from '../flow-canvas-context'
import { FlowHandle } from './flow-handle'
import { FlowNodeShell } from './flow-node-shell'

export const ElementFlowNode = memo(({
  id,
  selected,
}: NodeProps<CanvasNode>) => {
  const { t } = useTranslation()
  const canvas = useFlowCanvas()
  const elementId = canvas.getNode(id)?.elementId
  const updateNodeInternals = useUpdateNodeInternals()
  const element = elementId
    ? canvas.referenceData.elementsById.get(elementId)
    : undefined
  const kit = elementId
    ? canvas.referenceData.elementKitsById.get(elementId) ?? []
    : []
  const roles = element ? getElementAssetRoles(element.type, element.data) : []
  const roleIds = roles.map(role => role.id).join(':')
  const Icon = element ? ELEMENT_TYPE_ICONS[element.type] : IconComponents
  const previewRole = element
    ? getElementTypeDefinition(element.type).previewRole
    : null
  const preview = kit.find(link => link.role === previewRole && link.isPrimary)
    ?? kit.find(link => link.role === previewRole)
    ?? kit[0]

  useEffect(() => {
    updateNodeInternals(id)
  }, [id, roleIds, updateNodeInternals])

  return (
    <FlowNodeShell
      className="w-90"
      footer={element
        ? (
            <div className="
              flex w-full flex-col gap-1 text-[11px] text-muted-foreground
            "
            >
              <div className="
                relative flex min-h-6 items-center justify-between gap-3
              "
              >
                <span>{t('flows.outputs.elementContext')}</span>
                <FlowHandle
                  ariaLabel={t('flows.handles.elementContextOutput')}
                  id="context"
                  side="output"
                  valueType="ElementContext"
                />
              </div>
              {roles.map((role) => {
                const count = kit.filter(link => link.role === role.id).length
                const valueType = assetTypeToValueType(role.accepts[0])
                const fixed = getElementTypeDefinition(element.type).assetRoles.some(item => item.id === role.id)
                const label = fixed
                  ? t(`elements.types.${element.type}.assetRoles.${role.id}.label`)
                  : role.id
                return (
                  <div
                    className="
                      relative flex min-h-6 items-center justify-between gap-3
                    "
                    key={role.id}
                  >
                    <span className="truncate">{label}</span>
                    <span className="flex items-center gap-2">
                      {t('flows.assetCount', { count })}
                      <FlowHandle
                        ariaLabel={t('flows.handles.elementRoleOutput', { role: label })}
                        id={`role:${role.id}`}
                        side="output"
                        valueType={valueType}
                      />
                    </span>
                  </div>
                )
              })}
            </div>
          )
        : undefined}
      icon={Icon}
      nodeId={id}
      selected={selected}
      title={element?.name ?? t('flows.nodes.element')}
    >
      {element
        ? (
            <>
              {preview && (
                <div
                  className="
                    pointer-events-none relative flex aspect-4/3 items-center
                    justify-center overflow-hidden rounded-lg border
                    border-border/70 bg-background
                  "
                >
                  <div className="size-full">
                    <AssetMediaPreview asset={preview.asset} />
                  </div>
                </div>
              )}
              <div className="
                flex items-center justify-between gap-3 text-[11px]
                text-muted-foreground
              "
              >
                <span>{t(elementTypeTranslationKey(element.type, 'label'))}</span>
                <span>{t('flows.assetCount', { count: kit.length })}</span>
              </div>
            </>
          )
        : (
            <button
              className="
                nodrag nopan flex min-h-40 flex-col items-center justify-center
                gap-2 rounded-lg border border-dashed bg-muted/15 p-4
                text-center outline-none
                hover:bg-muted/30
                focus-visible:ring-2 focus-visible:ring-ring
              "
              type="button"
              onClick={() => canvas.openElementPicker(id)}
            >
              <IconComponents className="size-7 text-muted-foreground" />
              <span className="text-sm font-medium">{t('flows.chooseElement')}</span>
              <span className="text-xs text-muted-foreground">
                {t('flows.chooseElementDescription')}
              </span>
            </button>
          )}
    </FlowNodeShell>
  )
})
