import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'

// One tab of the main navigation: on a phone it is an icon over a label in the bottom bar, from `sm` up a plain label.
export function NavTab({ value, icon: Icon, children }: { value: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className="max-sm:h-full! max-sm:flex-col max-sm:gap-0.5 max-sm:rounded-none max-sm:px-0 max-sm:text-[10px] max-sm:data-active:bg-transparent max-sm:data-active:text-primary max-sm:data-active:shadow-none max-sm:dark:data-active:border-transparent max-sm:dark:data-active:bg-transparent"
    >
      <Icon className="size-5 sm:hidden" aria-hidden />
      {children}
    </TabsTrigger>
  )
}

// Main navigation. On a phone it is a bar fixed to the bottom of the screen, where the thumb reaches.
// From `sm` up it is a tab strip like Google Sheets: one row, no visible scrollbar, with arrows to move back and forward.
export function ScrollableTabsList({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [canBack, setCanBack] = useState(false)
  const [canForward, setCanForward] = useState(false)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    setCanBack(el.scrollLeft > 0)
    setCanForward(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    update()
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [update, children])

  // Mouse wheel moves the strip sideways (non-passive so the page does not scroll too).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      const max = el.scrollWidth - el.clientWidth
      const next = el.scrollLeft + e.deltaY
      if (max <= 0 || (e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max)) return
      e.preventDefault()
      el.scrollLeft = Math.min(max, Math.max(0, next))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const scroll = (direction: 1 | -1) =>
    ref.current?.scrollBy({ left: direction * ref.current.clientWidth * 0.7, behavior: 'smooth' })

  const arrow = 'flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-background disabled:opacity-30 disabled:hover:bg-transparent max-sm:hidden'
  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted p-[3px] max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-40 max-sm:gap-0 max-sm:rounded-none max-sm:border-t max-sm:bg-background max-sm:p-0 max-sm:pb-[env(safe-area-inset-bottom)]">
      <div ref={ref} onScroll={update} className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-sm:overflow-visible">
        <TabsList className="w-max bg-transparent p-0 max-sm:grid! max-sm:h-16! max-sm:w-full max-sm:grid-cols-6 max-sm:rounded-none">{children}</TabsList>
      </div>
      <button type="button" aria-label="Períodos anteriores" className={arrow} disabled={!canBack} onClick={() => scroll(-1)}>
        <ChevronLeft className="size-4" />
      </button>
      <button type="button" aria-label="Períodos siguientes" className={arrow} disabled={!canForward} onClick={() => scroll(1)}>
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}
