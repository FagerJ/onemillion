import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// Dark only (the whole app is), so no theme switching — toasts are small cask-brown
// slips that drop in above the dock.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-hop" />,
        info: <InfoIcon className="size-4 text-gold" />,
        warning: <TriangleAlertIcon className="size-4 text-gold" />,
        error: <OctagonXIcon className="size-4 text-fire" />,
        loading: <Loader2Icon className="size-4 animate-spin text-gold" />,
      }}
      style={
        {
          "--normal-bg": "#211910",
          "--normal-text": "var(--foam)",
          "--normal-border": "rgb(245 178 58 / 0.18)",
          "--border-radius": "18px",
        } as React.CSSProperties
      }
      toastOptions={{ classNames: { toast: "font-sans font-medium shadow-[0_20px_40px_-12px_rgb(0_0_0/0.8)]" } }}
      {...props}
    />
  )
}

export { Toaster }
