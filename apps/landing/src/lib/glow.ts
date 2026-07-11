import * as THREE from 'three'

let cached: THREE.CanvasTexture | null = null

/**
 * A soft radial glow texture generated procedurally on a canvas.
 * Tinted per-use via material color. Shared/cached — never disposed.
 */
export function glowTexture(): THREE.CanvasTexture {
  if (cached) return cached
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  cached = new THREE.CanvasTexture(canvas)
  return cached
}
