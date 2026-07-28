import { CAPS } from '../lib/content'

export function Features() {
  return (
    <section
      id="capabilities"
      className="relative overflow-hidden px-8 py-[120px] pb-[130px]"
      style={{
        background:
          'radial-gradient(80% 70% at 10% 0%, rgba(139,92,246,.11) 0%, rgba(11,11,13,0) 58%), #0B0B0D',
      }}
    >
      <div className="relative mx-auto max-w-[1360px]">
        <div className="mb-[70px] flex flex-wrap items-end justify-between gap-14">
          <div>
            <div className="eyebrow mb-[26px]">
              <span className="eyebrow-rule" />
              What Nebula does
            </div>
            <h2 className="headline-lg m-0">
              Spending power,
              <br />
              <span className="text-dim">with a hard ceiling.</span>
            </h2>
          </div>
          <p className="m-0 max-w-[300px] text-[14.5px] leading-[1.66] text-muted text-pretty">
            Your agent pays on its own. You keep a limit it cannot raise.
          </p>
        </div>

        <div className="caps-grid cell-grid grid-cols-2">
          {CAPS.map((c) => (
            <div
              key={c.n}
              className="cell flex min-h-[300px] flex-col px-[38px] py-10 pb-[34px]"
            >
              <div className="font-mono text-[10.5px] tracking-[0.2em] text-accent">{c.n}</div>
              <h3 className="font-display mt-[22px] m-0 text-[27px] font-medium tracking-[-0.028em] text-text">
                {c.title}
              </h3>
              <p className="mt-3.5 mb-0 max-w-[440px] text-sm leading-[1.68] text-muted text-pretty">
                {c.body}
              </p>
              <div className="mt-auto flex flex-wrap items-baseline gap-3.5 border-t border-border pt-[34px]">
                <div className="font-display shrink-0 text-[26px] font-medium tracking-[-0.03em] whitespace-nowrap text-text">
                  {c.stat}
                </div>
                <div className="mono-label">{c.statLabel}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
