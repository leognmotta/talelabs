/** Download command presentation for one canonical media or text output. */

import { IconDownload } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { FlowToolbarButton } from './flow-toolbar-button'

/** Displays the output download command and disables it until content exists. */
export function FlowDownloadToolbarAction({
  onDownload,
}: {
  onDownload?: () => void
}) {
  const { t } = useTranslation()

  return (
    <FlowToolbarButton
      disabled={!onDownload}
      icon={IconDownload}
      label={t('assets.download')}
      onClick={onDownload}
    />
  )
}
