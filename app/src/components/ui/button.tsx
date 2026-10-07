import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// shadcn's button, rebuilt in the brand: pills, gold that feels pressed when you
// press it, and sizes big enough to hit with a pint in the other hand.
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-[transform,background-color,box-shadow,color,opacity] duration-150 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/60 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(180deg,#ffc95f_0%,#f5b23a_45%,#e09b25_100%)] text-stout shadow-[inset_0_1px_0_rgb(255_255_255/0.45),inset_0_-2px_0_rgb(0_0_0/0.18),0_10px_24px_-10px_rgb(245_178_58/0.65)] hover:brightness-105",
        outline:
          "border-[1.5px] border-gold/40 bg-transparent text-gold hover:border-gold/70 hover:bg-gold/8",
        secondary: "bg-foam/8 text-foam hover:bg-foam/12",
        ghost: "text-foam/70 hover:bg-foam/6 hover:text-foam",
        destructive: "bg-fire/14 text-fire ring-1 ring-fire/30 hover:bg-fire/22",
        link: "text-gold underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-6 text-[15px]",
        sm: "h-9 px-4 text-[13px]",
        lg: "h-14 px-7 text-base",
        xl: "h-16 px-8 text-[17px]",
        icon: "size-11",
        "icon-sm": "size-9",
        "icon-lg": "size-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
