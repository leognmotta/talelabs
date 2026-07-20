/** Toolbar command that banks one canvas image Asset into an Element. */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ElementIcon } from '../../../../../shared/domain-icons'
import { AddToElementDialog } from '../../../../elements/add-to-element-dialog'
import { FlowToolbarButton } from './flow-toolbar-button'

/** Opens the shared Add to Element flow for one persisted image Asset. */
export function FlowAddToElementToolbarAction({
  assetId,
}: {
  assetId: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <FlowToolbarButton
        icon={ElementIcon}
        label={t('elements.addToElementAction')}
        onClick={() => setOpen(true)}
      />
      <AddToElementDialog
        assetIds={[assetId]}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
