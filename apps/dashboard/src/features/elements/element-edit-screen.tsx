import type { ElementFormSubmission } from './forms/element-form.types'

import { buttonVariants } from '@talelabs/ui/components/button'
import { Skeleton } from '@talelabs/ui/components/skeleton'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { ElementEditAssetsSection } from './element-edit-assets-section'
import { ElementEditorLayout } from './element-editor-layout'
import { ELEMENT_FORM_SECTIONS } from './element-form-sections'
import { elementTypeTranslationKey } from './element-i18n'
import { ELEMENT_TYPE_ICONS } from './element-type-icons'
import { useElementDetailQuery, useElementMutations } from './element.queries'
import { ELEMENT_FORM_REGISTRY } from './forms/element-form-registry'

export function ElementEditScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { elementId } = useParams()
  const organizationId = useActiveOrganizationId()
  const query = useElementDetailQuery(elementId ?? null)
  const mutations = useElementMutations()

  useEffect(() => {
    if (!query.data || window.location.hash !== `#${ELEMENT_FORM_SECTIONS.assets}`)
      return

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(ELEMENT_FORM_SECTIONS.assets)?.scrollIntoView({
        block: 'start',
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [query.data])

  if (!elementId)
    return <Navigate replace to="/elements" />

  if (query.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="
          grid gap-6
          lg:grid-cols-[14rem_minmax(0,1fr)]
        "
        >
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <div className="
        flex min-h-[50svh] flex-col items-center justify-center gap-3 p-6
        text-center
      "
      >
        <h1 className="text-xl font-semibold">{t('elements.notFound')}</h1>
        <Link className={buttonVariants({ variant: 'outline' })} to="/elements">
          {t('elements.backToElements')}
        </Link>
      </div>
    )
  }

  const element = query.data
  const Form = ELEMENT_FORM_REGISTRY[element.type].Form
  const Icon = ELEMENT_TYPE_ICONS[element.type]
  const typeLabel = t(elementTypeTranslationKey(element.type, 'label'))

  async function updateElement(value: ElementFormSubmission) {
    if (!organizationId) {
      toast.error(t('errors.active_organization_required'))
      return
    }
    try {
      const data = element.type === 'other'
        ? {
            ...value.data,
            assetRoles: element.data.assetRoles,
          }
        : value.data
      await mutations.update.mutateAsync({
        data: { ...value, data },
        id: element.id,
        organizationId,
      })
      toast.success(t('elements.updated'))
      navigate(`/elements/${element.id}`, { replace: true })
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'elements.actionFailed'))
    }
  }

  return (
    <ElementEditorLayout
      backLabel={t('elements.backToElement')}
      backTo={`/elements/${element.id}`}
      description={t('elements.createEditor.description')}
      icon={Icon}
      title={t('elements.editType', { type: typeLabel })}
    >
      <Form
        key={`${element.id}:${element.updatedAt}`}
        assetsSection={<ElementEditAssetsSection element={element} />}
        initialValue={{
          data: element.data,
          instructions: element.type === 'other'
            ? element.instructions ?? ''
            : '',
          name: element.name,
        }}
        pending={mutations.update.isPending}
        submitLabel={t('common.save')}
        onSubmit={updateElement}
      />
    </ElementEditorLayout>
  )
}
