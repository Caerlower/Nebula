import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react'
import { THEME, applyCssTheme, type ThemeTokens } from '../lib/theme'

const ThemeContext = createContext<ThemeTokens>(THEME)

export function ThemeProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    applyCssTheme(THEME)
  }, [])

  return <ThemeContext.Provider value={THEME}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return { theme: useContext(ThemeContext) }
}
