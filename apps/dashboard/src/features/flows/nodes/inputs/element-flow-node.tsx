/** Memoized Element node presenting its configured reference output. */

import type { NodeProps } from '@xyflow/react'
import type { CanvasNode } from '../../editor/flow-canvas-types'

import { IconAlertTriangle } from '@tabler/icons-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { ElementIcon } from '../../../../shared/domain-icons'
import { AssetMediaPreview } from '../../../assets/media/asset-media-preview'
import { ELEMENT_KIND_ICONS, elementKindLabelKey } from '../../../elements/element-kind-meta'
import { useCanvasStore, useCanvasStoreApi } from '../../editor/canvas-state/canvas-store-context'
import { useFlowCanvasRuntime } from '../../editor/flow-canvas-runtime-context'
import { aspectRatioFromDimensions } from '../shared/flow-node-aspect-ratio'
import { FlowNodeShell } from '../shared/flow-node-shell'
import { FlowNodeOutputFooter } from '../shared/media/flow-node-output-footer'
import { FlowNodePreviewStage } from '../shared/media/flow-node-preview-stage'
import { FlowNodeSelectionStage } from '../shared/media/flow-node-selection-stage'

const PREVIEW_STACK_COUNT = 3

/** Renders one Element node from hydrated reference data only. */
export const ElementFlowNode = memo(({
  id,
  selected,
}: NodeProps<CanvasNode>) => {
  const { t } = useTranslation()
  const store = useCanvasStoreApi()
  const runtime = useFlowCanvasRuntime()
  const elementId = useCanvasStore((state) => {
    const data = state.nodes.find(node => node.id === id)?.data
    return typeof data?.elementId === 'string' ? data.elementId : null
  })
  const selectedKey = useCanvasStore((state) => {
    const value = state.nodes.find(candidate => candidate.id === id)
      ?.data
      .selectedAssetIds
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
          .join(' ')
      : ''
  })
  const selectedAssetIds = selectedKey === '' ? [] : selectedKey.split(' ')
  const element = elementId
    ? runtime.referenceData.elementsById.get(elementId)
    : undefined
  const referenceAssetIds = element?.referenceAssetIds ?? []
  const selectedSet = new Set(selectedAssetIds)
  const emittedAssets = referenceAssetIds
    .filter(assetId => selectedSet.has(assetId))
    .map(assetId => runtime.referenceData.assetsById.get(assetId))
    .filter(asset => asset !== undefined)
  const staleCount = selectedAssetIds
    .filter(assetId => !referenceAssetIds.includes(assetId))
    .length
  const coverAsset = emittedAssets[0]
  const coverAspectRatio = coverAsset
    ? aspectRatioFromDimensions(coverAsset.width, coverAsset.height)
    : null
  const stackAssets = emittedAssets.slice(1, 1 + PREVIEW_STACK_COUNT)
  const KindIcon = element
    ? ELEMENT_KIND_ICONS[element.kind as keyof typeof ELEMENT_KIND_ICONS]
    ?? ElementIcon
    : ElementIcon

  function openPicker() {
    store.setState({ elementPickerNodeId: id })
  }

  return (
    <FlowNodeShell
      accentValueType="ImageSet"
      className="w-96"
      contentClassName="gap-0 p-0"
      footer={element
        ? (
            <FlowNodeOutputFooter
              ariaLabel={t('flows.handles.elementOutput')}
              handleId="references"
              label={t('flows.outputs.references')}
              valueType="ImageSet"
            >
              <span>
                {t(elementKindLabelKey(
                  element.kind as Parameters<typeof elementKindLabelKey>[0],
                ))}
              </span>
              <span>
                {t('elements.referenceCount', { count: emittedAssets.length })}
              </span>
              {staleCount > 0 && (
                <span className="
                  flex items-center gap-1 font-medium text-destructive
                "
                >
                  <IconAlertTriangle aria-hidden className="size-3" />
                  {t('elements.staleSelection', { count: staleCount })}
                </span>
              )}
            </FlowNodeOutputFooter>
          )
        : undefined}
      icon={KindIcon}
      nodeId={id}
      selected={selected}
      title={element?.name ?? t('flows.nodes.element')}
    >
      {element
        ? (
            <FlowNodePreviewStage
              aspectRatio={coverAspectRatio ?? undefined}
              valueType="ImageSet"
            >
              <div className="
                pointer-events-none absolute inset-0 overflow-hidden
              "
              >
                {coverAsset
                  ? (
                      <span className="
                        pointer-events-none absolute inset-0 flex items-center
                        justify-center
                      "
                      >
                        <AssetMediaPreview
                          asset={coverAsset}
                          className="object-cover"
                        />
                      </span>
                    )
                  : (
                      <span className="
                        absolute inset-0 flex flex-col items-center
                        justify-center gap-2 text-muted-foreground
                      "
                      >
                        <KindIcon aria-hidden className="size-10" stroke={1.25} />
                        <span className="text-xs">
                          {t('elements.emptyNodeDescription')}
                        </span>
                      </span>
                    )}
                {stackAssets.length > 0 && (
                  <span className="
                    pointer-events-none absolute bottom-2 left-2 flex
                    items-center
                  "
                  >
                    {stackAssets.map(asset => (
                      <span
                        className="
                          -mr-2.5 size-9 overflow-hidden rounded-md border-2
                          border-background bg-muted shadow-sm
                        "
                        key={asset.id}
                      >
                        {(asset.thumbnailUrl ?? asset.url) && (
                          <img
                            alt=""
                            className="size-full object-cover"
                            loading="lazy"
                            src={asset.thumbnailUrl ?? asset.url ?? undefined}
                          />
                        )}
                      </span>
                    ))}
                    {emittedAssets.length > 1 + PREVIEW_STACK_COUNT && (
                      <span className="
                        z-10 ml-3.5 flex size-9 items-center justify-center
                        rounded-md border-2 border-background bg-muted text-xs
                        font-semibold text-muted-foreground shadow-sm
                      "
                      >
                        {`+${emittedAssets.length - 1 - PREVIEW_STACK_COUNT}`}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </FlowNodePreviewStage>
          )
        : (
            <FlowNodeSelectionStage
              description={t('flows.chooseElementDescription')}
              icon={ElementIcon}
              label={t('flows.chooseElement')}
              valueType="ImageSet"
              onSelect={openPicker}
            />
          )}
    </FlowNodeShell>
  )
})
