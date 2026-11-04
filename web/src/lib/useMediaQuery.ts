import { useEffect, useState } from 'react'

const supported = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

/** Whether a CSS media query matches right now (and keeps up when it changes). Without `matchMedia` (tests) it is false. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (supported() ? window.matchMedia(query).matches : false))
  useEffect(() => {
    if (!supported()) return
    const list = window.matchMedia(query)
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])
  return matches
}

/** A phone-sized screen: the same breakpoint as Tailwind's `max-sm`. */
export const useIsPhone = () => useMediaQuery('(max-width: 639px)')
