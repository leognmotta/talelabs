/** Password-only credential entry dialog for browser-local provider storage. */

import type { FormEvent } from 'react'

import { storeCredential } from '@talelabs/providers/browser'
import { Button } from '@talelabs/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@talelabs/ui/components/dialog'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Credential action represented by the secure entry dialog. */
export type SecureStoreDialogMode = 'store' | 'replace'

/** Captures and immediately clears one OpenRouter credential before storage. */
export function SecureStoreCredentialDialog({
  mode,
  onOpenChange,
  onStored,
  open,
  userId,
}: {
  mode: SecureStoreDialogMode
  onOpenChange: (open: boolean) => void
  onStored: () => void
  open: boolean
  userId: string
}) {
  const { t } = useTranslation()
  const credentialInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => () => {
    if (credentialInputRef.current)
      credentialInputRef.current.value = ''
  }, [])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && credentialInputRef.current)
      credentialInputRef.current.value = ''

    if (!nextOpen)
      setError(false)

    onOpenChange(nextOpen)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    let credential = credentialInputRef.current?.value.trim() ?? ''
    if (credentialInputRef.current)
      credentialInputRef.current.value = ''

    setError(false)
    if (credential.length === 0) {
      setError(true)
      return
    }

    setIsSaving(true)
    try {
      await storeCredential({
        credential,
        providerId: 'openrouter',
        userId,
      })
      setIsSaving(false)
      onStored()
      handleOpenChange(false)
    }
    catch {
      setError(true)
      setIsSaving(false)
    }
    finally {
      credential = ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === 'store'
                ? t('secureStore.storeTitle')
                : t('secureStore.replaceTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('secureStore.dialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={error}>
              <FieldLabel htmlFor="secure-store-openrouter-key">
                {t('secureStore.apiKeyLabel')}
              </FieldLabel>
              <Input
                autoComplete="off"
                id="secure-store-openrouter-key"
                ref={credentialInputRef}
                required
                spellCheck={false}
                type="password"
                aria-invalid={error}
              />
              {error && (
                <FieldError>{t('secureStore.couldNotStore')}</FieldError>
              )}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => handleOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving
                ? t('common.saving')
                : mode === 'store'
                  ? t('secureStore.storeKey')
                  : t('secureStore.replaceKey')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
