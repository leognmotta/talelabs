import type { Asset, Folder } from '@talelabs/sdk'

import { Button } from '@talelabs/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@talelabs/ui/components/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from '@talelabs/ui/components/select'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { validateLibraryMove } from './drag-and-drop/folder-move-validation'

export type MoveDialogTarget
  = | { assets: Asset[], type: 'assets' }
    | { folder: Folder, type: 'folder' }

export function MoveToFolderDialog({
  folders,
  onMove,
  onOpenChange,
  open,
  pending,
  target,
}: {
  folders: Folder[]
  onMove: (folderId: null | string) => Promise<void>
  onOpenChange: (open: boolean) => void
  open: boolean
  pending: boolean
  target: MoveDialogTarget | null
}) {
  const { t } = useTranslation()
  const [folderId, setFolderId] = useState('root')
  const source = target?.type === 'assets'
    ? {
        assetIds: target.assets.map(asset => asset.id),
        sourceFolderId: target.assets[0]?.folderId ?? null,
        type: 'asset' as const,
      }
    : target?.type === 'folder'
      ? {
          folderId: target.folder.id,
          parentId: target.folder.parentId,
          type: 'folder' as const,
        }
      : null
  const destinationFolderId = folderId === 'root' ? null : folderId
  const validation = source
    ? validateLibraryMove(source, destinationFolderId, folders)
    : { allowed: false as const }
  const destinationName = destinationFolderId === null
    ? t('assets.rootFolder')
    : folders.find(folder => folder.id === destinationFolderId)?.name

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('assets.moveToFolder')}</DialogTitle>
          <DialogDescription>
            {target?.type === 'folder'
              ? t('assets.moveFolderDescription', { name: target.folder.name })
              : t('assets.moveFilesDescription', { count: target?.assets.length ?? 0 })}
          </DialogDescription>
        </DialogHeader>
        <Select value={folderId} onValueChange={value => setFolderId(value ?? 'root')}>
          <SelectTrigger className="w-full" aria-label={t('assets.destinationFolder')}>
            <span>{destinationName}</span>
          </SelectTrigger>
          <SelectContent align="start">
            <SelectGroup>
              <SelectItem
                disabled={source ? !validateLibraryMove(source, null, folders).allowed : true}
                value="root"
              >
                {t('assets.rootFolder')}
              </SelectItem>
              {folders.map(folder => (
                <SelectItem
                  disabled={source ? !validateLibraryMove(source, folder.id, folders).allowed : true}
                  key={folder.id}
                  value={folder.id}
                >
                  {folder.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button
            disabled={pending || !validation.allowed}
            type="button"
            onClick={() => void onMove(destinationFolderId)}
          >
            {pending ? t('common.saving') : t('assets.move')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
