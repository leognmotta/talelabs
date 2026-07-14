import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export function useCopyOutputText(outputText: null | string) {
  const { t } = useTranslation()

  return async function copyOutputText() {
    if (!outputText)
      return
    try {
      await navigator.clipboard.writeText(outputText)
      toast.success(t('flows.llm.preview.copySuccess'))
    }
    catch {
      toast.error(t('flows.llm.preview.copyFailed'))
    }
  }
}
