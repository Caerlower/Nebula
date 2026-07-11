import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const el = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.current,
        { y: 36, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 1,
          delay,
          ease: 'power3.out',
          scrollTrigger: { trigger: el.current, start: 'top 84%', once: true },
        },
      )
    }, el)
    return () => ctx.revert()
  }, [delay])

  return (
    <div ref={el} className={className}>
      {children}
    </div>
  )
}
