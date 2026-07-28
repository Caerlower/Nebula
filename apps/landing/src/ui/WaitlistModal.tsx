import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { gsap } from 'gsap'
import { useWaitlist } from './WaitlistContext'
import { HUB_SIGNUP } from '../lib/links'
import { startLenis, stopLenis } from '../lib/scroll'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function WaitlistModal() {
  const { isOpen, close, submit } = useWaitlist()
  const backdrop = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const errorId = useId()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useLayoutEffect(() => {
    if (!isOpen) return
    setDone(false)
    setEmail('')
    setError('')
    previouslyFocused.current = document.activeElement as HTMLElement | null
    stopLenis()

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      if (backdrop.current) backdrop.current.style.opacity = '1'
      if (panel.current) panel.current.style.opacity = '1'
    } else {
      const tl = gsap.timeline()
      tl.fromTo(
        backdrop.current,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.25, ease: 'power2.out' },
      ).fromTo(
        panel.current,
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power3.out' },
        0.05,
      )
      return () => {
        tl.kill()
        startLenis()
      }
    }

    return () => {
      startLenis()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const t = window.setTimeout(() => input.current?.focus(), 50)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
        return
      }
      if (e.key !== 'Tab' || !panel.current) return
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previouslyFocused.current?.focus?.()
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
      aria-labelledby={titleId}
      className="fixed inset-0 z-[90] flex items-center justify-center px-6"
      style={{ background: 'rgba(9,9,11,.8)', backdropFilter: 'blur(10px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        ref={panel}
        className="w-full max-w-[430px] border bg-surface px-[34px] py-9 pb-[30px]"
        style={{ borderColor: 'rgba(139,92,246,.28)' }}
      >
        {done ? (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">
              Updates
            </div>
            <div id={titleId} className="font-display mt-4 text-[28px] font-medium tracking-[-0.03em]">
              You&apos;re on the list.
            </div>
            <p className="mt-3 mb-0 text-[13.5px] leading-[1.6] text-muted">
              We&apos;ll email when there&apos;s something worth opening.
            </p>
            <button
              type="button"
              onClick={close}
              className="mt-6 w-full bg-accent py-[13px] text-sm font-medium text-bg transition hover:bg-[#9E75FF]"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">
              Updates
            </div>
            <div id={titleId} className="font-display mt-4 text-[28px] font-medium tracking-[-0.03em]">
              Product notes, not noise.
            </div>
            <p className="mt-3 mb-6 text-[13.5px] leading-[1.6] text-muted">
              New policy primitives, MCP changes, and release notes. Occasional — never spam.
            </p>
            <div className="flex flex-col gap-2.5">
              <input
                ref={input}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError('')
                }}
                placeholder="you@company.com"
                aria-label="Email address"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className="border border-line bg-bg px-[15px] py-[13px] font-mono text-[12.5px] text-text outline-none transition placeholder:text-subtle focus:border-accent/65"
              />
              {error ? (
                <p id={errorId} className="m-0 text-xs text-accent" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                className="border-none bg-accent py-[13px] text-sm font-medium text-bg transition hover:bg-[#9E75FF]"
              >
                Join the list
              </button>
              <button
                type="button"
                onClick={close}
                className="border-none bg-transparent py-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle transition hover:text-muted"
              >
                Not now
              </button>
            </div>
            <p className="mt-4 mb-0 text-center font-mono text-[10px] tracking-[0.08em] text-subtle">
              Or{' '}
              <a href={HUB_SIGNUP} className="text-muted underline underline-offset-2 hover:text-text">
                open the Hub
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
