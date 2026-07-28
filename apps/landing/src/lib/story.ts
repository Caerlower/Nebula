/**
 * Scroll-scrubbed story state.
 * `progress` is written by ScrollTrigger; `smooth` is damped each frame by StoryDriver.
 */
export const STORY = { progress: 0, smooth: 0 }

/** Moment the orb contacts the agent (burst trigger). */
export const BEAT = { contact: 0.5 } as const

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export const range = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const smooth01 = (x: number) => x * x * (3 - 2 * x)

export const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)

export const easeOutBack = (x: number) => {
  const c = 1.70158
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2)
}

/** 0 → 1 → 0 envelope over [a, peak, b]. */
export const spike = (t: number, a: number, peak: number, b: number) => {
  if (t <= a || t >= b) return 0
  return t < peak ? easeOutCubic(range(t, a, peak)) : 1 - smooth01(range(t, peak, b))
}
