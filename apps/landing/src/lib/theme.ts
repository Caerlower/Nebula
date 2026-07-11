import gsap from 'gsap'
import * as THREE from 'three'

export type ThemeMode = 'light' | 'dark'

export interface ThemeTokens {
  bg: string
  surface: string
  surfaceElevated: string
  border: string
  text: string
  textMuted: string
  textSubtle: string
  accent: string
  accent2: string
  accent3: string
  nebulaViolet: string
  nebulaBlue: string
  nebulaTeal: string
  nebulaHorizon: string
  wallDim: string
  wallEmissive: string
  stripLeft: string
  stripRight: string
  beamEmissiveLeft: string
  beamEmissiveRight: string
  rim: string
  key: string
  hemi: string
  hemiGround: string
  ambientIntensity: number
  hemiIntensity: number
  keyIntensity: number
  rimIntensity: number
  agentDim: string
  agentLit: string
  agentHeadLit: string
  agentEmissiveDim: string
  agentEmissiveLit: string
  agentEmissiveHeadLit: string
  coreDim: string
  coreLit: string
  coreWarm: string
  visorDim: string
  visorLit: string
  agentWarm: string
  agentAura: string
  agentPool: string
  agentSocket: string
  elderCloak: string
  elderCloakEmissive: string
  elderFace: string
  orb: string
  sceneBackground: string
  sceneFog: string
  ground: string
  orbWallet: string
  orbYield: string
  orbPulse: string
  orbStar: string
  orbSocket: string
  bloomIntensity: number
  bloomThreshold: number
  vignetteOffset: number
  vignetteDarkness: number
  selection: string
  focusRing: string
  bgAgent1: string
  bgAgent2: string
  bgAgent3: string
  bgAgentBody: string
  atmos1: string
  atmos2: string
  atmos3: string
  atmosBeam: string
  atmosFog: string
  burst1: string
  burst2: string
  burst3: string
  burst4: string
  burstCore: string
  navFade: string
  storyFadeTop: string
  storyFadeBottom: string
  ctaGlowA: string
  ctaGlowB: string
}

export const THEMES: Record<ThemeMode, ThemeTokens> = {
  light: {
    bg: '#0F1220',
    surface: '#171A2B',
    surfaceElevated: '#1F2338',
    border: 'rgba(255,255,255,0.08)',
    text: '#F1EEE8',
    textMuted: '#A8A2B8',
    textSubtle: '#7A738C',
    accent: '#F26B7A',
    accent2: '#4FB8A8',
    accent3: '#EBC178',
    nebulaViolet: '#C4849A',
    nebulaBlue: '#7A9BB8',
    nebulaTeal: '#5BA898',
    nebulaHorizon: '#E8A88C',
    wallDim: '#22263A',
    wallEmissive: '#2A2840',
    stripLeft: '#F26B7A',
    stripRight: '#4FB8A8',
    beamEmissiveLeft: '#3A2838',
    beamEmissiveRight: '#1E3634',
    rim: '#B8C4E8',
    key: '#FFE8D4',
    hemi: '#8A9AC8',
    hemiGround: '#1A1828',
    ambientIntensity: 0.52,
    hemiIntensity: 0.78,
    keyIntensity: 0.55,
    rimIntensity: 0.42,
    agentDim: '#4A5068',
    agentLit: '#D8D4EC',
    agentHeadLit: '#E8F6F2',
    agentEmissiveDim: '#2E3244',
    agentEmissiveLit: '#C87888',
    agentEmissiveHeadLit: '#4FB8A8',
    coreDim: '#524A68',
    coreLit: '#D09098',
    coreWarm: '#EBC178',
    visorDim: '#3A5858',
    visorLit: '#6EC8B8',
    agentWarm: '#EBC178',
    agentAura: '#E0A0A8',
    agentPool: '#F26B7A',
    agentSocket: '#12141E',
    elderCloak: '#1A1C2E',
    elderCloakEmissive: '#3A3048',
    elderFace: '#4FB8A8',
    orb: '#EBC178',
    sceneBackground: '#0F1220',
    sceneFog: '#0F1220',
    ground: '#141828',
    orbWallet: '#F26B7A',
    orbYield: '#4FB8A8',
    orbPulse: '#7A9BB8',
    orbStar: '#EBC178',
    orbSocket: '#141828',
    bloomIntensity: 0.55,
    bloomThreshold: 0.35,
    vignetteOffset: 0.28,
    vignetteDarkness: 0.48,
    selection: 'rgba(242, 107, 122, 0.45)',
    focusRing: 'rgba(242, 107, 122, 0.75)',
    bgAgent1: '#C4849A',
    bgAgent2: '#7A9BB8',
    bgAgent3: '#4FB8A8',
    bgAgentBody: '#2A2E42',
    atmos1: '#9A7898',
    atmos2: '#6A88B8',
    atmos3: '#4A9890',
    atmosBeam: '#6A88C8',
    atmosFog: '#9890C8',
    burst1: '#4FB8A8',
    burst2: '#F26B7A',
    burst3: '#7A9BB8',
    burst4: '#F1EEE8',
    burstCore: '#EBC178',
    navFade: 'rgba(15, 18, 32, 0.88)',
    storyFadeTop: 'rgba(15, 18, 32, 0.65)',
    storyFadeBottom: 'rgba(15, 18, 32, 0.75)',
    ctaGlowA: 'rgba(242, 107, 122, 0.28)',
    ctaGlowB: 'rgba(79, 184, 168, 0.14)',
  },
  dark: {
    bg: '#0A0912',
    surface: '#12101C',
    surfaceElevated: '#1A1726',
    border: 'rgba(255,255,255,0.07)',
    text: '#EEEAF4',
    textMuted: '#9A94AA',
    textSubtle: '#6E687E',
    accent: '#8E6BFF',
    accent2: '#3ECFC1',
    accent3: '#D4A855',
    nebulaViolet: '#8E6BFF',
    nebulaBlue: '#4A7BFF',
    nebulaTeal: '#3ECFC1',
    nebulaHorizon: '#6A5088',
    wallDim: '#161624',
    wallEmissive: '#1E1834',
    stripLeft: '#8E6BFF',
    stripRight: '#3ECFC1',
    beamEmissiveLeft: '#2A2048',
    beamEmissiveRight: '#163836',
    rim: '#6D7BFF',
    key: '#9FB0FF',
    hemi: '#4B4E8C',
    hemiGround: '#07070C',
    ambientIntensity: 0.3,
    hemiIntensity: 0.55,
    keyIntensity: 0.35,
    rimIntensity: 0.6,
    agentDim: '#333747',
    agentLit: '#B9B4F5',
    agentHeadLit: '#D9FBF4',
    agentEmissiveDim: '#1E2029',
    agentEmissiveLit: '#7C6CF0',
    agentEmissiveHeadLit: '#2DD4BF',
    coreDim: '#3E3860',
    coreLit: '#8F7CFF',
    coreWarm: '#FFC08A',
    visorDim: '#2A4C4C',
    visorLit: '#7EF5DF',
    agentWarm: '#FFB37A',
    agentAura: '#9F8FFF',
    agentPool: '#8E6BFF',
    agentSocket: '#0C0C14',
    elderCloak: '#12121F',
    elderCloakEmissive: '#241F3D',
    elderFace: '#3ECFC1',
    orb: '#FFB37A',
    sceneBackground: '#0A0912',
    sceneFog: '#0A0912',
    ground: '#0D0D17',
    orbWallet: '#8E6BFF',
    orbYield: '#3ECFC1',
    orbPulse: '#4A7BFF',
    orbStar: '#D4A855',
    orbSocket: '#10101C',
    bloomIntensity: 1.0,
    bloomThreshold: 0.18,
    vignetteOffset: 0.22,
    vignetteDarkness: 0.72,
    selection: 'rgba(142, 107, 255, 0.45)',
    focusRing: 'rgba(142, 107, 255, 0.8)',
    bgAgent1: '#8E6BFF',
    bgAgent2: '#4A7BFF',
    bgAgent3: '#3ECFC1',
    bgAgentBody: '#1A1A2E',
    atmos1: '#5F55C9',
    atmos2: '#4A6FE0',
    atmos3: '#3FB9AC',
    atmosBeam: '#4E7FE6',
    atmosFog: '#8C86D8',
    burst1: '#5EEAD4',
    burst2: '#8E6BFF',
    burst3: '#93C5FD',
    burst4: '#F3EFFF',
    burstCore: '#FFE7C9',
    navFade: 'rgba(10, 9, 18, 0.85)',
    storyFadeTop: 'rgba(10, 9, 18, 0.7)',
    storyFadeBottom: 'rgba(10, 9, 18, 0.8)',
    ctaGlowA: 'rgba(142, 107, 255, 0.32)',
    ctaGlowB: 'rgba(62, 207, 193, 0.16)',
  },
}

/** CSS custom properties synced from ThemeTokens (numeric values as unitless strings). */
export const CSS_THEME_KEYS: Array<{
  css: `--${string}`
  key: keyof ThemeTokens
}> = [
  { css: '--nebula-bg', key: 'bg' },
  { css: '--nebula-surface', key: 'surface' },
  { css: '--nebula-surface-elevated', key: 'surfaceElevated' },
  { css: '--nebula-border', key: 'border' },
  { css: '--nebula-text', key: 'text' },
  { css: '--nebula-text-muted', key: 'textMuted' },
  { css: '--nebula-text-subtle', key: 'textSubtle' },
  { css: '--nebula-accent', key: 'accent' },
  { css: '--nebula-accent-2', key: 'accent2' },
  { css: '--nebula-accent-3', key: 'accent3' },
  { css: '--nebula-selection', key: 'selection' },
  { css: '--nebula-focus-ring', key: 'focusRing' },
  { css: '--nebula-nav-fade', key: 'navFade' },
  { css: '--nebula-story-fade-top', key: 'storyFadeTop' },
  { css: '--nebula-story-fade-bottom', key: 'storyFadeBottom' },
  { css: '--nebula-cta-glow-a', key: 'ctaGlowA' },
  { css: '--nebula-cta-glow-b', key: 'ctaGlowB' },
]

export function themeToCssVars(theme: ThemeTokens): Record<string, string> {
  const out: Record<string, string> = {}
  for (const { css, key } of CSS_THEME_KEYS) {
    out[css] = String(theme[key])
  }
  return out
}

export function applyCssTheme(theme: ThemeTokens, mode: ThemeMode): void {
  const root = document.documentElement
  root.dataset.theme = mode
  const vars = themeToCssVars(theme)
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value)
  }
}

export function resolveInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function hexToColor(hex: string, target = new THREE.Color()): THREE.Color {
  return target.set(hex)
}

export function tweenThreeColor(
  color: THREE.Color,
  hex: string,
  duration = 0.6,
): gsap.core.Tween {
  const next = new THREE.Color(hex)
  return gsap.to(color, {
    r: next.r,
    g: next.g,
    b: next.b,
    duration,
    ease: 'power2.inOut',
  })
}

export interface SceneColors {
  nebulaViolet: THREE.Color
  nebulaBlue: THREE.Color
  nebulaTeal: THREE.Color
  nebulaHorizon: THREE.Color
  wallDim: THREE.Color
  wallEmissive: THREE.Color
  stripLeft: THREE.Color
  stripRight: THREE.Color
  beamEmissiveLeft: THREE.Color
  beamEmissiveRight: THREE.Color
  rim: THREE.Color
  key: THREE.Color
  hemi: THREE.Color
  hemiGround: THREE.Color
  agentDim: THREE.Color
  agentLit: THREE.Color
  agentHeadLit: THREE.Color
  agentEmissiveDim: THREE.Color
  agentEmissiveLit: THREE.Color
  agentEmissiveHeadLit: THREE.Color
  coreDim: THREE.Color
  coreLit: THREE.Color
  coreWarm: THREE.Color
  visorDim: THREE.Color
  visorLit: THREE.Color
  agentWarm: THREE.Color
  agentAura: THREE.Color
  agentPool: THREE.Color
  agentSocket: THREE.Color
  elderCloak: THREE.Color
  elderCloakEmissive: THREE.Color
  elderFace: THREE.Color
  orb: THREE.Color
  sceneBackground: THREE.Color
  sceneFog: THREE.Color
  ground: THREE.Color
  orbWallet: THREE.Color
  orbYield: THREE.Color
  orbPulse: THREE.Color
  orbStar: THREE.Color
  orbSocket: THREE.Color
  bgAgent1: THREE.Color
  bgAgent2: THREE.Color
  bgAgent3: THREE.Color
  bgAgentBody: THREE.Color
  atmos1: THREE.Color
  atmos2: THREE.Color
  atmos3: THREE.Color
  atmosBeam: THREE.Color
  atmosFog: THREE.Color
  burst1: THREE.Color
  burst2: THREE.Color
  burst3: THREE.Color
  burst4: THREE.Color
  burstCore: THREE.Color
}

export type ThemeColors = SceneColors

export function buildThreeColors(theme: ThemeTokens): SceneColors {
  const c = (hex: string) => new THREE.Color(hex)
  return {
    nebulaViolet: c(theme.nebulaViolet),
    nebulaBlue: c(theme.nebulaBlue),
    nebulaTeal: c(theme.nebulaTeal),
    nebulaHorizon: c(theme.nebulaHorizon),
    wallDim: c(theme.wallDim),
    wallEmissive: c(theme.wallEmissive),
    stripLeft: c(theme.stripLeft),
    stripRight: c(theme.stripRight),
    beamEmissiveLeft: c(theme.beamEmissiveLeft),
    beamEmissiveRight: c(theme.beamEmissiveRight),
    rim: c(theme.rim),
    key: c(theme.key),
    hemi: c(theme.hemi),
    hemiGround: c(theme.hemiGround),
    agentDim: c(theme.agentDim),
    agentLit: c(theme.agentLit),
    agentHeadLit: c(theme.agentHeadLit),
    agentEmissiveDim: c(theme.agentEmissiveDim),
    agentEmissiveLit: c(theme.agentEmissiveLit),
    agentEmissiveHeadLit: c(theme.agentEmissiveHeadLit),
    coreDim: c(theme.coreDim),
    coreLit: c(theme.coreLit),
    coreWarm: c(theme.coreWarm),
    visorDim: c(theme.visorDim),
    visorLit: c(theme.visorLit),
    agentWarm: c(theme.agentWarm),
    agentAura: c(theme.agentAura),
    agentPool: c(theme.agentPool),
    agentSocket: c(theme.agentSocket),
    elderCloak: c(theme.elderCloak),
    elderCloakEmissive: c(theme.elderCloakEmissive),
    elderFace: c(theme.elderFace),
    orb: c(theme.orb),
    sceneBackground: c(theme.sceneBackground),
    sceneFog: c(theme.sceneFog),
    ground: c(theme.ground),
    orbWallet: c(theme.orbWallet),
    orbYield: c(theme.orbYield),
    orbPulse: c(theme.orbPulse),
    orbStar: c(theme.orbStar),
    orbSocket: c(theme.orbSocket),
    bgAgent1: c(theme.bgAgent1),
    bgAgent2: c(theme.bgAgent2),
    bgAgent3: c(theme.bgAgent3),
    bgAgentBody: c(theme.bgAgentBody),
    atmos1: c(theme.atmos1),
    atmos2: c(theme.atmos2),
    atmos3: c(theme.atmos3),
    atmosBeam: c(theme.atmosBeam),
    atmosFog: c(theme.atmosFog),
    burst1: c(theme.burst1),
    burst2: c(theme.burst2),
    burst3: c(theme.burst3),
    burst4: c(theme.burst4),
    burstCore: c(theme.burstCore),
  }
}
