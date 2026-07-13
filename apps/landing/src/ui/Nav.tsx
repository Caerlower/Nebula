import { useWaitlist } from './WaitlistContext'
import { useTheme } from './ThemeContext'

function ThemeToggle() {
  const { mode, toggleTheme } = useTheme()
  const isDark = mode === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="btn-icon"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.75" />
          <path
            d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M21 14.5A7.5 7.5 0 0 1 9.5 3 6.5 6.5 0 1 0 21 14.5Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  )
}

export function Nav() {
  const { open } = useWaitlist()
  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <a href="#" className="text-sm font-semibold tracking-[0.42em] text-text">
          NEBULA
        </a>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href="https://docs.nebulaonchain.xyz"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost rounded-full px-4 py-2 text-xs font-medium tracking-wide"
          >
            Docs
          </a>
          <a
            href="/login"
            className="btn-ghost rounded-full px-4 py-2 text-xs font-medium tracking-wide"
          >
            Sign in
          </a>
          <button
            onClick={open}
            className="btn-ghost rounded-full px-4 py-2 text-xs font-medium tracking-wide"
          >
            Join the waitlist
          </button>
        </div>
      </div>
      <div className="nav-fade pointer-events-none absolute inset-x-0 top-0 -z-10 h-24" />
    </header>
  )
}
