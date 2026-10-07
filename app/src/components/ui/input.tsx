import * as React from "react"
import { cn } from "cn"

// Inputs sit in the cask like a tap handle's label: dark well, gold focus.
// 16px text so iOS Safari doesn't zoom the page on focus.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-13 w-full min-w-0 rounded-2xl border border-foam/10 bg-cellar/70 px-4 text-base text-foam transition-[border-color,box-shadow,background-color] outline-none shadow-[inset_0_2px_6px_rgb(0_0_0/0.45)] placeholder:text-foam/28 focus-visible:border-gold/60 focus-visible:bg-cellar focus-visible:ring-4 focus-visible:ring-gold/12 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-fire/60 aria-invalid:ring-4 aria-invalid:ring-fire/12",
        className
      )}
      {...props}
    />
  )
}

export { Input }
