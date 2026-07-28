import { HUB_LOGIN } from '../lib/links'
import { useWaitlist } from './WaitlistContext'

export function FinalCTA() {
  const { open } = useWaitlist()

  return (
    <section
      className="relative overflow-hidden border-t border-border px-8 py-[150px] pb-[160px] text-center"
      style={{
        background:
          'radial-gradient(60% 120% at 50% 130%, rgba(139,92,246,.24) 0%, rgba(11,11,13,0) 62%), #0B0B0D',
      }}
    >
      <div className="section-dots" aria-hidden />
      <div className="relative mx-auto max-w-[900px]">
        <h2 className="headline-xl m-0">
          Sign in.
          <br />
          <span className="text-accent">Wire your agent.</span>
        </h2>
        <p className="mx-auto mt-7 mb-0 max-w-[420px] text-[15.5px] leading-[1.65] text-muted text-pretty">
          Keys stay in the Hub. Limits stay on chain. Your agent gets to work.
        </p>
        <div className="mt-[42px] flex flex-wrap items-center justify-center gap-3">
          <a href={HUB_LOGIN} className="btn-primary px-8 py-3.5 text-sm">
            Sign in
          </a>
          <button
            type="button"
            onClick={open}
            className="btn-ghost btn-ghost-solid px-7 py-3.5 text-sm"
          >
            Get updates
          </button>
        </div>
      </div>
    </section>
  )
}
