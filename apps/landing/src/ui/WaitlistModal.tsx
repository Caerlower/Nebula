import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import { gsap } from 'gsap'
import { useWaitlist } from './WaitlistContext'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function WaitlistModal() {
  const { isOpen, close, submit } = useWaitlist()
  const backdrop = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useLayoutEffect(() => {
    if (!isOpen) return
    setDone(false)
    setEmail('')
    setError('')
    const tl = gsap.timeline()
    tl.fromTo(
      backdrop.current,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.25, ease: 'power2.out' },
    ).fromTo(
      panel.current,
      { autoAlpha: 0, scale: 0.92, y: 14, filter: 'blur(14px)' },
      { autoAlpha: 1, scale: 1, y: 0, filter: 'blur(0px)', duration: 0.4, ease: 'power3.out' },
      0.05,
    )
    const t = setTimeout(() => input.current?.focus(), 250)
    return () => {
      tl.kill()
      clearTimeout(t)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, close])

  if (!isOpen) return null

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    if (!EMAIL_RE.test(value)) {
      setError('Enter a valid email address.')
      return
    }
    submit(value)
    setDone(true)
  }

  return (
    <div
      ref={backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Join the waitlist"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-5 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div ref={panel} className="card-surface relative w-full max-w-md rounded-2xl p-8 sm:p-10">
        <button
          onClick={close}
          aria-label="Close"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-surface-elevated hover:text-text"
        >
          ✕
        </button>

        {done ? (
          <Success />
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <p className="eyebrow">Early access</p>
            <h3 className="font-display mt-3 text-3xl text-text">Join the waitlist</h3>
            <p className="mt-2 text-sm text-muted">
              Be first to give your agent a Stellar wallet.
            </p>
            <input
              ref={input}
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
              }}
              placeholder="you@yourdomain.com"
              aria-label="Email address"
              className="mt-6 w-full rounded-xl border border-border bg-surface-elevated px-4 py-3 text-text outline-none transition placeholder:text-subtle focus:border-accent focus:shadow-[0_0_0_3px_var(--nebula-selection)]"
            />
            {error && <p className="mt-2 text-xs text-accent">{error}</p>}
            <button type="submit" className="btn-primary mt-4 w-full rounded-xl px-5 py-3 font-medium">
              Request access
            </button>
            <p className="mt-3 text-center text-[11px] text-subtle">
              No spam. One email when your slot opens.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

function Success() {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <div className="relative">
        <svg className="block" viewBox="0 0 72 72" width="88" height="88" aria-hidden="true">
          <circle
            className="check-ring"
            cx="36"
            cy="36"
            r="30"
            fill="none"
            stroke="var(--nebula-accent)"
            strokeWidth="3"
          />
          <path
            className="check-mark"
            d="M23 37.5 32 46.5 50 27.5"
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="success-burst" aria-hidden="true">
          {Array.from({ length: 14 }).map((_, i) => (
            <span
              key={i}
              style={
                {
                  '--a': `${(360 / 14) * i}deg`,
                  animationDelay: `${0.15 + (i % 5) * 0.03}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </div>
      <h3 className="font-display mt-5 text-3xl text-text">You're on the list</h3>
      <p className="mt-2 text-sm text-muted">We'll reach out when your slot opens.</p>
    </div>
  )
}
