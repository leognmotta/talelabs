/** Quiet first-use stage for the direct Create playground. */

import { useTranslation } from 'react-i18next'

/** Centers the first creative decision without inventing session navigation. */
export function CreateEmptyStage() {
  const { t } = useTranslation()
  return (
    <section className="
      mx-auto flex min-h-[clamp(22rem,58vh,40rem)] w-full max-w-5xl flex-col
      items-center justify-center px-4 py-12 text-center
      sm:px-8
    "
    >
      <div className="max-w-xl">
        <h1 className="
          text-[clamp(2rem,4.25vw,3.25rem)] leading-[1.05] font-medium
          tracking-[-0.045em] text-balance
        "
        >
          {t('create.emptyState.title')}
        </h1>
        <p className="
          mx-auto mt-4 max-w-md text-sm/relaxed text-balance
          text-muted-foreground
          sm:text-base/relaxed
        "
        >
          {t('create.emptyState.description')}
        </p>
      </div>
    </section>
  )
}
