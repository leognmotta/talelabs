import type { ElementAssetMediaType } from '@talelabs/elements'

import { Button } from '@talelabs/ui/components/button'
import { useTranslation } from 'react-i18next'

export function ElementRoleMediaTypePicker({
  allowedMediaTypes,
  disabled = false,
  onChange,
  value,
}: {
  allowedMediaTypes: readonly ElementAssetMediaType[]
  disabled?: boolean
  onChange: (value: ElementAssetMediaType) => void
  value: ElementAssetMediaType
}) {
  const { t } = useTranslation()

  return (
    <div
      aria-label={t('assets.type')}
      className="flex flex-wrap gap-2"
      role="radiogroup"
    >
      {allowedMediaTypes.map(mediaType => (
        <Button
          key={mediaType}
          aria-checked={value === mediaType}
          disabled={disabled}
          role="radio"
          size="sm"
          type="button"
          variant={value === mediaType ? 'secondary' : 'outline'}
          onClick={() => onChange(mediaType)}
        >
          {t(`assets.types.${mediaType}`)}
        </Button>
      ))}
    </div>
  )
}
