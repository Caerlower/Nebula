import { useState } from 'react'
import { DOCS_URL, HUB_LOGIN } from '../lib/links'

const LINKS = [
  { href: '#capabilities', label: 'Capabilities' },
  { href: '#process', label: 'Process' },
  { href: '#stack', label: 'Stack' },
  { href: '#security', label: 'Security' },
  { href: DOCS_URL, label: 'Docs', external: true },
] as const

export function Nav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="nav-shell">
      <div className={`nav-pill${open ? ' is-open' : ''}`}>
        <a
          href="#top"
          className="nav-brand"
          onClick={() => setOpen(false)}
        >
          Nebula
        </a>

        <nav className="nav-links" aria-label="Primary">
          {LINKS.map((l) =>
            'external' in l && l.external ? (
              <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
                {l.label}
                <span className="sr-only"> (opens in new tab)</span>
              </a>
            ) : (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ),
          )}
        </nav>

        <div className="nav-actions">
          <button
            type="button"
            className="nav-menu-btn"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
            <span className={`nav-burger${open ? ' is-open' : ''}`} aria-hidden />
          </button>
          <a href={HUB_LOGIN} className="nav-cta">
            Sign in
          </a>
        </div>
      </div>

      {open ? (
        <nav id="mobile-nav" className="nav-mobile" aria-label="Mobile">
          {LINKS.map((l) =>
            'external' in l && l.external ? (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </a>
            ) : (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ),
          )}
        </nav>
      ) : null}
    </header>
  )
}
