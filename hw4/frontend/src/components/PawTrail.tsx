import { useEffect } from 'react'

// Leaves a short trail of fading paw prints wherever the mouse moves on the site.
// Mouse only (not touch), and off entirely when the visitor prefers reduced motion.
const STEP_PX = 36 // distance between prints
const LIFETIME_MS = 900

export default function PawTrail() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let lastX = 0
    let lastY = 0
    let left = false // alternate left/right paws

    function onMove(e: PointerEvent) {
      if (e.pointerType !== 'mouse') return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      if (Math.hypot(dx, dy) < STEP_PX) return
      lastX = e.clientX
      lastY = e.clientY
      left = !left

      // Point the paw the way the mouse is moving, offset a little to each side.
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90
      const side = left ? -6 : 6
      const paw = document.createElement('span')
      paw.className = 'paw-print'
      paw.style.left = `${e.clientX + side * Math.cos((angle * Math.PI) / 180)}px`
      paw.style.top = `${e.clientY + side * Math.sin((angle * Math.PI) / 180)}px`
      paw.style.setProperty('--paw-rotate', `${angle}deg`)
      document.body.appendChild(paw)
      window.setTimeout(() => paw.remove(), LIFETIME_MS)
    }

    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  return null
}
