import type { Tag } from '@talelabs/sdk'

import { Badge } from '@talelabs/ui/components/badge'
import { useTranslation } from 'react-i18next'

export function AssetTagBadges({ tags }: { tags: Tag[] }) {
  const { t } = useTranslation()
  const visibleTags = tags.slice(0, 2)
  const remaining = tags.length - visibleTags.length

  if (tags.length === 0)
    return null

  return (
    <div className="flex min-w-0 items-center gap-1" aria-label={t('assets.tags')}>
      {visibleTags.map(tag => (
        <Badge className="max-w-24 truncate" key={tag.id} title={tag.name} variant="outline">
          {tag.name}
        </Badge>
      ))}
      {remaining > 0 && (
        <Badge title={t('assets.moreTags', { count: remaining })} variant="outline">
          +
          {remaining}
        </Badge>
      )}
    </div>
  )
}
