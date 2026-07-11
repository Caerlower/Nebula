import { useLayoutEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { Nav } from './ui/Nav'
import { StorySection } from './ui/StorySection'
import { HowItWorks } from './ui/HowItWorks'
import { Features } from './ui/Features'
import { FinalCTA } from './ui/FinalCTA'
import { Footer } from './ui/Footer'
import { WaitlistProvider } from './ui/WaitlistContext'
import { WaitlistModal } from './ui/WaitlistModal'
import { ThemeProvider } from './ui/ThemeContext'

gsap.registerPlugin(ScrollTrigger)

export default function App() {
  useLayoutEffect(() => {
    const onLoad = () => ScrollTrigger.refresh()
    window.addEventListener('load', onLoad)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      return () => window.removeEventListener('load', onLoad)
    }

    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true })
    lenis.on('scroll', () => ScrollTrigger.update())
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      window.removeEventListener('load', onLoad)
      gsap.ticker.remove(tick)
      lenis.destroy()
    }
  }, [])

  return (
    <ThemeProvider>
      <WaitlistProvider>
        <main className="relative bg-bg text-text">
          <Nav />
          <StorySection />
          <HowItWorks />
          <Features />
          <FinalCTA />
          <Footer />
          <WaitlistModal />
        </main>
      </WaitlistProvider>
    </ThemeProvider>
  )
}
