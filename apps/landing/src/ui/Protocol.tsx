import { STACK } from '../lib/content'

export function Protocol() {
  return (
    <section id="stack" className="relative border-t border-border bg-bg px-8 py-[120px] pb-[130px]">
      <div className="mx-auto max-w-[1360px]">
        <div className="mb-16 grid items-end gap-[60px] md:grid-cols-[minmax(300px,1fr)_minmax(280px,0.7fr)]">
          <div>
            <div className="eyebrow mb-[26px]">
              <span className="eyebrow-rule" />
              Protocol stack
            </div>
            <h2 className="headline-lg m-0">
              Built on
              <br />
              <span className="text-dim">Stellar.</span>
            </h2>
          </div>
          <p className="m-0 text-[14.5px] leading-[1.66] text-muted text-pretty">
            USDC moves through Soroban policy and Blend pools. Agents call it through one MCP
            surface and settle over x402 or MPP.
          </p>
        </div>

        <div className="stack-grid cell-grid grid-cols-3">
          {STACK.map((s) => (
            <div key={s.name} className="cell flex flex-col gap-5 px-[30px] py-[30px] pb-[34px]">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-subtle">
                {s.role}
              </div>
              <div>
                <h3 className="font-display text-[22px] font-medium leading-[1.2] tracking-[-0.028em] text-text">
                  {s.name}
                </h3>
                <div className="mt-2.5 min-h-[3em] text-[12.5px] leading-[1.5] text-muted">
                  {s.note}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
