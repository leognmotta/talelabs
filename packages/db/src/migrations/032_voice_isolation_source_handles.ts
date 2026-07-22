/** Migrates Voice Isolation drafts from one union source to two typed handles. */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Preserves node selections and rewrites legacy edges by their source media. */
export async function up(db: Kysely<unknown>) {
  await sql`
    do $$
    begin
      if exists (
        select 1
        from "flowEdges" edge
        join "flowNodes" target
          on target."flowId" = edge."flowId"
         and target."id" = edge."targetNodeId"
        join "flowNodes" source
          on source."flowId" = edge."flowId"
         and source."id" = edge."sourceNodeId"
        left join "assets" asset on asset."id" = source."assetId"
        where target."type" = 'voiceIsolation'
          and edge."targetHandle" = 'sourceMedia'
          and not (
            edge."sourceHandle" in ('audio', 'videos')
            or (
              edge."sourceHandle" = 'asset'
              and asset."type" in ('audio', 'video')
            )
          )
      ) then
        raise exception
          'voice isolation sourceMedia edge has an unknown source media type';
      end if;
    end
    $$
  `.execute(db)

  await sql`
    update "flowEdges" edge
    set "targetHandle" = case
      when edge."sourceHandle" = 'videos' then 'sourceVideo'
      when edge."sourceHandle" = 'audio' then 'sourceAudio'
      when asset."type" = 'video' then 'sourceVideo'
      else 'sourceAudio'
    end
    from "flowNodes" target,
      "flowNodes" source
      left join "assets" asset on asset."id" = source."assetId"
    where target."flowId" = edge."flowId"
      and target."id" = edge."targetNodeId"
      and target."type" = 'voiceIsolation'
      and source."flowId" = edge."flowId"
      and source."id" = edge."sourceNodeId"
      and edge."targetHandle" = 'sourceMedia'
  `.execute(db)

  await sql`
    update "flowNodes"
    set
      "data" = jsonb_set(
        jsonb_set(
          "data" #- '{inputSelections,sourceMedia}',
          '{inputSelections,sourceAudio}',
          coalesce(
            "data" #> '{inputSelections,sourceAudio}',
            "data" #> '{inputSelections,sourceMedia}',
            '{"mode":"auto"}'::jsonb
          ),
          true
        ),
        '{inputSelections,sourceVideo}',
        coalesce(
          "data" #> '{inputSelections,sourceVideo}',
          "data" #> '{inputSelections,sourceMedia}',
          '{"mode":"auto"}'::jsonb
        ),
        true
      ),
      "schemaVersion" = 2,
      "updatedAt" = now()
    where "type" = 'voiceIsolation'
      and "schemaVersion" <= 1
  `.execute(db)
}

/** The typed-handle migration is forward-only because collapsing loses intent. */
export async function down(_db: Kysely<unknown>) {}
