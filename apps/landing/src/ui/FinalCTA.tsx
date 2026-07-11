import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Reveal } from './Reveal'
import { useWaitlist } from './WaitlistContext'

gsap.registerPlugin(ScrollTrigger)

export function FinalCTA() {
  const section = useRef<HTMLElement>(null)
  const glow = useRef<HTMLDivElement>(null)
  const { open } = useWaitlist()

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        glow.current,
        { opacity: 0.15, scale: 0.7 },
        {
          opacity: 0.85,
          scale: 1.2,
          ease: 'none',
          scrollTrigger: {
            trigger: section.current,
            start: 'top 85%',
            end: 'bottom bottom',
            scrub: true,
          },
        },
      )
    }, section)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={section} className="relative overflow-hidden px-6 py-36 sm:py-44">
      <div ref={glow} aria-hidden="true" className="cta-glow" />
      <Reveal className="relative mx-auto max-w-2xl text-left sm:text-center">
        <h2 className="font-display text-balance text-4xl leading-[1.08] text-text sm:text-6xl">
          The agent economy runs on Stellar.
        </h2>
        <button
          onClick={open}
          className="btn-primary mt-10 rounded-full px-9 py-4 text-sm font-medium sm:text-base"
        >
          Join the waitlist
        </button>
      </Reveal>
    </section>
  )
}
