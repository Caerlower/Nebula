/**
 * Quality tiers. Mobile keeps the full story but with fewer particles,
 * fewer noise octaves, a lower pixel-ratio cap, and no MSAA.
 */
const coarse =
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

export const IS_MOBILE =
  typeof window !== 'undefined' && (coarse || window.innerWidth < 768)

export const Q = IS_MOBILE
  ? {
      burst: 260,
      aura: 80,
      motes: 60,
      stars: 1500,
      noiseOctaves: 3,
      dpr: [1, 1.6] as [number, number],
      msaa: 0,
    }
  : {
      burst: 700,
      aura: 150,
      motes: 150,
      stars: 4200,
      noiseOctaves: 5,
      dpr: [1, 2] as [number, number],
      msaa: 4,
    }
