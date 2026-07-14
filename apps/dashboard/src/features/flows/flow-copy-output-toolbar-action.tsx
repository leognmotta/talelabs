import { IconCopy } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { FlowToolbarButton } from './flow-toolbar-button'
import { useCopyOutputText } from './use-copy-output-text'

export function FlowCopyOutputToolbarAction({
  outputText,
}: {
  outputText: null | string
}) {
  const { t } = useTranslation()
  const copyOutputText = useCopyOutputText(outputText)

  return (
    <FlowToolbarButton
      disabled={!outputText}
      icon={IconCopy}
      label={t('flows.llm.preview.copy')}
      onClick={() => void copyOutputText()}
    />
  )
}
