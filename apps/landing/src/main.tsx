import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyCssTheme, resolveInitialTheme, THEMES } from './lib/theme'
import './index.css'
import App from './App'

const initialMode = resolveInitialTheme()
applyCssTheme(THEMES[initialMode], initialMode)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
