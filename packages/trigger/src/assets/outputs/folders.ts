import type { OutputFolderExecutor } from './folder-queries.js'
import { createId } from '@paralleldrive/cuid2'

import {
  availableFolderName,
  FLOW_OUTPUTS_ROOT_FOLDER_NAME,
  FLOW_OUTPUTS_ROOT_SYSTEM_ROLE,
  lockFolderStructure,
  MAX_FOLDER_DEPTH,
  MAX_FOLDERS_PER_ORGANIZATION,
} from '@talelabs/db'
import {
  countFolders,
  getFolderDepth,

} from './folder-queries.js'

export type EnsureFlowOutputFolderResult
  = | { folderId: string, status: 'ready' }
    | { status: 'depth' | 'flow_missing' | 'limit' }

async function findOrCreateFlowRoot(
  executor: OutputFolderExecutor,
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
  executor: OutputFolderExecutor,
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
