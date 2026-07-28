/** Shared Lenis handle so modals can pause smooth scroll. */
import type Lenis from 'lenis'

let lenis: Lenis | null = null

export function setLenis(instance: Lenis | null) {
  lenis = instance
}

export function stopLenis() {
  lenis?.stop()
}

export function startLenis() {
  lenis?.start()
}
