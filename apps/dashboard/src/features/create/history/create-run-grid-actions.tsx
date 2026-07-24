/** Progressive-disclosure actions over one Create bento result tile. */

import type { FlowRunAssetOutput, FlowRunSummary } from '@talelabs/sdk'

import {
  IconDots,
  IconExternalLink,
  IconPaperclip,
  IconPlayerStop,
  IconRefresh,
  IconRestore,
  IconVideo,
} from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@talelabs/ui/components/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@talelabs/ui/components/tooltip'
import { useTranslation } from 'react-i18next'

/** Reveals direct result actions on hover, focus, or touch-capable devices. */
export function CreateRunGridActions({
  output,
  primary,
  run,
  onCancel,
  onMakeVideo,
  onOpenAsset,
  onRetry,
  onReuseRequest,
  onUseAsReference,
}: {
  /** Canonical output represented by this card, when one exists. */
  output: FlowRunAssetOutput | null
  /** Whether this is the first card for the run and may expose run-level commands. */
  primary: boolean
  /** Immutable run owning the displayed result or state. */
  run: FlowRunSummary
  /** Requests durable cancellation through the ordinary run API. */
  onCancel: (run: FlowRunSummary) => void
  /** Composes an Image output as a Video start frame. */
  onMakeVideo: (output: FlowRunAssetOutput) => void
  /** Opens the existing shared Asset viewer. */
  onOpenAsset: (assetId: string) => void
  /** Admits a new retry from immutable historical state. */
  onRetry: (run: FlowRunSummary) => void
  /** Restores the immutable request into the current draft. */
  onReuseRequest: (run: FlowRunSummary) => void
  /** Explicitly attaches one prior result to the next request. */
  onUseAsReference: (output: FlowRunAssetOutput) => void
}) {
  const { t } = useTranslation()
  const active = run.status === 'pending' || run.status === 'running'
  const retryable = ['canceled', 'failed', 'partial'].includes(run.status)

  return (
    <>
      <div className="
        pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-linear-to-t
        from-black/55 via-black/10 to-transparent opacity-0 transition-opacity
        duration-200
        group-focus-within:opacity-100
        group-hover:opacity-100
        motion-reduce:transition-none
        [@media(hover:none)]:opacity-100
      "
      />
      <div className="
        pointer-events-none absolute inset-x-0 bottom-0 flex items-end
        justify-between gap-2 p-3 opacity-0 transition-opacity duration-200
        group-focus-within:pointer-events-auto group-focus-within:opacity-100
        group-hover:pointer-events-auto group-hover:opacity-100
        motion-reduce:transition-none
        [@media(hover:none)]:pointer-events-auto
        [@media(hover:none)]:opacity-100
      "
      >
        {output
          ? (
              <Button
                className="pointer-events-auto rounded-full shadow-sm"
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => onOpenAsset(output.assetId)}
              >
                <IconExternalLink data-icon="inline-start" />
                {t('create.results.openAsset')}
              </Button>
            )
          : <span />}
        <div className="pointer-events-auto flex items-center gap-1">
          {output && (
            <Tooltip>
              <TooltipTrigger
                render={(
                  <Button
                    aria-label={t('create.results.useAsReference')}
                    className="rounded-full shadow-sm"
                    size="icon-sm"
                    type="button"
                    variant="secondary"
                    onClick={() => onUseAsReference(output)}
                  />
                )}
              >
                <IconPaperclip />
              </TooltipTrigger>
              <TooltipContent side="top">
                {t('create.results.useAsReference')}
              </TooltipContent>
            </Tooltip>
          )}
          {output?.type === 'image' && (
            <Tooltip>
              <TooltipTrigger
                render={(
                  <Button
                    aria-label={t('create.results.makeVideo')}
                    className="rounded-full shadow-sm"
                    size="icon-sm"
                    type="button"
                    variant="secondary"
                    onClick={() => onMakeVideo(output)}
                  />
                )}
              >
                <IconVideo />
              </TooltipTrigger>
              <TooltipContent side="top">
                {t('create.results.makeVideo')}
              </TooltipContent>
            </Tooltip>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t('common.moreOptions')}
              className="rounded-full shadow-sm"
              render={<Button size="icon-sm" variant="secondary" />}
            >
              <IconDots />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => onReuseRequest(run)}>
                  <IconRestore />
                  {t('create.history.reuseRequest')}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              {primary && (active || retryable) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {active
                      ? (
                          <DropdownMenuItem onClick={() => onCancel(run)}>
                            <IconPlayerStop />
                            {t('common.cancel')}
                          </DropdownMenuItem>
                        )
                      : (
                          <DropdownMenuItem onClick={() => onRetry(run)}>
                            <IconRefresh />
                            {t('create.history.retry')}
                          </DropdownMenuItem>
                        )}
                  </DropdownMenuGroup>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  )
}
