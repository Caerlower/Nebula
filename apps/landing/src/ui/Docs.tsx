import { DOCS } from '../lib/content'
import { DOCS_URL } from '../lib/links'

export function Docs() {
  return (
    <section id="code" className="relative overflow-hidden border-t border-border bg-bg px-8 py-[120px] pb-[130px]">
      <div className="section-dots-soft" aria-hidden />
      <div className="relative mx-auto max-w-[1360px]">
        <div className="mb-[60px] flex flex-wrap items-end justify-between gap-14">
          <div>
            <div className="eyebrow mb-[26px]">
              <span className="eyebrow-rule" />
              Documentation
            </div>
            <h2 className="headline-lg m-0">
              Read the docs.
              <br />
              <span className="text-dim">Wire it in an afternoon.</span>
            </h2>
          </div>
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="flex shrink-0 items-center gap-3 border border-line px-6 py-[13px] font-mono text-[11px] uppercase tracking-[0.16em] text-text transition hover:border-accent/70"
          >
            View the docs <span className="text-accent">&gt;</span>
          </a>
        </div>

        <div className="docs-grid cell-grid grid-cols-4">
          {DOCS.map((d) => (
            <a
              key={d.title}
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="cell block px-7 py-[30px] pb-[34px]"
            >
              <div className="font-display text-[18px] font-medium tracking-[-0.02em] text-text">
                {d.title}
              </div>
              <p className="mt-3 mb-0 text-[13px] leading-[1.65] text-muted text-pretty">{d.body}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
