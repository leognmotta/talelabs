import type {
  CreateCharacterMutationRequest,
  UpdateCharacterMutationRequest,
} from '@talelabs/sdk'
import {
  createCharacter,
  deleteCharacter,
  getCharacterQueryKey,
  listCharactersQueryKey,
  updateCharacter,
} from '@talelabs/sdk'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useCreateCharacterMutation() {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCharacterMutationRequest) =>
      createCharacter({ data }),
    onSuccess: () =>
      c.invalidateQueries({ queryKey: listCharactersQueryKey() }),
  })
}
export function useUpdateCharacterMutation(characterId: string) {
  const c = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateCharacterMutationRequest) =>
      updateCharacter({ characterId, data }),
    onSuccess: () =>
      Promise.all([
        c.invalidateQueries({ queryKey: listCharactersQueryKey() }),
        c.invalidateQueries({
          queryKey: getCharacterQueryKey({ characterId }),
        }),
      ]),
  })
}
export function useDeleteCharacterMutation(characterId: string) {
  const c = useQueryClient()
  return useMutation({
    mutationFn: () => deleteCharacter({ characterId }),
    onSuccess: async () => {
      c.removeQueries({ queryKey: getCharacterQueryKey({ characterId }) })
      await c.invalidateQueries({ queryKey: listCharactersQueryKey() })
    },
  })
}
