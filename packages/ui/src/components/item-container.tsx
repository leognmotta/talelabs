import type { VariantProps } from 'class-variance-authority'
import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cn } from '@talelabs/ui/lib/utils'
import { cva } from 'class-variance-authority'

const itemVariants = cva(
  `
    group/item flex w-full flex-wrap items-center rounded-2xl border text-sm
    transition-colors duration-100 outline-none
    focus-visible:border-ring focus-visible:ring-[3px]
    focus-visible:ring-ring/50
    [a]:transition-colors
    [a]:hover:bg-muted
  `,
  {
    variants: {
      variant: {
        default: 'border-transparent',
        outline: 'border-border',
        muted: 'border-transparent bg-muted/50',
      },
      size: {
        default: 'gap-3.5 px-4 py-3.5',
        sm: 'gap-3.5 px-3.5 py-3',
        xs: `
          gap-2.5 px-3 py-2.5
          in-data-[slot=dropdown-menu-content]:p-0
        `,
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export function Item({
  className,
  variant = 'default',
  size = 'default',
  render,
  ...props
}: useRender.ComponentProps<'div'> & VariantProps<typeof itemVariants>) {
  return useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(
      { className: cn(itemVariants({ variant, size, className })) },
      props,
    ),
    render,
    state: { slot: 'item', variant, size },
  })
}
