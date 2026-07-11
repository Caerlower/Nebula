import { Reveal } from './Reveal'

const STEPS = [
  {
    n: '01',
    title: 'Plug in',
    body: 'Connect Nebula to Claude or any agent framework in seconds. One MCP, full Stellar access.',
  },
  {
    n: '02',
    title: 'Set your policy',
    body: "Spending limits enforced on-chain. Your agent can't exceed them — not won't. Can't.",
  },
  {
    n: '03',
    title: 'Let it work',
    body: 'It pays with x402 & MPP, routes idle funds into yield on Blend, and builds reputation as it goes.',
  },
]

export function HowItWorks() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-28 sm:py-36">
      <Reveal>
        <p className="section-eyebrow">
          <span className="section-eyebrow-dot">•</span>
          How it works
        </p>
        <h2 className="mt-4 max-w-xl text-left text-4xl font-semibold tracking-tight text-text sm:text-5xl">
          Three steps to an agent that acts.
        </h2>
      </Reveal>
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.12}>
            <article className="card-surface h-full rounded-2xl p-7">
              <span className="text-xs tracking-[0.3em] text-subtle">{s.n}</span>
              <h3 className="mt-4 text-xl font-medium text-text">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{s.body}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
