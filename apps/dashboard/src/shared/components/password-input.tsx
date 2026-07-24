/** Accessible password field with a shared inline visibility control. */

import type { ComponentProps } from 'react'

import { IconEye, IconEyeOff } from '@tabler/icons-react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@talelabs/ui/components/input-group'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Renders a masked password input that users can reveal without losing focus. */
export function PasswordInput({
  className,
  disabled,
  ...props
}: Omit<ComponentProps<'input'>, 'type'>) {
  const { t } = useTranslation()
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const visibilityLabel = isPasswordVisible
    ? t('common.hidePassword')
    : t('common.showPassword')

  return (
    <InputGroup className={className} data-disabled={disabled}>
      <InputGroupInput
        {...props}
        className="h-full"
        disabled={disabled}
        type={isPasswordVisible ? 'text' : 'password'}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          aria-controls={props.id}
          aria-label={visibilityLabel}
          disabled={disabled}
          size="icon-sm"
          title={visibilityLabel}
          onClick={() => setIsPasswordVisible(isVisible => !isVisible)}
          onMouseDown={event => event.preventDefault()}
        >
          {isPasswordVisible ? <IconEyeOff /> : <IconEye />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
