import { IconArchive, IconFileDescription } from '@tabler/icons-react'
import { Card, CardContent } from '@talelabs/ui/components/card'
import { cn } from '@talelabs/ui/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ELEMENT_FORM_SECTION_ORDER,
  ELEMENT_FORM_SECTIONS,
} from './element-form-sections'

type ElementFormSectionId
  = typeof ELEMENT_FORM_SECTIONS[keyof typeof ELEMENT_FORM_SECTIONS]

const SECTION_LINK_CLASS = `
  flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors
`

function findScrollContainer(element: HTMLElement) {
  let ancestor = element.parentElement
  while (ancestor) {
    const overflowY = window.getComputedStyle(ancestor).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll')
      return ancestor
    ancestor = ancestor.parentElement
  }
  return window
}

export function ElementCreateSectionNavigation() {
  const { t } = useTranslation()
  const navigationRef = useRef<HTMLDivElement>(null)
  const [activeSection, setActiveSection] = useState<ElementFormSectionId>(
    ELEMENT_FORM_SECTIONS.data,
  )

  useEffect(() => {
    const navigation = navigationRef.current
    if (!navigation)
      return

    const scrollContainer = findScrollContainer(navigation)
    let frame: null | number = null

    function updateActiveSection() {
      frame = null
      const activationTop = scrollContainer instanceof Window
        ? 32
        : scrollContainer.getBoundingClientRect().top + 32
      let nextSection: ElementFormSectionId = ELEMENT_FORM_SECTIONS.data

      for (const sectionId of ELEMENT_FORM_SECTION_ORDER) {
        const section = document.getElementById(sectionId)
        if (section && section.getBoundingClientRect().top <= activationTop)
          nextSection = sectionId
      }

      setActiveSection(current =>
        current === nextSection ? current : nextSection)
    }

    function scheduleUpdate() {
      if (frame === null)
        frame = window.requestAnimationFrame(updateActiveSection)
    }

    scrollContainer.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    scheduleUpdate()

    return () => {
      if (frame !== null)
        window.cancelAnimationFrame(frame)
      scrollContainer.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [])

  function sectionClass(section: ElementFormSectionId) {
    return cn(
      SECTION_LINK_CLASS,
      activeSection === section
        ? 'bg-muted font-medium text-foreground'
        : `
          text-muted-foreground
          hover:bg-muted hover:text-foreground
        `,
    )
  }

  return (
    <Card
      ref={navigationRef}
      className="
        h-fit
        lg:sticky lg:top-6
      "
    >
      <CardContent className="flex flex-col gap-2 p-3">
        <a
          aria-current={activeSection === ELEMENT_FORM_SECTIONS.data
            ? 'location'
            : undefined}
          className={sectionClass(ELEMENT_FORM_SECTIONS.data)}
          href={`#${ELEMENT_FORM_SECTIONS.data}`}
        >
          <IconFileDescription className="size-4" />
          {t('elements.dataTab')}
        </a>
        <a
          aria-current={activeSection === ELEMENT_FORM_SECTIONS.assets
            ? 'location'
            : undefined}
          className={sectionClass(ELEMENT_FORM_SECTIONS.assets)}
          href={`#${ELEMENT_FORM_SECTIONS.assets}`}
        >
          <IconArchive className="size-4" />
          {t('elements.references')}
        </a>
      </CardContent>
    </Card>
  )
}
