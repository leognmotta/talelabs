import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../shared/lib/api-error'

export function useContextResourceDelete({
  deleteResource,
  errorMessage,
  returnTo,
  successMessage,
}: {
  deleteResource: () => Promise<unknown>
  errorMessage: string
  returnTo: string
  successMessage: string
}) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)

  async function confirmDelete() {
    try {
      await deleteResource()
      setIsOpen(false)
      toast.success(successMessage)
      navigate(returnTo, { replace: true })
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, errorMessage))
    }
  }

  return { confirmDelete, isOpen, setIsOpen }
}
