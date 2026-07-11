import { IconArrowLeft, IconDots, IconPencil, IconTrash } from '@tabler/icons-react'
import { Button, buttonVariants } from '@talelabs/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@talelabs/ui/components/dropdown-menu'
import { Skeleton } from '@talelabs/ui/components/skeleton'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { uploadManager } from '../uploads/upload-manager'
import { ElementDataView } from './element-data-view'
import { ElementDeleteDialog } from './element-delete-dialog'
import { ElementIdentityHeader } from './element-identity-header'
import { ElementReferenceOverview } from './element-reference-overview'
import {
  useElementDetailQuery,
  useElementKitQuery,
  useElementMutations,
} from './element.queries'

export function ElementDetailScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const organizationId = useActiveOrganizationId()
  const { elementId } = useParams()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const query = useElementDetailQuery(elementId ?? null)
  const kitQuery = useElementKitQuery(elementId ?? null)
  const mutations = useElementMutations()

  if (!elementId)
    return <Navigate to="/elements" replace />
  if (query.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
        <Skeleton className="h-9 w-24" />
        <div className="flex items-center gap-5">
          <Skeleton className="size-28 rounded-xl" />
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-7 w-72" />
            <Skeleton className="h-4 w-full max-w-lg" />
          </div>
        </div>
        <Skeleton className="h-44 w-full rounded-xl" />
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
        <Link className={buttonVariants({ variant: 'outline' })} to="/elements">{t('elements.backToElements')}</Link>
      </div>
    )
  }

  const element = query.data
  const links = kitQuery.data?.data ?? []
  return (
    <section className="min-h-[calc(100svh-8rem)]">
      <header className="border-b">
        <div className="
          mx-auto flex w-full max-w-6xl items-center justify-between gap-3 p-4
          sm:px-6
        "
        >
          <Link
            aria-label={t('elements.backToElements')}
            className={buttonVariants({ size: 'sm', variant: 'ghost' })}
            to="/elements"
          >
            <IconArrowLeft data-icon="inline-start" />
            {t('elements.backToElements')}
          </Link>
          <div className="flex items-center gap-2">
            <Link
              className={buttonVariants({ variant: 'outline' })}
              to={`/elements/${element.id}/edit`}
            >
              <IconPencil data-icon="inline-start" />
              {t('common.edit')}
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={(
                  <Button
                    aria-label={t('common.moreOptions')}
                    size="icon"
                    type="button"
                    variant="ghost"
                  />
                )}
              >
                <IconDots />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <IconTrash />
                  {t('common.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="
        mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-7
        sm:px-6 sm:py-9
      "
      >
        <ElementIdentityHeader
          element={element}
          links={links}
          loading={kitQuery.isPending}
        />
        <ElementDataView element={element} />
        <ElementReferenceOverview
          element={element}
          error={kitQuery.isError}
          links={links}
          loading={kitQuery.isPending}
        />
      </main>
      <ElementDeleteDialog
        name={element.name}
        open={deleteOpen}
        pending={deletePending || mutations.remove.isPending}
        onOpenChange={setDeleteOpen}
        onConfirm={async () => {
          setDeletePending(true)
          try {
            if (!organizationId)
              throw new Error('An active organization is required.')
            await uploadManager.cancelElement(organizationId, element.id)
            await mutations.remove.mutateAsync({ id: element.id, organizationId })
            toast.success(t('elements.deleted'))
            navigate('/elements', { replace: true })
          }
          catch (error) {
            toast.error(getApiErrorMessage(error, 'elements.actionFailed'))
          }
          finally {
            setDeletePending(false)
          }
        }}
      />
    </section>
  )
}
