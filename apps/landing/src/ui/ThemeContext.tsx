import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import {
  THEMES,
  applyCssTheme,
  buildThreeColors,
  tweenThreeColor,
  type ThemeColors,
  type ThemeMode,
  type ThemeTokens,
} from '../lib/theme'

type ThemeContextValue = {
  mode: ThemeMode
  theme: ThemeTokens
  colors: ThemeColors
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/** Landing stays on the purple cinematic palette — no theme toggle. */
const LANDING_MODE: ThemeMode = 'dark'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = THEMES[LANDING_MODE]
  const colors = useMemo(() => buildThreeColors(theme), [theme])

  useLayoutEffect(() => {
    applyCssTheme(theme, LANDING_MODE)
  }, [theme])

  const value = useMemo(
    () => ({ mode: LANDING_MODE, theme, colors }),
    [theme, colors],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

/** No-op on landing (single palette) — keeps scene hooks compiling. */
export function useThemeTransition(
  _effect: (
    next: ThemeTokens,
    colors: ThemeColors,
    mode: ThemeMode,
  ) => (() => void) | void,
  _deps: unknown[] = [],
) {
  // Landing does not switch themes.
}

export function colorFromHex(hex: string): THREE.Color {
  return new THREE.Color(hex)
}

export { tweenThreeColor }
