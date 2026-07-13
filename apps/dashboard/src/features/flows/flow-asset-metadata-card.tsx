import type { FlowReferenceAsset } from '@talelabs/sdk'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@talelabs/ui/components/card'
import { useTranslation } from 'react-i18next'
import { formatAssetSize, formatDuration } from '../assets/asset-formatters'

function getAssetFormat(asset: FlowReferenceAsset) {
  return asset.mimeType.split('/').at(-1)?.split(';')[0]?.toUpperCase()
}

function MetadataRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-48 truncate text-right font-medium" title={value}>
        {value}
      </dd>
    </div>
  )
}

export function FlowAssetMetadataCard({ asset }: { asset: FlowReferenceAsset }) {
  const { i18n, t } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'en'
  const format = getAssetFormat(asset)
  const size = formatAssetSize(asset.sizeBytes, locale)
  const dimensions = asset.width && asset.height
    ? `${asset.width} × ${asset.height}`
    : null
  const duration = formatDuration(asset.durationSeconds)
  const createdAt = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(asset.createdAt))

  return (
    <aside aria-label={t('assets.details')}>
      <Card className="w-80" size="sm">
        <CardHeader className="border-b">
          <CardTitle className="truncate" title={asset.name}>
            {asset.name}
          </CardTitle>
          <CardDescription>{t(`assets.types.${asset.type}`)}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-2.5 text-sm">
            {asset.generationModel && (
              <MetadataRow label={t('flows.model')} value={asset.generationModel} />
            )}
            {format && (
              <MetadataRow label={t('assets.metadata.format')} value={format} />
            )}
            {size && <MetadataRow label={t('assets.size')} value={size} />}
            {dimensions && (
              <MetadataRow label={t('assets.dimensions')} value={dimensions} />
            )}
            {duration && (
              <MetadataRow label={t('assets.duration')} value={duration} />
            )}
            <MetadataRow
              label={t('assets.source')}
              value={t(`assets.sources.${asset.source}`)}
            />
            <MetadataRow label={t('assets.dateCreated')} value={createdAt} />
          </dl>
        </CardContent>
      </Card>
    </aside>
  )
}
