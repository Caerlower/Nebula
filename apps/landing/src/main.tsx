import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyCssTheme } from './lib/theme'
import './index.css'
import App from './App'

applyCssTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
