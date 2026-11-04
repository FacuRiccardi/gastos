import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { TabsList } from '@/components/ui/tabs'

// Tab strip like Google Sheets: one row, no visible scrollbar, with arrows to move back and forward.
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

  const arrow = 'flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-background disabled:opacity-30 disabled:hover:bg-transparent'
  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted p-[3px]">
      <div ref={ref} onScroll={update} className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabsList className="w-max bg-transparent p-0">{children}</TabsList>
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
