/**
 * Shared media-family switcher for direct Create composer presentations.
 */

import type { CreateMode } from './create-draft'

import {
  IconPhoto,
  IconVideo,
  IconWaveSine,
} from '@tabler/icons-react'
import { Tabs, TabsList, TabsTrigger } from '@talelabs/ui/components/tabs'
import { useTranslation } from 'react-i18next'

/** Renders the canonical Image, Video, and Audio mode tabs. */
export function CreateComposerModeTabs({
  mode,
  onModeChange,
}: {
  /** Currently selected direct Create media family. */
  mode: CreateMode
  /** Adopts one direct Create media family. */
  onModeChange: (mode: CreateMode) => void
}) {
  const { t } = useTranslation()

  return (
    <Tabs
      className="min-w-0"
      value={mode}
      onValueChange={value => onModeChange(value as CreateMode)}
    >
      <TabsList className="h-8 max-w-full bg-muted/55 p-0.5">
        <TabsTrigger className="h-7 px-2.5" value="image">
          <IconPhoto />
          <span className="
            hidden
            sm:inline
          "
          >
            {t('create.modes.image')}
          </span>
        </TabsTrigger>
        <TabsTrigger className="h-7 px-2.5" value="video">
          <IconVideo />
          <span className="
            hidden
            sm:inline
          "
          >
            {t('create.modes.video')}
          </span>
        </TabsTrigger>
        <TabsTrigger className="h-7 px-2.5" value="audio">
          <IconWaveSine />
          <span className="
            hidden
            sm:inline
          "
          >
            {t('create.modes.audio')}
          </span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
