import { STEPS } from '../lib/content'

export function HowItWorks() {
  return (
    <section id="process" className="relative overflow-hidden border-t border-border bg-bg px-8 py-[120px] pb-[130px]">
      <div className="section-dots" aria-hidden />
      <div className="relative mx-auto max-w-[1360px]">
        <div className="mb-[70px]">
          <div className="eyebrow mb-[26px]">
            <span className="eyebrow-rule" />
            Process
          </div>
          <h2 className="headline-lg m-0">
            Connect. <span className="text-accent-3">Set policy.</span>{' '}
            <span className="text-dim">Spend.</span>
          </h2>
        </div>

        <div className="steps-grid grid grid-cols-4 gap-px border-t border-border bg-border">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="flex min-h-[240px] flex-col bg-bg px-7 py-[34px] pb-10"
            >
              <div className="font-mono text-[10.5px] tracking-[0.2em] text-accent">{s.n}</div>
              <h3 className="font-display mt-5 text-[21px] font-medium tracking-[-0.025em] text-text">
                {s.title}
              </h3>
              <p className="mt-3 mb-0 text-[13.5px] leading-[1.65] text-muted text-pretty">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
