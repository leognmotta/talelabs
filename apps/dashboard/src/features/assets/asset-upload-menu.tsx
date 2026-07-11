import { IconFileUpload, IconFolderUp, IconUpload } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@talelabs/ui/components/dropdown-menu'
import { useTranslation } from 'react-i18next'

export function AssetUploadMenu({
  onChooseFiles,
  onChooseFolder,
}: {
  onChooseFiles: () => void
  onChooseFolder: () => void
}) {
  const { t } = useTranslation()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" />}>
        <IconUpload data-icon="inline-start" />
        {t('assets.upload')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onChooseFiles}>
            <IconFileUpload />
            {t('assets.file')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onChooseFolder}>
            <IconFolderUp />
            {t('assets.folder')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
