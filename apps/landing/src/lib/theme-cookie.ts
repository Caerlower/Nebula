import type { ThemeMode } from './theme'

/**
 * Theme is shared with the dashboard app (same origin) through this cookie,
 * so crossing between landing and app keeps the same look.
 */
export const THEME_COOKIE = 'nebula_theme'

export function readThemeCookie(): ThemeMode | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|; )nebula_theme=(dark|light)/)
  return match ? (match[1] as ThemeMode) : null
}

export function writeThemeCookie(mode: ThemeMode): void {
  document.cookie = `${THEME_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`
}

/** Live cross-surface sync — both landing and dashboard listen on this channel. */
export const THEME_CHANNEL = 'nebula_theme'

export function createThemeChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  return new BroadcastChannel(THEME_CHANNEL)
}
