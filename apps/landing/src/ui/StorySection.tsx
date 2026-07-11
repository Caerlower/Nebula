import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Experience } from '../scene/Experience'
import { STORY } from '../lib/story'
import { useWaitlist } from './WaitlistContext'

gsap.registerPlugin(ScrollTrigger)

export function StorySection() {
  const section = useRef<HTMLElement>(null)
  const { open } = useWaitlist()

  useLayoutEffect(() => {
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
        tl.fromTo(sel, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: dur }, at)
      const hide = (sel: string, at: number, dur = 0.04) =>
        tl.to(sel, { autoAlpha: 0, y: -22, duration: dur }, at)

      hide('[data-hint]', 0.025, 0.03)

      show('[data-beat="1"]', 0.03)
      hide('[data-beat="1"]', 0.155)

      show('[data-beat="2"]', 0.24)
      hide('[data-beat="2"]', 0.36)

      tl.fromTo(
        '[data-beat="3"]',
        { autoAlpha: 0, scale: 0.9, y: 10 },
        { autoAlpha: 1, scale: 1, y: 0, duration: 0.04 },
        0.505,
      )
      hide('[data-beat="3"]', 0.585)

      show('[data-beat="4"]', 0.64)
      hide('[data-beat="4"]', 0.775)

      // At the final beat the scene recedes a touch so the copy lands —
      // full-bleed dim, no visible panel edges.
      tl.fromTo(
        '[data-hero-dim]',
        { autoAlpha: 0 },
        { autoAlpha: 0.42, duration: 0.1 },
        0.865,
      )
      tl.fromTo(
        '[data-hero]',
        { autoAlpha: 0, y: 44, scale: 0.985 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.1 },
        0.865,
      )

      tl.to({}, { duration: 0.02 }, 0.98)
    }, section)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={section} className="relative h-screen overflow-hidden">
      <div className="absolute inset-0">
        <Experience />
      </div>

      <div className="story-fade-top pointer-events-none absolute inset-x-0 top-0 h-36" />
      <div className="story-fade-bottom pointer-events-none absolute inset-x-0 bottom-0 h-44" />
      <div
        data-hero-dim
        aria-hidden="true"
        className="invisible pointer-events-none absolute inset-0"
        style={{ background: 'var(--nebula-bg)' }}
      />

      <div className="pointer-events-none absolute inset-0">
        <div
          data-hint
          className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-2 text-muted"
        >
          <span className="text-[11px] uppercase tracking-[0.35em]">Scroll</span>
          <span className="hint-line" />
        </div>

        <div data-beat="1" className="story-text invisible bottom-[16%]">
          <p className="story-line">Your AI agent can think. Plan. Reason.</p>
          <p className="story-accent mt-2">But it can't act.</p>
        </div>

        <div data-beat="2" className="story-text invisible bottom-[18%]">
          <p className="story-accent">Then something changes.</p>
        </div>

        <div data-beat="3" className="story-text invisible top-1/2 -translate-y-1/2">
          <p className="story-accent text-glow-strong">Nebula gives it a wallet.</p>
        </div>

        <div data-beat="4" className="story-text invisible bottom-[15%]">
          <p className="story-line">Payments. Automated yield. On-chain reputation.</p>
          <p className="story-accent mt-2">All on Stellar.</p>
        </div>

        <div
          data-hero
          className="invisible absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center"
        >
          <div className="hero-copy pointer-events-auto mx-auto max-w-3xl">
            <p className="eyebrow">Nebula · MCP on Stellar</p>
            <h1 className="font-display mt-5 text-balance text-5xl leading-[1.05] text-text sm:text-6xl md:text-7xl">
              Give your AI agent powers on Stellar.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-sm leading-relaxed text-muted sm:text-base">
              Nebula is an MCP that gives any AI agent a Stellar wallet — with automated
              yield, x402 &amp; MPP payments, and on-chain reputation. Set your limits.
              Let it work.
            </p>
            <button
              onClick={open}
              className="btn-primary mt-9 rounded-full px-8 py-3.5 text-sm font-medium sm:text-base"
            >
              Join the waitlist
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
