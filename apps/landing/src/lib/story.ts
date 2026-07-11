/**
 * The single source of truth for the scroll-scrubbed story.
 *
 * - `STORY.progress` is written by ScrollTrigger (raw scroll position, 0..1).
 * - `STORY.smooth`  is a damped copy written once per frame by <StoryDriver/>.
 *   All 3D objects read `smooth` so scrubbing never stutters, and everything
 *   is a pure function of progress — fully reversible when scrolling back up.
 *
 * Beat timings live here so each beat can be retimed in one place.
 */
export const STORY = { progress: 0, smooth: 0 }

export const BEAT = {
  /** Beat 1 — the powerless agent, alone in the alley */
  powerless: [0.0, 0.2],
  /** Beat 2 — the cloaked figure arrives with the orb */
  arrival: [0.2, 0.4],
  /** Beat 3 — the gift of power (burst at `contact`) */
  gift: [0.4, 0.6],
  /** Beat 4 — powers awaken, four orbs materialize */
  awaken: [0.6, 0.8],
  /** Beat 5 — hero resolve, product UI */
  hero: [0.8, 1.0],
  /** The exact moment the orb touches the agent */
  contact: 0.5,
} as const

/* ------------------------------ math helpers ----------------------------- */

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Remap t from [a, b] to [0, 1], clamped. */
export const range = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const smooth01 = (x: number) => x * x * (3 - 2 * x)

export const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)

/** Overshoots slightly past 1 mid-way — good for "pop" appearances. */
export const easeOutBack = (x: number) => {
  const c = 1.70158
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2)
}

/** 0 → 1 → 0 envelope: rises over [a, peak], falls over [peak, b]. */
export const spike = (t: number, a: number, peak: number, b: number) => {
  if (t <= a || t >= b) return 0
  return t < peak ? easeOutCubic(range(t, a, peak)) : 1 - smooth01(range(t, peak, b))
}
