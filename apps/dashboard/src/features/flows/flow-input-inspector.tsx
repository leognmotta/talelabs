import type { FlowInputState } from './flow-canvas-types'

import { Button } from '@talelabs/ui/components/button'
import { Checkbox } from '@talelabs/ui/components/checkbox'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@talelabs/ui/components/sheet'
import { cn } from '@talelabs/ui/lib/utils'
import { useTranslation } from 'react-i18next'
import { FlowActionTooltip } from './flow-action-tooltip'

export function FlowInputInspector({
  inputState,
  onOpenChange,
  onSelectionChange,
  open,
  title,
}: {
  inputState: FlowInputState | null
  onOpenChange: (open: boolean) => void
  onSelectionChange: (selection: { mode: 'auto' } | { assetIds: string[], mode: 'manual' }) => void
  open: boolean
  title: string
}) {
  const { t } = useTranslation()
  const selected = new Set(inputState?.selectedAssetIds ?? [])

  function toggleAsset(assetId: string, checked: boolean) {
    if (!inputState)
      return
    const currentIds = inputState.selectedAssetIds
    const nextIds = checked
      ? [...currentIds.filter(id => id !== assetId), assetId]
      : currentIds.filter(id => id !== assetId)
    onSelectionChange({ assetIds: nextIds, mode: 'manual' })
  }

  function removeUnavailableAsset(assetId: string) {
    if (!inputState)
      return
    onSelectionChange({
      assetIds: inputState.selectedAssetIds.filter(id => id !== assetId),
      mode: 'manual',
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md" closeLabel={t('common.close')}>
        <SheetHeader>
          <SheetTitle>{t('flows.inputInspector.title', { input: title })}</SheetTitle>
          <SheetDescription>
            {t('flows.inputInspector.description', {
              available: inputState?.availableCount ?? 0,
              maximum: inputState?.maximum ?? 0,
            })}
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-6">
          {inputState?.unavailableAssetIds.map(assetId => (
            <div
              className="
                flex items-center gap-3 rounded-2xl border border-destructive/40
                bg-destructive/5 p-3
              "
              key={assetId}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {t('flows.inputInspector.unavailable')}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {t('flows.inputInspector.unavailableDescription')}
                </p>
              </div>
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={() => removeUnavailableAsset(assetId)}
              >
                {t('common.remove')}
              </Button>
            </div>
          ))}
          {inputState?.candidates.length
            ? inputState.candidates.map((candidate) => {
                const checked = selected.has(candidate.assetId)
                const selectedOrder = inputState.selectedAssetIds
                  .indexOf(candidate.assetId) + 1
                const wouldOverflow = !checked
                  && inputState.selectedAvailableCount >= inputState.maximum
                return (
                  <label
                    className={cn(
                      `
                        flex cursor-pointer items-center gap-3 rounded-2xl
                        border p-2
                      `,
                      checked && 'border-primary/50 bg-primary/5',
                      wouldOverflow && 'cursor-not-allowed opacity-50',
                    )}
                    key={candidate.assetId}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={wouldOverflow}
                      onCheckedChange={next => toggleAsset(candidate.assetId, next)}
                    />
                    <div className="
                      size-14 shrink-0 overflow-hidden rounded-xl bg-muted
                    "
                    >
                      {candidate.thumbnailUrl && (
                        <img alt="" className="size-full object-cover" src={candidate.thumbnailUrl} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{candidate.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {candidate.sourceName}
                        {candidate.isPrimary ? ` · ${t('flows.inputInspector.primary')}` : ''}
                      </p>
                    </div>
                    {selectedOrder > 0 && (
                      <span className="
                        flex size-6 shrink-0 items-center justify-center
                        rounded-full bg-primary text-xs text-primary-foreground
                      "
                      >
                        {selectedOrder}
                      </span>
                    )}
                  </label>
                )
              })
            : (
                <p className="
                  rounded-2xl border border-dashed p-6 text-center text-sm
                  text-muted-foreground
                "
                >
                  {t('flows.inputInspector.noCandidates')}
                </p>
              )}
        </div>
        <SheetFooter>
          <FlowActionTooltip
            disabled={inputState?.mode === 'auto'}
            label={t('flows.inputInspector.useAutomatic')}
          >
            <Button
              disabled={inputState?.mode === 'auto'}
              variant="outline"
              onClick={() => onSelectionChange({ mode: 'auto' })}
            >
              {t('flows.inputInspector.useAutomatic')}
            </Button>
          </FlowActionTooltip>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
