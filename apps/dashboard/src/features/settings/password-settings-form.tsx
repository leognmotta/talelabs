import { CreatePasswordForm } from './create-password-form'
import { UpdatePasswordForm } from './update-password-form'

export function PasswordSettingsForm({
  hasPassword,
  onPasswordChanged,
}: {
  hasPassword: boolean
  onPasswordChanged: () => Promise<void>
}) {
  return hasPassword
    ? <UpdatePasswordForm onPasswordChanged={onPasswordChanged} />
    : <CreatePasswordForm onPasswordChanged={onPasswordChanged} />
}
