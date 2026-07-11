import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { gsap } from 'gsap'
import * as THREE from 'three'
import {
  CSS_THEME_KEYS,
  THEMES,
  applyCssTheme,
  buildThreeColors,
  resolveInitialTheme,
  themeToCssVars,
  tweenThreeColor,
  type ThemeColors,
  type ThemeMode,
  type ThemeTokens,
} from '../lib/theme'
import { createThemeChannel, readThemeCookie, writeThemeCookie } from '../lib/theme-cookie'

type ThemeContextValue = {
  mode: ThemeMode
  theme: ThemeTokens
  colors: ThemeColors
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function tweenCssVars(from: ThemeTokens, to: ThemeTokens, duration: number): gsap.core.Timeline {
  const root = document.documentElement
  const fromVars = themeToCssVars(from)
  const toVars = themeToCssVars(to)
  const proxy: Record<string, string> = { ...fromVars }

  const tl = gsap.timeline({
    onUpdate: () => {
      for (const { css } of CSS_THEME_KEYS) {
        root.style.setProperty(css, proxy[css])
      }
    },
  })

  tl.to(proxy, {
    ...toVars,
    duration,
    ease: 'power2.inOut',
  })

  return tl
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => readThemeCookie() ?? resolveInitialTheme())
  const animating = useRef(false)
  const modeRef = useRef(mode)
  modeRef.current = mode
  const channelRef = useRef<BroadcastChannel | null>(null)

  const theme = THEMES[mode]
  const colors = useMemo(() => buildThreeColors(theme), [theme])

  useLayoutEffect(() => {
    applyCssTheme(THEMES[mode], mode)
  }, [])

  const applyMode = useCallback((next: ThemeMode, broadcast: boolean) => {
    if (next === modeRef.current || animating.current) return
    animating.current = true
    document.documentElement.dataset.theme = next
    writeThemeCookie(next)
    if (broadcast) channelRef.current?.postMessage(next)
    tweenCssVars(THEMES[modeRef.current], THEMES[next], 0.6)
    setMode(next)
    window.setTimeout(() => {
      animating.current = false
    }, 650)
  }, [])

  // Live sync with the dashboard: theme changes made there arrive over the
  // BroadcastChannel; bfcache restores re-check the shared cookie.
  useLayoutEffect(() => {
    const channel = createThemeChannel()
    channelRef.current = channel
    if (channel) {
      channel.onmessage = (event: MessageEvent) => {
        if (event.data === 'light' || event.data === 'dark') applyMode(event.data, false)
      }
    }
    const syncFromCookie = () => {
      const saved = readThemeCookie()
      if (saved) applyMode(saved, false)
    }
    window.addEventListener('pageshow', syncFromCookie)
    document.addEventListener('visibilitychange', syncFromCookie)
    return () => {
      channel?.close()
      channelRef.current = null
      window.removeEventListener('pageshow', syncFromCookie)
      document.removeEventListener('visibilitychange', syncFromCookie)
    }
  }, [applyMode])

  const toggleTheme = useCallback(() => {
    applyMode(modeRef.current === 'light' ? 'dark' : 'light', true)
  }, [applyMode])

  const value = useMemo(
    () => ({ mode, theme, colors, toggleTheme }),
    [mode, theme, colors, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

export function useThemeColors(): ThemeColors {
  return useTheme().colors
}

export { tweenThreeColor }

/** Subscribe to theme changes and run a GSAP tween callback when mode flips. */
export function useThemeTransition(
  effect: (next: ThemeTokens, colors: ThemeColors, mode: ThemeMode) => (() => void) | void,
  deps: unknown[] = [],
) {
  const { mode, theme, colors } = useTheme()
  const isFirst = useRef(true)

  useLayoutEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      return
    }
    return effect(theme, colors, mode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ...deps])
}

export function colorFromHex(hex: string): THREE.Color {
  return new THREE.Color(hex)
}
