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
    <header className="nav-bar">
      <a
        href="#top"
        className="font-display shrink-0 text-[19px] font-semibold tracking-[-0.03em] text-text"
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

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="nav-menu-btn"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
        <a
          href={HUB_LOGIN}
          className="btn-primary shrink-0 px-5 py-[9px] text-[12.5px] tracking-[0.01em]"
        >
          Sign in
        </a>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          className="nav-mobile"
          aria-label="Mobile"
        >
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
