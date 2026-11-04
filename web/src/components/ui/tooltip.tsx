import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { InfoIcon } from "lucide-react"
import type { ReactNode } from "react"

// An "i" button whose popup shows `text`. It opens on hover and on keyboard focus (and on tap).
function InfoTip({ text, label }: { text: ReactNode; label: string }) {
  return (
    <TooltipPrimitive.Provider delay={100}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger
          aria-label={label}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <InfoIcon className="size-4" />
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Positioner sideOffset={6} className="z-50">
            <TooltipPrimitive.Popup className="max-w-xs rounded-lg bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10">
              {text}
            </TooltipPrimitive.Popup>
          </TooltipPrimitive.Positioner>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

export { InfoTip }
