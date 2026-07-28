import { useEffect, useRef } from 'react'
import { CHIPS, COUNTERS } from '../lib/content'
import { easeOutCubic } from '../lib/story'

export function Stats() {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const rootEl = root.current
    if (!rootEl) return

    const nodes = rootEl.querySelectorAll<HTMLElement>('[data-count]')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      nodes.forEach((el) => {
        const to = parseFloat(el.dataset.count ?? '')
        const dec = parseInt(el.dataset.dec ?? '0', 10)
        if (!Number.isFinite(to)) return
        el.textContent = to.toLocaleString('en-US', {
          minimumFractionDigits: dec,
          maximumFractionDigits: dec,
        })
      })
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          observer.unobserve(entry.target)
          const el = entry.target as HTMLElement
          const to = parseFloat(el.dataset.count ?? '')
          const dec = parseInt(el.dataset.dec ?? '0', 10)
          if (!Number.isFinite(to)) continue
          const t0 = performance.now()
          const dur = 1300
          const fmt = (v: number) =>
            v.toLocaleString('en-US', {
              minimumFractionDigits: dec,
              maximumFractionDigits: dec,
            })
          const step = (now: number) => {
            const k = Math.min(1, (now - t0) / dur)
            el.textContent = fmt(to * easeOutCubic(k))
            if (k < 1) requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        }
      },
      { threshold: 0.5 },
    )

    nodes.forEach((n) => observer.observe(n))
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={root}
      className="relative border-t border-border px-8 py-[130px]"
      style={{
        background:
          'radial-gradient(70% 90% at 50% 100%, rgba(139,92,246,.16) 0%, rgba(11,11,13,0) 60%), #0B0B0D',
      }}
    >
      <div className="mx-auto max-w-[1360px]">
        <div className="mb-20 text-center">
          <div className="mb-6 font-mono text-[10.5px] uppercase tracking-[0.2em] text-subtle">
            Enforced
          </div>
          <h2 className="headline-md m-0">
            Proven on <span className="text-accent">Stellar mainnet</span>.
          </h2>
        </div>

        <div className="counters-grid grid grid-cols-4 gap-px bg-border">
          {COUNTERS.map((m) => (
            <div key={m.label} className="bg-bg px-[26px] py-10 pb-9 text-left">
              <div className="flex items-baseline gap-0.5 whitespace-nowrap font-display text-[clamp(38px,4.4vw,64px)] font-medium leading-none tracking-[-0.04em] text-text">
                {m.pre ? <span className="text-subtle">{m.pre}</span> : null}
                <span data-count={m.to} data-dec={m.dec}>
                  {m.to}
                </span>
                {m.suf ? <span className="text-accent">{m.suf}</span> : null}
              </div>
              <div className="mt-5 font-mono text-[10px] uppercase leading-[1.6] tracking-[0.14em] text-muted">
                {m.label}
              </div>
              <div className="mt-2 font-mono text-[10px] tracking-[0.1em] text-subtle">{m.sub}</div>
            </div>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          {CHIPS.map((c) => (
            <div
              key={c}
              className="flex shrink-0 items-center gap-[9px] border border-border bg-surface px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted whitespace-nowrap"
            >
              <span
                className="block h-1 w-1 shrink-0 rounded-full"
                style={{
                  background: '#8FBF9F',
                  boxShadow: '0 0 9px 2px rgba(143,191,159,.6)',
                }}
              />
              {c}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
