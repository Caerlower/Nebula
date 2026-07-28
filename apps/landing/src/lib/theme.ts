/** Landing cinematic palette (single locked theme). */

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
  storyFadeTop: string
  storyFadeBottom: string
}

export const THEME: ThemeTokens = {
  bg: '#0B0B0D',
  surface: '#121216',
  surfaceElevated: '#16161A',
  border: '#202027',
  text: '#F6F7F8',
  textMuted: '#94949E',
  textSubtle: '#8A8A94',
  accent: '#8B5CF6',
  accent2: '#8FBF9F',
  accent3: '#D6D2C4',
  nebulaViolet: '#8B5CF6',
  nebulaBlue: '#4A7BFF',
  nebulaTeal: '#3ECFC1',
  nebulaHorizon: '#6A5088',
  wallDim: '#161624',
  wallEmissive: '#1E1834',
  stripLeft: '#8B5CF6',
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
  agentPool: '#8B5CF6',
  agentSocket: '#0C0C14',
  elderCloak: '#12121F',
  elderCloakEmissive: '#241F3D',
  elderFace: '#3ECFC1',
  orb: '#FFB37A',
  sceneBackground: '#0B0B0D',
  sceneFog: '#0B0B0D',
  ground: '#0D0D17',
  orbWallet: '#8B5CF6',
  orbYield: '#3ECFC1',
  orbPulse: '#4A7BFF',
  orbStar: '#D4A855',
  orbSocket: '#10101C',
  bloomIntensity: 1.0,
  bloomThreshold: 0.18,
  vignetteOffset: 0.22,
  vignetteDarkness: 0.72,
  selection: 'rgba(139, 92, 246, 0.35)',
  focusRing: 'rgba(139, 92, 246, 0.65)',
  bgAgent1: '#8B5CF6',
  bgAgent2: '#4A7BFF',
  bgAgent3: '#3ECFC1',
  bgAgentBody: '#1A1A2E',
  atmos1: '#5F55C9',
  atmos2: '#4A6FE0',
  atmos3: '#3FB9AC',
  atmosBeam: '#4E7FE6',
  atmosFog: '#8C86D8',
  burst1: '#5EEAD4',
  burst2: '#8B5CF6',
  burst3: '#93C5FD',
  burst4: '#F3EFFF',
  burstCore: '#FFE7C9',
  storyFadeTop: 'rgba(11, 11, 13, 0.7)',
  storyFadeBottom: 'rgba(11, 11, 13, 0.8)',
}

const CSS_KEYS: Array<{ css: `--${string}`; key: keyof ThemeTokens }> = [
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
  { css: '--nebula-story-fade-top', key: 'storyFadeTop' },
  { css: '--nebula-story-fade-bottom', key: 'storyFadeBottom' },
]

export function applyCssTheme(theme: ThemeTokens = THEME): void {
  const root = document.documentElement
  root.dataset.theme = 'dark'
  for (const { css, key } of CSS_KEYS) {
    root.style.setProperty(css, String(theme[key]))
  }
}
