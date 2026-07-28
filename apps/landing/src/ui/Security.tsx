import { SECURITY } from '../lib/content'

export function Security() {
  return (
    <section
      id="security"
      className="relative border-t border-border px-8 py-[120px] pb-[130px]"
      style={{
        background:
          'radial-gradient(70% 60% at 88% 10%, rgba(143,191,159,.08) 0%, rgba(11,11,13,0) 60%), #0B0B0D',
      }}
    >
      <div className="mx-auto max-w-[1360px]">
        <div className="mb-16 flex flex-wrap items-end justify-between gap-14">
          <div>
            <div className="eyebrow mb-[26px]">
              <span className="eyebrow-rule" />
              Security
            </div>
            <h2 className="headline-lg m-0">
              Keys stay in
              <br />
              <span className="text-dim">the Hub.</span>
            </h2>
          </div>
          <div
            className="border bg-surface px-[26px] py-[22px]"
            style={{ borderColor: 'rgba(139,92,246,.28)' }}
          >
            <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-subtle">
              On-chain guarantee
            </div>
            <div className="mt-2.5 flex items-baseline gap-3">
              <span className="font-display text-[44px] font-semibold leading-none tracking-[-0.04em] text-text">
                0
              </span>
              <span className="font-mono text-[10px] uppercase leading-snug tracking-[0.12em] text-muted">
                private keys
                <br />
                in agent memory
              </span>
            </div>
          </div>
        </div>

        <div className="security-grid cell-grid grid-cols-2">
          {SECURITY.map((s) => (
            <div key={s.n} className="cell flex items-start gap-[22px] px-[34px] py-8 pb-[34px]">
              <div className="shrink-0 pt-[5px] font-mono text-[10px] tracking-[0.16em] text-accent">
                {s.n}
              </div>
              <div>
                <h3 className="font-display text-[19px] font-medium tracking-[-0.02em] text-text">
                  {s.title}
                </h3>
                <p className="mt-2.5 mb-0 text-[13.5px] leading-[1.66] text-muted text-pretty">
                  {s.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
