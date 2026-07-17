/** Catalog-ordered projection of active generation settings into typed controls. */

import type {
  GenerationSettingDefinition,
  GenerationSettingValue,
} from '@talelabs/flows'

import { IconAdjustmentsHorizontal } from '@tabler/icons-react'
import { cn } from '@talelabs/ui/lib/utils'
import { useTranslation } from 'react-i18next'
import { GenerationSettingField } from './generation-setting-field'
import { GenerationSettingsSection } from './generation-settings-section'

/** Renders active catalog settings in their declared order with normalized values. */
export function GenerationSettingsList({
  layout = 'afterControls',
  settings,
  values,
  onValueChange,
}: {
  layout?: 'afterControls' | 'standalone'
  onValueChange: (settingId: string, value: GenerationSettingValue) => void
  settings: readonly GenerationSettingDefinition[]
  values: Readonly<Record<string, GenerationSettingValue>>
}) {
  const { t } = useTranslation()
  const primarySettings = settings.filter(setting => !setting.advanced)
  const advancedSettings = settings.filter(setting => setting.advanced)
  const divided = layout === 'afterControls'

  return (
    <>
      {primarySettings.length > 0 && (
        <GenerationSettingsSection divided={divided}>
          {primarySettings.map(setting => (
            <GenerationSettingField
              key={setting.id}
              setting={setting}
              value={values[setting.id] ?? setting.default}
              onValueChange={value => onValueChange(setting.id, value)}
            />
          ))}
        </GenerationSettingsSection>
      )}
      {advancedSettings.length > 0 && (
        <details className={cn(
          'group pt-3',
          (divided || primarySettings.length > 0)
          && 'border-t border-border/70',
        )}
        >
          <summary className="
            flex cursor-pointer list-none items-center gap-2 text-xs font-medium
            text-muted-foreground outline-none
            focus-visible:ring-2 focus-visible:ring-ring
          "
          >
            <IconAdjustmentsHorizontal aria-hidden className="size-3.5" />
            {t('flows.settings.advanced')}
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {advancedSettings.map(setting => (
              <GenerationSettingField
                key={setting.id}
                setting={setting}
                value={values[setting.id] ?? setting.default}
                onValueChange={value => onValueChange(setting.id, value)}
              />
            ))}
          </div>
        </details>
      )}
    </>
  )
}
