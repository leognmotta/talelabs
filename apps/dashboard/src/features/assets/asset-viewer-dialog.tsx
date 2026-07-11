import { IconRefresh } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@talelabs/ui/components/dialog'
import { Separator } from '@talelabs/ui/components/separator'
import { Skeleton } from '@talelabs/ui/components/skeleton'
import { useTranslation } from 'react-i18next'
import { AssetDetailValue } from './asset-detail-value'
import { formatAssetSize, formatDuration } from './asset-formatters'
import { AssetMediaPreview } from './asset-media-preview'
import { AssetNameDialog } from './asset-name-dialog'
import { AssetPurgeDialog } from './asset-purge-dialog'
import { AssetStatusBadge } from './asset-status-badge'
import { AssetTagBadges } from './asset-tag-badges'
import { AssetViewerActions } from './asset-viewer-actions'
import { useAssetDetailQuery } from './asset.queries'
import { MoveToFolderDialog } from './move-to-folder-dialog'
import { useAssetViewerActions } from './use-asset-viewer-actions'
import { useAssetViewerUrlState } from './use-asset-viewer-url-state'

export function AssetViewerDialog() {
  const { i18n, t } = useTranslation()
  const { assetId, closeAsset } = useAssetViewerUrlState()
  const detail = useAssetDetailQuery(assetId)
  const asset = detail.data
  const locale = i18n.resolvedLanguage ?? 'en'
  const controller = useAssetViewerActions({ asset, onPurged: closeAsset })

  return (
    <Dialog
      open={assetId !== null}
      onOpenChange={open => !open && closeAsset()}
    >
      <DialogContent
        className="
          top-0! left-0! h-svh w-screen max-w-none! translate-none! gap-0
          overflow-hidden rounded-none! bg-background p-0 shadow-none
          sm:max-w-none!
          data-open:zoom-in-100
          data-closed:zoom-out-100
        "
        closeLabel={t('common.close')}
      >
        {!asset && (
          <DialogHeader className="sr-only">
            <DialogTitle>{t('assets.details')}</DialogTitle>
            <DialogDescription>{t('common.loading')}</DialogDescription>
          </DialogHeader>
        )}
        <div className="
          grid h-full min-h-0 grid-rows-[45svh_minmax(0,1fr)]
          lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-1
        "
        >
          <section className="
            grid min-h-0 grid-rows-[4rem_minmax(0,1fr)] bg-black
          "
          >
            <div className="flex items-center justify-center px-6">
              {asset && (
                <AssetViewerActions
                  actions={controller.actions}
                  asset={asset}
                />
              )}
            </div>
            <div className="
              flex min-h-0 items-center justify-center px-6 pb-6
              lg:px-10 lg:pb-10
            "
            >
              {detail.isPending && (
                <Skeleton className="
                  size-full max-h-[80svh] max-w-5xl rounded-xl bg-muted/30
                "
                />
              )}
              {detail.isError && (
                <div className="
                  flex max-w-sm flex-col items-center gap-4 text-center
                  text-white
                "
                >
                  <div>
                    <h2 className="text-lg font-semibold">{t('assets.couldNotLoad')}</h2>
                    <p className="mt-1 text-sm text-white/60">{t('assets.couldNotLoadDescription')}</p>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => void detail.refetch()}>
                    <IconRefresh data-icon="inline-start" />
                    {t('common.retry')}
                  </Button>
                </div>
              )}
              {asset && (
                <AssetMediaPreview
                  asset={asset}
                  className="max-h-full max-w-full rounded-lg"
                  mode="player"
                />
              )}
            </div>
          </section>

          <aside className="
            min-h-0 overflow-y-auto border-l border-border bg-background p-6
            pt-16
          "
          >
            {asset
              ? (
                  <div className="flex flex-col gap-6">
                    <DialogHeader>
                      <div className="pr-10">
                        <AssetStatusBadge asset={asset} />
                        <DialogTitle className="
                          mt-3 text-xl/tight font-semibold
                        "
                        >
                          {asset.name}
                        </DialogTitle>
                      </div>
                      <DialogDescription>
                        {t(`assets.types.${asset.type}`)}
                        {' '}
                        ·
                        {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(asset.createdAt))}
                      </DialogDescription>
                    </DialogHeader>

                    <AssetTagBadges tags={asset.tags} />
                    <Separator />

                    <dl className="grid grid-cols-2 gap-4 text-sm">
                      <AssetDetailValue label={t('assets.type')} value={t(`assets.types.${asset.type}`)} />
                      <AssetDetailValue label={t('assets.source')} value={t(`assets.sources.${asset.source}`)} />
                      <AssetDetailValue label={t('assets.size')} value={formatAssetSize(asset.sizeBytes, locale) ?? '—'} />
                      <AssetDetailValue label={t('assets.dimensions')} value={asset.width && asset.height ? `${asset.width} × ${asset.height}` : '—'} />
                      <AssetDetailValue label={t('assets.duration')} value={formatDuration(asset.durationSeconds) ?? '—'} />
                      <AssetDetailValue label={t('assets.dateCreated')} value={new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(asset.createdAt))} />
                    </dl>

                    {Object.keys(asset.metadata).length > 0 && (
                      <>
                        <Separator />
                        <section className="flex flex-col gap-3">
                          <h3 className="text-sm font-medium">{t('assets.technicalMetadata')}</h3>
                          <dl className="grid grid-cols-2 gap-4 text-sm">
                            {Object.entries(asset.metadata).map(([key, value]) => (
                              <AssetDetailValue
                                key={key}
                                label={t(`assets.metadata.${key}`, { defaultValue: key })}
                                value={value === null ? '—' : String(value)}
                              />
                            ))}
                          </dl>
                        </section>
                      </>
                    )}
                  </div>
                )
              : (
                  <div className="flex flex-col gap-4">
                    <Skeleton className="h-7 w-4/5" />
                    <Skeleton className="h-4 w-2/5" />
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      {Array.from({ length: 6 }, (_, index) => (
                        <Skeleton className="h-10" key={index} />
                      ))}
                    </div>
                  </div>
                )}
          </aside>
        </div>
        <MoveToFolderDialog
          folders={controller.folders}
          key={controller.dialogs.moveAsset?.id ?? 'move-viewer-asset'}
          onMove={controller.onMove}
          onOpenChange={open => !open && controller.dialogs.setMoveAsset(null)}
          open={Boolean(controller.dialogs.moveAsset)}
          pending={controller.mutations.move.isPending}
          target={controller.dialogs.moveAsset
            ? { assets: [controller.dialogs.moveAsset], type: 'assets' }
            : null}
        />
        <AssetPurgeDialog
          asset={controller.dialogs.purgeAsset}
          onConfirm={controller.onPurge}
          onOpenChange={open => !open && controller.dialogs.setPurgeAsset(null)}
          open={Boolean(controller.dialogs.purgeAsset)}
          pending={controller.mutations.purge.isPending}
        />
        <AssetNameDialog
          description={t('assets.renameDescription')}
          initialName={controller.dialogs.renameAsset?.name ?? ''}
          key={controller.dialogs.renameAsset?.id ?? 'rename-viewer-asset'}
          onOpenChange={open => !open && controller.dialogs.setRenameAsset(null)}
          onSubmit={controller.onRename}
          open={Boolean(controller.dialogs.renameAsset)}
          pending={controller.mutations.update.isPending}
          submitLabel={t('common.save')}
          title={t('assets.rename')}
        />
      </DialogContent>
    </Dialog>
  )
}
