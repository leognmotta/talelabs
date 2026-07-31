/**
 * Conversion-focused generation funding chooser shown before blocked admission.
 *
 * The dialog explains the three existing TaleLabs funding paths and delegates
 * each choice to its established Settings destination.
 */

import {
  IconArrowRight,
  IconCoins,
  IconCreditCard,
  IconInfoCircle,
  IconKey,
  IconSparkles,
} from '@tabler/icons-react'
import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@talelabs/ui/components/dialog'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@talelabs/ui/components/item'
import { useTranslation } from 'react-i18next'
import { formatCredits } from './billing-format'

/** Existing Settings destination selected from the generation access dialog. */
export type GenerationAccessDestination = 'credits' | 'plans' | 'secureStore'

/** Facts captured when a generation action cannot be admitted locally. */
export interface GenerationAccessDialogRequest {
  /** Last known workspace balance, or null when the account query failed. */
  availableCredits: null | number
  /** Whether the current member may complete a Stripe billing action. */
  canManageBilling: boolean | null
  /** Why the funding chooser replaced the attempted generation action. */
  reason: 'apiKeyRequired' | 'creditsRequired'
  /** Advisory quote for the attempted action, when one was available. */
  requiredCredits: null | number
}

/** Presents Plan, one-time Credit, and browser API-key funding choices. */
export function GenerationAccessDialog({
  onOpenChange,
  onSelect,
  request,
}: {
  /** Closes the dialog without changing the current funding preference. */
  onOpenChange: (open: boolean) => void
  /** Routes one explicit funding choice through its existing Settings surface. */
  onSelect: (destination: GenerationAccessDestination) => void
  /** Current blocked-admission facts, or null while the dialog is closed. */
  request: GenerationAccessDialogRequest | null
}) {
  const { i18n, t } = useTranslation()
  const hasCreditSummary = request?.reason === 'creditsRequired'
    && request.requiredCredits !== null
    && request.availableCredits !== null

  return (
    <Dialog
      open={request !== null}
      onOpenChange={onOpenChange}
    >
      <DialogContent
        className="
          max-h-[calc(100svh-2rem)] gap-5 overflow-y-auto
          sm:max-w-xl
        "
        closeLabel={t('common.close')}
      >
        <div className="flex items-start gap-3 pr-10">
          <div className="
            flex size-10 shrink-0 items-center justify-center rounded-2xl
            bg-primary/10 text-primary
          "
          >
            <IconSparkles className="size-5" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-lg">
              {t('generationAccess.title')}
            </DialogTitle>
            <DialogDescription>
              {t(request?.reason === 'apiKeyRequired'
                ? 'generationAccess.apiKeyRequiredDescription'
                : 'generationAccess.creditsRequiredDescription')}
            </DialogDescription>
          </DialogHeader>
        </div>

        {hasCreditSummary && (
          <div className="
            flex flex-wrap items-center justify-between gap-2 rounded-2xl
            bg-muted/50 px-4 py-3
          "
          >
            <span className="text-sm font-medium">
              {t('generationAccess.creditSummaryTitle')}
            </span>
            <span className="text-sm text-muted-foreground tabular-nums">
              {t('generationAccess.creditSummary', {
                available: formatCredits(
                  request.availableCredits!,
                  i18n.language,
                ),
                required: formatCredits(
                  request.requiredCredits!,
                  i18n.language,
                ),
              })}
            </span>
          </div>
        )}

        <ItemGroup>
          <Item
            className="border-primary/25 bg-primary/5"
            role="listitem"
            variant="outline"
          >
            <ItemMedia
              className="size-9 rounded-xl bg-primary/10 text-primary"
              variant="icon"
            >
              <IconCreditCard />
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle
                className="line-clamp-none flex-wrap whitespace-normal"
              >
                {t('generationAccess.planTitle')}
                <Badge variant="secondary">
                  {t('generationAccess.recommended')}
                </Badge>
              </ItemTitle>
              <ItemDescription className="line-clamp-none">
                {t('generationAccess.planDescription')}
              </ItemDescription>
            </ItemContent>
            <ItemActions className="
              basis-full
              sm:basis-auto
            "
            >
              <Button
                className="
                  w-full
                  sm:w-auto
                "
                type="button"
                onClick={() => onSelect('plans')}
              >
                {t('generationAccess.planAction')}
                <IconArrowRight data-icon="inline-end" />
              </Button>
            </ItemActions>
          </Item>

          <Item role="listitem" variant="outline">
            <ItemMedia
              className="size-9 rounded-xl bg-muted text-foreground"
              variant="icon"
            >
              <IconCoins />
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle>{t('generationAccess.creditsTitle')}</ItemTitle>
              <ItemDescription className="line-clamp-none">
                {t('generationAccess.creditsDescription')}
              </ItemDescription>
            </ItemContent>
            <ItemActions className="
              basis-full
              sm:basis-auto
            "
            >
              <Button
                className="
                  w-full
                  sm:w-auto
                "
                type="button"
                variant="outline"
                onClick={() => onSelect('credits')}
              >
                {t('generationAccess.creditsAction')}
                <IconArrowRight data-icon="inline-end" />
              </Button>
            </ItemActions>
          </Item>

          <Item role="listitem" variant="outline">
            <ItemMedia
              className="size-9 rounded-xl bg-muted text-foreground"
              variant="icon"
            >
              <IconKey />
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle>{t('generationAccess.apiKeyTitle')}</ItemTitle>
              <ItemDescription className="line-clamp-none">
                {t('generationAccess.apiKeyDescription')}
              </ItemDescription>
            </ItemContent>
            <ItemActions className="
              basis-full
              sm:basis-auto
            "
            >
              <Button
                className="
                  w-full
                  sm:w-auto
                "
                type="button"
                variant="outline"
                onClick={() => onSelect('secureStore')}
              >
                {t('generationAccess.apiKeyAction')}
                <IconArrowRight data-icon="inline-end" />
              </Button>
            </ItemActions>
          </Item>
        </ItemGroup>

        {request?.canManageBilling === false && (
          <p
            className="flex items-start gap-2 text-xs text-muted-foreground"
          >
            <IconInfoCircle className="mt-0.5 size-4 shrink-0" />
            <span>{t('generationAccess.adminNotice')}</span>
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
