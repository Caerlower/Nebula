import { TICKER } from '../lib/content'

export function Marquee() {
  const items = [...TICKER, ...TICKER]

  return (
    <div className="overflow-hidden border-y border-border bg-bg py-[13px]">
      <div className="marquee-track" aria-hidden="true">
        {items.map((item, i) => (
          <div
            key={`${item}-${i}`}
            className="flex shrink-0 items-center gap-[26px] pr-[26px] font-mono text-[10.5px] uppercase tracking-[0.2em] text-subtle whitespace-nowrap"
          >
            <span className="block h-1 w-1 shrink-0 rounded-full bg-accent" />
            {item}
          </div>
        ))}
      </div>
      <span className="sr-only">{TICKER.join(', ')}</span>
    </div>
  )
}
