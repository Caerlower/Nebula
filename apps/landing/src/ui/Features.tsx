import { Reveal } from './Reveal'

const FEATURES = [
  {
    title: 'On-chain spending policy',
    body: 'Limits live in a Soroban contract, not a config file. The chain enforces them.',
    wide: true,
  },
  {
    title: 'Automated treasury',
    body: 'Idle funds auto-earn on Blend pools and return the moment your agent needs them.',
  },
  {
    title: 'x402 & MPP payments',
    body: 'Native machine-to-machine payments — per-call, per-resource, streaming.',
  },
  {
    title: 'Stellar8004 reputation',
    body: 'Every action builds a verifiable on-chain track record other agents can trust.',
  },
  {
    title: 'Works with any MCP agent',
    body: 'Claude, custom frameworks, your own stack. If it speaks MCP, it gets a wallet.',
  },
]

export function Features() {
  const [hero, ...rest] = FEATURES

  return (
    <section className="relative mx-auto max-w-6xl px-6 py-24 sm:py-32">
      <Reveal>
        <p className="section-eyebrow">
          <span className="section-eyebrow-dot">•</span>
          Capabilities
        </p>
        <h2 className="mt-4 max-w-xl text-left text-4xl font-semibold tracking-tight text-text sm:text-5xl">
          Everything the powered agent has.
        </h2>
      </Reveal>

      <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Reveal className="md:col-span-2 lg:col-span-2">
          <article className="feature-card feature-card-wide card-surface h-full rounded-2xl p-8">
            <h3 className="text-xl font-medium text-text">{hero.title}</h3>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">{hero.body}</p>
          </article>
        </Reveal>

        {rest.map((f, i) => (
          <Reveal key={f.title} delay={(i + 1) * 0.08}>
            <article className="feature-card card-surface h-full rounded-2xl p-7">
              <h3 className="text-lg font-medium text-text">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{f.body}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
