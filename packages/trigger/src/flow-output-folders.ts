import type { Database, Transaction } from '@talelabs/db'

import { createId } from '@paralleldrive/cuid2'
import {
  availableFolderName,
  FLOW_OUTPUTS_ROOT_FOLDER_NAME,
  FLOW_OUTPUTS_ROOT_SYSTEM_ROLE,
  lockFolderStructure,
  MAX_FOLDER_DEPTH,
  MAX_FOLDERS_PER_ORGANIZATION,
  sql,
} from '@talelabs/db'

type Executor = Transaction<Database>

export type EnsureFlowOutputFolderResult
  = | { folderId: string, status: 'ready' }
    | { status: 'depth' | 'flow_missing' | 'limit' }

async function countFolders(executor: Executor, organizationId: string) {
  const row = await executor.selectFrom('folders')
    .select(({ fn }) => fn.countAll<number>().as('count'))
    .where('organizationId', '=', organizationId)
    .executeTakeFirstOrThrow()
  return Number(row.count)
}

async function getFolderDepth(
  executor: Executor,
  organizationId: string,
  folderId: string,
) {
  const result = await sql<{ depth: number }>`
    with recursive ancestors as (
      select folder."id", folder."parentId", 1 as depth
      from "folders" folder
      where folder."organizationId" = ${organizationId}
        and folder."id" = ${folderId}
      union all
      select parent."id", parent."parentId", ancestors.depth + 1
      from "folders" parent
      join ancestors on ancestors."parentId" = parent."id"
      where parent."organizationId" = ${organizationId}
        and ancestors.depth < ${MAX_FOLDER_DEPTH + 1}
    )
    select max(depth)::integer as depth from ancestors
  `.execute(executor)
  return result.rows[0]?.depth ?? null
}

async function findOrCreateFlowRoot(
  executor: Executor,
  organizationId: string,
) {
  const identified = await executor.selectFrom('folders')
    .select('id')
    .where('organizationId', '=', organizationId)
    .where('systemRole', '=', FLOW_OUTPUTS_ROOT_SYSTEM_ROLE)
    .executeTakeFirst()
  if (identified)
    return { folderId: identified.id, status: 'ready' as const }

  const rootSiblings = await executor.selectFrom('folders')
    .select('name')
    .where('organizationId', '=', organizationId)
    .where('parentId', 'is', null)
    .execute()

  if (await countFolders(executor, organizationId) >= MAX_FOLDERS_PER_ORGANIZATION)
    return { status: 'limit' as const }

  const folder = await executor.insertInto('folders')
    .values({
      id: createId(),
      name: availableFolderName(
        FLOW_OUTPUTS_ROOT_FOLDER_NAME,
        rootSiblings.map(folder => folder.name),
      ),
      organizationId,
      parentId: null,
      systemRole: FLOW_OUTPUTS_ROOT_SYSTEM_ROLE,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  return { folderId: folder.id, status: 'ready' as const }
}

/**
 * Lazily provisions the stable `Flow/<Flow name>` destination used only by
 * generated media outputs. The Flow row stores the folder ID, so later folder
 * moves remain valid and duplicate Flow names receive collision-safe suffixes.
 */
export async function ensureFlowOutputFolder(
  executor: Executor,
  input: { flowId: null | string, organizationId: string },
): Promise<EnsureFlowOutputFolderResult> {
  if (!input.flowId)
    return { status: 'flow_missing' }

  await lockFolderStructure(executor, input.organizationId)
  const flow = await executor.selectFrom('flows')
    .select(['assetFolderId', 'id', 'name'])
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.flowId)
    .forUpdate()
    .executeTakeFirst()
  if (!flow)
    return { status: 'flow_missing' }

  if (flow.assetFolderId)
    return { folderId: flow.assetFolderId, status: 'ready' }

  const root = await findOrCreateFlowRoot(executor, input.organizationId)
  if (root.status === 'limit')
    return root
  if (await countFolders(executor, input.organizationId) >= MAX_FOLDERS_PER_ORGANIZATION)
    return { status: 'limit' }

  const rootDepth = await getFolderDepth(executor, input.organizationId, root.folderId)
  if (rootDepth === null || rootDepth >= MAX_FOLDER_DEPTH)
    return { status: 'depth' }

  const siblings = await executor.selectFrom('folders')
    .select('name')
    .where('organizationId', '=', input.organizationId)
    .where('parentId', '=', root.folderId)
    .execute()
  const folder = await executor.insertInto('folders')
    .values({
      id: createId(),
      name: availableFolderName(flow.name, siblings.map(sibling => sibling.name)),
      organizationId: input.organizationId,
      parentId: root.folderId,
    })
    .returning('id')
    .executeTakeFirstOrThrow()

  await executor.updateTable('flows')
    .set({ assetFolderId: folder.id })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', flow.id)
    .executeTakeFirstOrThrow()
  return { folderId: folder.id, status: 'ready' }
}
