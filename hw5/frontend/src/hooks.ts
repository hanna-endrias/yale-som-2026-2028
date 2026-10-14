import { useEffect, useRef, useState } from 'react'

/** Run `callback` every `ms` milliseconds; pass null to pause. Always calls the latest callback. */
export function useInterval(callback: () => void, ms: number | null) {
  const saved = useRef(callback)
  useEffect(() => { saved.current = callback }, [callback])
  useEffect(() => {
    if (ms === null) return
    const id = setInterval(() => saved.current(), ms)
    return () => clearInterval(id)
  }, [ms])
}

/** Smoothly count from the previous value to `target`, like a till display.
 *  The first real value (and every value, when the user prefers reduced motion) shows instantly. */
export function useAnimatedNumber(target: number | null, duration = 900): number {
  const [shown, setShown] = useState(target ?? 0)
  const from = useRef<number | null>(target)
  useEffect(() => {
    if (target === null) return
    const begin = from.current
    if (begin === null || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = target
      setShown(target)
      return
    }
    if (begin === target) return
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      const value = begin + (target - begin) * eased
      setShown(value)
      from.current = value
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return shown
}

export type Theme = 'light' | 'dark'

/** Light/dark theme, remembered between visits; starts from the system setting. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('desk-theme')
    if (saved === 'light' || saved === 'dark') return saved
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('desk-theme', theme)
  }, [theme])
  return [theme, () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))]
}

/** A string remembered in localStorage (used for the approver's name). */
export function useStoredString(key: string, initial = ''): [string, (v: string) => void] {
  const [value, setValue] = useState(() => localStorage.getItem(key) ?? initial)
  useEffect(() => { localStorage.setItem(key, value) }, [key, value])
  return [value, setValue]
}
