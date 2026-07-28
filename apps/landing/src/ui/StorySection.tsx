import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Experience } from '../scene/Experience'
import { STORY } from '../lib/story'
import { HUB_LOGIN } from '../lib/links'

gsap.registerPlugin(ScrollTrigger)

const REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function StorySection() {
  const section = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const root = section.current
    if (!root) return

    if (REDUCED) {
      STORY.progress = 1
      root.querySelectorAll<HTMLElement>('[data-hint]').forEach((el) => {
        el.style.opacity = '0'
      })
      root.querySelectorAll<HTMLElement>('[data-beat]').forEach((el) => {
        el.style.opacity = '0'
      })
      const hero = root.querySelector<HTMLElement>('[data-hero]')
      const dim = root.querySelector<HTMLElement>('[data-hero-dim]')
      if (hero) {
        hero.style.opacity = '1'
        hero.style.pointerEvents = 'auto'
      }
      if (dim) dim.style.opacity = '1'
      return
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'power2.out' },
        scrollTrigger: {
          trigger: section.current,
          start: 'top top',
          end: '+=520%',
          scrub: true,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            STORY.progress = self.progress
          },
        },
      })

      const show = (sel: string, at: number, dur = 0.05) =>
        tl.fromTo(sel, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: dur }, at)
      const hide = (sel: string, at: number, dur = 0.04) =>
        tl.to(sel, { opacity: 0, y: -18, duration: dur }, at)

      // Opacity only on the hint shell so CSS float transform isn't overwritten.
      tl.to('[data-hint]', { opacity: 0, duration: 0.03 }, 0.025)
      show('[data-beat="1"]', 0.03)
      hide('[data-beat="1"]', 0.155)
      show('[data-beat="2"]', 0.24)
      hide('[data-beat="2"]', 0.36)
      tl.fromTo(
        '[data-beat="3"]',
        { opacity: 0, scale: 0.96, y: 8 },
        { opacity: 1, scale: 1, y: 0, duration: 0.04 },
        0.505,
      )
      hide('[data-beat="3"]', 0.585)
      show('[data-beat="4"]', 0.64)
      hide('[data-beat="4"]', 0.775)

      tl.fromTo('[data-hero-dim]', { opacity: 0 }, { opacity: 1, duration: 0.1 }, 0.855)
      tl.fromTo(
        '[data-hero]',
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, duration: 0.1 },
        0.865,
      )
      tl.to({}, { duration: 0.02 }, 0.98)
    }, section)
    return () => ctx.revert()
  }, [])

  return (
    <section id="top" ref={section} className="relative h-screen overflow-hidden">
      <div className="absolute inset-0" aria-hidden="true">
        <Experience />
      </div>

      <div className="story-fade-top pointer-events-none absolute inset-x-0 top-0 h-36" />
      <div className="story-fade-bottom pointer-events-none absolute inset-x-0 bottom-0 h-52" />
      <div
        data-hero-dim
        aria-hidden="true"
        className="hero-dim pointer-events-none absolute inset-0 opacity-0"
      />

      <div className="pointer-events-none absolute inset-0">
        <div
          data-hint
          className="absolute bottom-[4vh] left-1/2 -translate-x-1/2"
          aria-hidden="true"
        >
          <div className="hint-float flex flex-col items-center gap-2.5">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-subtle">
              Scroll
            </span>
            <span className="hint-line" />
          </div>
        </div>

        <div
          data-beat="1"
          className="absolute left-[7vw] top-[33vh] max-w-[760px] opacity-0"
          aria-hidden="true"
        >
          <div className="eyebrow mb-[26px]">
            <span className="eyebrow-rule" />
            The problem
          </div>
          <p className="story-display text-[clamp(38px,5.4vw,80px)]">
            Your agent can think.
            <br />
            <span className="text-dim">It cannot spend.</span>
          </p>
        </div>

        <div
          data-beat="2"
          className="absolute left-[7vw] top-[40vh] opacity-0"
          aria-hidden="true"
        >
          <p className="story-display text-[clamp(34px,4.4vw,64px)] leading-none">
            Then it is handed
            <br />
            <span className="text-accent">a treasury.</span>
          </p>
        </div>

        <div
          data-beat="3"
          className="absolute bottom-[10vh] left-1/2 -translate-x-1/2 px-6 text-center opacity-0"
          aria-hidden="true"
        >
          <p className="story-mono">Wallet issued · policy signed</p>
        </div>

        <div
          data-beat="4"
          className="absolute bottom-[15vh] left-[7vw] opacity-0"
          aria-hidden="true"
        >
          <p className="story-display text-[clamp(32px,4.2vw,62px)] leading-none">
            Policy. Yield.
            <br />
            <span className="text-dim">Machine payments.</span>
          </p>
        </div>

        <div
          data-hero
          className="absolute left-[6vw] top-1/2 max-w-[min(660px,88vw)] -translate-y-1/2 opacity-0 sm:max-w-[min(660px,52vw)]"
        >
          <div className="pointer-events-auto">
            <div className="mb-[30px] flex items-center gap-2.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted">
              <span className="live-dot" aria-hidden="true" />
              Live on Stellar mainnet
            </div>
            <h1 className="headline-xl text-text">
              Give your agent
              <br />
              <span className="text-dim">a treasury.</span>
            </h1>
            <p className="mt-[30px] max-w-[440px] text-[16.5px] leading-[1.6] text-muted text-pretty">
              One MCP. On-chain spend limits. Yield when idle — payments when it works.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href={HUB_LOGIN} className="btn-primary px-7 py-[13px] text-sm">
                Sign in
              </a>
              <a href="#process" className="btn-ghost px-[26px] py-[13px] text-sm">
                How it works
              </a>
            </div>

            <div className="hero-stat-grid max-w-lg">
              <div className="py-[18px] pr-5">
                <div className="font-display text-[22px] font-medium tracking-[-0.02em]">1 MCP</div>
                <div className="mono-label mt-2">one endpoint</div>
              </div>
              <div className="px-5 py-[18px]">
                <div className="font-display text-[22px] font-medium tracking-[-0.02em] text-accent">
                  On-chain
                </div>
                <div className="mono-label mt-2">soroban policy</div>
              </div>
              <div className="py-[18px] pl-5">
                <div className="font-display text-[22px] font-medium tracking-[-0.02em]">0 keys</div>
                <div className="mono-label mt-2">held by the agent</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
