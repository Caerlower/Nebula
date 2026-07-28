import { useId, useState, type FormEvent } from 'react'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function submitEmail(email: string) {
  void fetch('/api/waitlist', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, source: 'landing' }),
  }).catch(() => {})
}

export function FinalCTA() {
  const errorId = useId()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    if (!EMAIL_RE.test(value)) {
      setError('Enter a valid email address.')
      return
    }
    submitEmail(value)
    setDone(true)
  }

  return (
    <section
      id="signup"
      className="relative overflow-hidden border-t border-border px-8 py-[150px] pb-[160px] text-center"
      style={{
        background:
          'radial-gradient(60% 120% at 50% 130%, rgba(139,92,246,.24) 0%, rgba(11,11,13,0) 62%), #0B0B0D',
      }}
    >
      <div className="section-dots" aria-hidden />
      <div className="relative mx-auto max-w-[900px]">
        <h2 className="headline-xl m-0">
          Sign up.
          <br />
          <span className="text-accent">Wire your agent.</span>
        </h2>
        <p className="mx-auto mt-7 mb-0 max-w-[400px] text-[15.5px] leading-[1.65] text-muted text-pretty">
          Keys in the Hub. Limits on chain. Your agent gets to work.
        </p>

        {done ? (
          <div className="mx-auto mt-[42px] max-w-[440px] border border-border bg-surface px-6 py-5">
            <p className="m-0 font-display text-xl tracking-[-0.02em] text-text">
              You&apos;re on the list.
            </p>
            <p className="mt-2 mb-0 text-sm text-muted">
              We&apos;ll email when there&apos;s something worth opening.
            </p>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            noValidate
            className="mx-auto mt-[42px] flex w-full max-w-[480px] flex-col gap-3 sm:flex-row sm:items-stretch"
          >
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Email</span>
              <span
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle"
                aria-hidden
              >
                <MailIcon />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError('')
                }}
                placeholder="you@company.com"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className="w-full border border-border bg-surface py-[14px] pl-11 pr-4 font-mono text-[13px] text-text outline-none transition placeholder:text-subtle focus:border-accent/65"
              />
            </label>
            <button
              type="submit"
              className="btn-primary shrink-0 px-7 py-[14px] text-sm sm:min-w-[132px]"
            >
              Sign up
            </button>
          </form>
        )}
        {error ? (
          <p id={errorId} className="mt-3 mb-0 text-sm text-accent" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  )
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m5 7 7 5.5L19 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
