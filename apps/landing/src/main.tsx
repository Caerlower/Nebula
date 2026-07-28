import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyCssTheme, THEMES } from './lib/theme'
import './index.css'
import App from './App'

/** Landing is locked to the cinematic dark palette — avoid a light flash. */
applyCssTheme(THEMES.dark, 'dark')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
