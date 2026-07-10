import type { TeamMemberRow } from './team-member-row'

import { IconCopy, IconMailForward, IconTrash } from '@tabler/icons-react'
import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import { Skeleton } from '@talelabs/ui/components/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@talelabs/ui/components/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@talelabs/ui/components/tooltip'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

const teamColumnHelper = createColumnHelper<TeamMemberRow>()

export function TeamMembersTable({
  emptyMessage,
  isLoading,
  onCopyInviteLink,
  onRevokeInvite,
  onResendInvite,
  rows,
  searchValue,
}: {
  emptyMessage?: string
  isLoading: boolean
  onCopyInviteLink: (row: TeamMemberRow) => void
  onRevokeInvite: (row: TeamMemberRow) => void
  onResendInvite: (row: TeamMemberRow) => void
  rows: TeamMemberRow[]
  searchValue: string
}) {
  const { t } = useTranslation()
  const resolvedEmptyMessage = emptyMessage ?? t('team.noMembers')
  const columns = useMemo(() => [
    teamColumnHelper.accessor('name', {
      header: t('team.member'),
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.original.email}
          </p>
        </div>
      ),
    }),
    teamColumnHelper.accessor('role', {
      header: t('team.role'),
      cell: info => (
        <span className="capitalize">{info.getValue()}</span>
      ),
    }),
    teamColumnHelper.accessor('status', {
      header: t('team.status'),
      cell: info => (
        <Badge variant={info.getValue() === 'active' ? 'secondary' : 'outline'}>
          {info.getValue() === 'active' ? t('team.active') : t('team.pending')}
        </Badge>
      ),
    }),
    teamColumnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        if (row.original.status !== 'pending') {
          return null
        }

        return (
          <div className="flex justify-end gap-2">
            <Tooltip>
              <TooltipTrigger
                render={(
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('team.copyInviteLink')}
                    onClick={() => onCopyInviteLink(row.original)}
                  >
                    <IconCopy data-icon="inline-start" />
                  </Button>
                )}
              />
              <TooltipContent>{t('team.copyInviteLink')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={(
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('team.resendInvite')}
                    onClick={() => onResendInvite(row.original)}
                  >
                    <IconMailForward data-icon="inline-start" />
                  </Button>
                )}
              />
              <TooltipContent>{t('team.resendInvite')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={(
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon-sm"
                    aria-label={t('team.revokeInvitation')}
                    onClick={() => onRevokeInvite(row.original)}
                  >
                    <IconTrash data-icon="inline-start" />
                  </Button>
                )}
              />
              <TooltipContent>{t('team.revokeInvitation')}</TooltipContent>
            </Tooltip>
          </div>
        )
      },
    }),
  ], [onCopyInviteLink, onResendInvite, onRevokeInvite, t])
  const table = useReactTable({
    data: rows,
    columns,
    state: {
      globalFilter: searchValue,
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue).trim().toLowerCase()

      if (!query)
        return true

      return [
        row.original.name,
        row.original.email,
        row.original.role,
        row.original.status,
      ].some(value => value.toLowerCase().includes(query))
    },
  })

  if (isLoading && rows.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length > 0
            ? table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    {resolvedEmptyMessage}
                  </TableCell>
                </TableRow>
              )}
        </TableBody>
      </Table>
    </div>
  )
}
