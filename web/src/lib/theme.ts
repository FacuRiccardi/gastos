// Follow the operating system's light/dark setting: the `dark` class on <html> turns on the dark palette.
export function syncSystemTheme(): void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = () => document.documentElement.classList.toggle('dark', query.matches)
  apply()
  query.addEventListener('change', apply)
}
