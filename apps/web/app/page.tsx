/** Public TaleLabs homepage for the active Assets to Flows creative loop. */

import {
  IconArrowDown,
  IconArrowUpRight,
  IconPhoto,
  IconVideo,
  IconWaveSine,
} from '@tabler/icons-react'
import { Badge } from '@talelabs/ui/components/badge'
import { buttonVariants } from '@talelabs/ui/components/button'
import { Separator } from '@talelabs/ui/components/separator'
import Image from 'next/image'

import { getWebI18n } from '@/lib/i18n'
import { DASHBOARD_URL } from '@/lib/site'

const mediaTypes = [
  {
    descriptionKey: 'process.collect.description',
    icon: IconPhoto,
    image: '/images/reusable-assets.png',
    key: 'image',
  },
  {
    descriptionKey: 'process.connect.description',
    icon: IconVideo,
    image: '/images/workflow-studio.png',
    key: 'video',
  },
  {
    descriptionKey: 'process.continue.description',
    icon: IconWaveSine,
    image: '/images/reusable-assets.png',
    key: 'audio',
  },
] as const

const processSteps = ['collect', 'connect', 'generate', 'continue'] as const
const currentYear = new Date().getUTCFullYear()

/** Renders the first public TaleLabs narrative and conversion path. */
export default async function HomePage() {
  const { t } = await getWebI18n()

  return (
    <main data-public-site className="min-h-dvh overflow-x-clip">
      <a
        href="#product"
        className="
          group flex min-h-8 items-center justify-center gap-3 border-b px-4
          py-2 text-center font-mono text-[0.68rem] tracking-[0.08em]
        "
      >
        <span className="
          rounded-full bg-primary px-2 py-0.5 text-primary-foreground
        "
        >
          {t('announcement.label')}
        </span>
        <span>{t('announcement.message')}</span>
        <IconArrowUpRight
          className="
            size-3.5 transition-transform
            group-hover:translate-x-0.5 group-hover:-translate-y-0.5
          "
          aria-hidden="true"
        />
      </a>

      <header
        className="
          mx-auto flex h-20 max-w-400 items-center justify-between px-5
          sm:px-8
          lg:px-12
        "
      >
        <a href="#top" className="flex items-center gap-3" aria-label={t('navigation.home')}>
          <span className="relative size-6 overflow-hidden">
            <Image
              src="/brand/talelabs-icon-on-dark.png"
              alt=""
              fill
              sizes="24px"
              className="object-contain"
            />
          </span>
          <span className="text-lg font-semibold tracking-[-0.035em]">TaleLabs</span>
        </a>

        <nav
          className="
            hidden items-center gap-8 font-mono text-xs tracking-[0.06em]
            text-muted-foreground
            md:flex
          "
          aria-label={t('navigation.label')}
        >
          <a
            href="#product"
            className="
              transition-colors
              hover:text-foreground
            "
          >
            {t('navigation.product')}
          </a>
          <a
            href="#process"
            className="
              transition-colors
              hover:text-foreground
            "
          >
            {t('navigation.process')}
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={DASHBOARD_URL}
            className="
              hidden px-3 py-2 font-mono text-xs tracking-[0.04em]
              text-muted-foreground transition-colors
              hover:text-foreground
              sm:block
            "
          >
            {t('navigation.signIn')}
          </a>
          <a
            href={DASHBOARD_URL}
            className={buttonVariants({
              className: 'rounded-sm font-mono text-[0.72rem] tracking-[0.06em]',
              size: 'sm',
            })}
          >
            {t('hero.primaryAction')}
          </a>
        </div>
      </header>

      <div
        id="top"
        className="
          mx-auto max-w-400 px-5
          sm:px-8
          lg:px-12
        "
      >
        <section
          data-site-hero
          className="relative min-h-[calc(100svh-7rem)] overflow-hidden border"
        >
          <Image
            src="/images/hero-creative-workflow.png"
            alt=""
            fill
            preload
            sizes="100vw"
            className="object-cover object-center"
          />
          <div data-site-hero-scrim className="absolute inset-0" />
          <div
            className="
              relative z-10 flex min-h-[calc(100svh-7rem)] flex-col justify-end
              p-6
              sm:p-10
              lg:p-14
            "
          >
            <Badge
              className="
                mb-8 w-fit rounded-full border-border font-mono text-[0.7rem]
                tracking-[0.08em] text-foreground
              "
              variant="outline"
            >
              {t('hero.badge')}
            </Badge>
            <h1
              className="
                max-w-[11ch] text-[clamp(3.6rem,8.2vw,8.5rem)] leading-[0.88]
                font-medium tracking-[-0.06em] text-balance
              "
            >
              {t('hero.title')}
            </h1>
            <div
              className="
                mt-8 flex flex-col gap-8
                lg:flex-row lg:items-end lg:justify-between
              "
            >
              <p className="
                max-w-2xl text-lg/relaxed text-muted-foreground
                sm:text-xl/relaxed
              "
              >
                {t('hero.description')}
              </p>
              <a
                href="#product"
                className="
                  flex size-12 shrink-0 items-center justify-center border
                  transition-colors
                  hover:bg-foreground hover:text-background
                "
                aria-label={t('hero.secondaryAction')}
              >
                <IconArrowDown className="size-5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section
          id="product"
          className="
            grid scroll-mt-8 gap-12 border-x border-b px-6 py-24
            sm:px-10 sm:py-32
            lg:grid-cols-[0.34fr_1fr] lg:gap-20 lg:px-14 lg:py-40
          "
        >
          <p className="
            font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground
          "
          >
            {t('navigation.product')}
          </p>
          <div className="flex flex-col gap-10">
            <h2
              className="
                max-w-[16ch] text-[clamp(2.75rem,6vw,6.75rem)] leading-[0.94]
                font-medium tracking-[-0.055em] text-balance
              "
            >
              {t('product.title')}
            </h2>
            <div className="
              grid gap-8
              lg:grid-cols-2 lg:gap-12
            "
            >
              <p className="text-xl/relaxed text-muted-foreground">
                {t('product.description')}
              </p>
              <p className="text-lg/relaxed text-muted-foreground">{t('product.detail')}</p>
            </div>
          </div>
        </section>

        <section id="process" className="scroll-mt-8 border-x border-b">
          <div
            className="
              grid gap-12 px-6 py-24
              sm:px-10 sm:py-32
              lg:grid-cols-[0.34fr_1fr] lg:gap-20 lg:px-14
            "
          >
            <p className="
              font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground
            "
            >
              {t('navigation.process')}
            </p>
            <div className="max-w-5xl">
              <h2
                className="
                  text-[clamp(2.75rem,6vw,6.75rem)] leading-[0.94] font-medium
                  tracking-[-0.055em] text-balance
                "
              >
                {t('process.title')}
              </h2>
              <p className="
                mt-8 max-w-184 text-xl/relaxed text-muted-foreground
              "
              >
                {t('process.description')}
              </p>
            </div>
          </div>

          <figure className="
            relative aspect-16/10 min-h-128 overflow-hidden border-t
          "
          >
            <Image
              src="/images/workflow-studio.png"
              alt={t('workspace.imageAlt')}
              fill
              sizes="100vw"
              className="object-cover"
            />
            <div data-site-image-scrim className="absolute inset-0" />
            <div
              className="
                absolute inset-x-4 bottom-4 grid border bg-card/90
                backdrop-blur-md
                sm:inset-x-8 sm:bottom-8
                lg:grid-cols-4
              "
            >
              {processSteps.map((step, index) => (
                <article
                  key={step}
                  className="
                    grid grid-cols-[3rem_1fr] gap-4 border-b p-5
                    last:border-b-0
                    lg:block lg:border-r lg:border-b-0 lg:p-6
                    lg:last:border-r-0
                  "
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="text-xl font-medium tracking-tight">
                      {t(`process.${step}.title`)}
                    </h3>
                    <p className="mt-3 text-sm/relaxed text-muted-foreground">
                      {t(`process.${step}.description`)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </figure>
        </section>

        <section className="
          border-x border-b px-6 py-24
          sm:px-10 sm:py-32
          lg:px-14 lg:py-40
        "
        >
          <div className="
            grid gap-12
            lg:grid-cols-[0.34fr_1fr] lg:gap-20
          "
          >
            <p className="
              font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground
            "
            >
              {t('assets.media.image')}
            </p>
            <div>
              <h2
                className="
                  max-w-[15ch] text-[clamp(2.75rem,6vw,6.75rem)] leading-[0.94]
                  font-medium tracking-[-0.055em] text-balance
                "
              >
                {t('assets.title')}
              </h2>
              <p className="
                mt-8 max-w-176 text-xl/relaxed text-muted-foreground
              "
              >
                {t('assets.description')}
              </p>
            </div>
          </div>

          <div className="
            mt-16 grid border-t border-l
            md:grid-cols-3
          "
          >
            {mediaTypes.map(({ descriptionKey, icon: Icon, image, key }, index) => (
              <article key={key} className="group border-r border-b">
                <div className="aspect-4/3 overflow-hidden">
                  <Image
                    src={image}
                    alt=""
                    width={1536}
                    height={1152}
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="
                      size-full object-cover opacity-75 transition duration-700
                      group-hover:scale-[1.025] group-hover:opacity-100
                    "
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
                    <span className="font-mono text-xs text-muted-foreground">
                      0
                      {index + 1}
                    </span>
                  </div>
                  <h3 className="mt-12 text-2xl font-medium tracking-[-0.035em]">
                    {t(`assets.media.${key}`)}
                  </h3>
                  <p className="mt-3 text-base/relaxed text-muted-foreground">
                    {t(descriptionKey)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-x border-b">
          <div
            className="
              grid gap-12 px-6 py-24
              sm:px-10 sm:py-32
              lg:grid-cols-[0.34fr_1fr] lg:gap-20 lg:px-14 lg:py-40
            "
          >
            <p className="
              font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground
            "
            >
              {t('hero.badge')}
            </p>
            <h2
              className="
                max-w-[15ch] text-[clamp(2.75rem,6vw,6.75rem)] leading-[0.94]
                font-medium tracking-[-0.055em] text-balance
              "
            >
              {t('workspace.title')}
            </h2>
          </div>
          <div className="
            grid border-t
            lg:grid-cols-2
          "
          >
            <div className="
              relative min-h-136 overflow-hidden border-b
              lg:border-r lg:border-b-0
            "
            >
              <Image
                src="/images/reusable-assets.png"
                alt={t('assets.imageAlt')}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <div className="
              flex flex-col justify-between gap-20 p-6
              sm:p-10
              lg:p-14
            "
            >
              <p className="max-w-136 text-2xl/relaxed text-muted-foreground">
                {t('workspace.description')}
              </p>
              <a
                href={DASHBOARD_URL}
                className={buttonVariants({
                  className:
                    'w-fit rounded-sm font-mono text-[0.72rem] tracking-[0.06em]',
                  size: 'lg',
                })}
              >
                {t('hero.primaryAction')}
                <IconArrowUpRight data-icon="inline-end" />
              </a>
            </div>
          </div>
        </section>

        <section className="
          border-x px-6 py-24
          sm:px-10 sm:py-32
          lg:px-14 lg:py-40
        "
        >
          <Separator className="mb-16 bg-border" />
          <h2
            className="
              max-w-[15ch] text-[clamp(3.25rem,8vw,8.5rem)] leading-[0.88]
              font-medium tracking-[-0.06em] text-balance
            "
          >
            {t('closing.title')}
          </h2>
          <div className="
            mt-12 flex flex-col gap-8
            lg:flex-row lg:items-end lg:justify-between
          "
          >
            <p className="max-w-2xl text-xl/relaxed text-muted-foreground">
              {t('closing.description')}
            </p>
            <a
              href={DASHBOARD_URL}
              className={buttonVariants({
                className: 'rounded-sm font-mono text-[0.72rem] tracking-[0.06em]',
                size: 'lg',
              })}
            >
              {t('closing.action')}
              <IconArrowUpRight data-icon="inline-end" />
            </a>
          </div>
        </section>
      </div>

      <footer className="border-t">
        <div
          className="
            mx-auto grid max-w-400 gap-10 px-5 py-10
            sm:grid-cols-2 sm:px-8
            lg:px-12
          "
        >
          <div className="flex items-center gap-3">
            <span className="relative size-5 overflow-hidden">
              <Image
                src="/brand/talelabs-icon-on-dark.png"
                alt=""
                fill
                sizes="20px"
                className="object-contain"
              />
            </span>
            <span className="font-medium">TaleLabs</span>
          </div>
          <div className="
            flex flex-col gap-3 text-sm text-muted-foreground
            sm:items-end
          "
          >
            <a
              href={DASHBOARD_URL}
              className="
                transition-colors
                hover:text-foreground
              "
            >
              {t('navigation.signIn')}
            </a>
            <span>{t('footer.copyright', { year: currentYear })}</span>
          </div>
        </div>
      </footer>
    </main>
  )
}
