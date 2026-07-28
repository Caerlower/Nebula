import { useLayoutEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { Nav } from './ui/Nav'
import { StorySection } from './ui/StorySection'
import { Marquee } from './ui/Marquee'
import { Features } from './ui/Features'
import { HowItWorks } from './ui/HowItWorks'
import { Stats } from './ui/Stats'
import { Protocol } from './ui/Protocol'
import { Security } from './ui/Security'
import { Docs } from './ui/Docs'
import { FinalCTA } from './ui/FinalCTA'
import { Footer } from './ui/Footer'
import { WaitlistProvider } from './ui/WaitlistContext'
import { ThemeProvider } from './ui/ThemeContext'
import { setLenis } from './lib/scroll'

gsap.registerPlugin(ScrollTrigger)

export default function App() {
  useLayoutEffect(() => {
    const onLoad = () => ScrollTrigger.refresh()
    let resizeTimer = 0
    const onResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => ScrollTrigger.refresh(), 180)
    }
    window.addEventListener('load', onLoad)
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      return () => {
        window.removeEventListener('load', onLoad)
        window.removeEventListener('resize', onResize)
        window.removeEventListener('orientationchange', onResize)
        window.clearTimeout(resizeTimer)
      }
    }

    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true })
    setLenis(lenis)
    lenis.on('scroll', () => ScrollTrigger.update())
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      window.removeEventListener('load', onLoad)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      window.clearTimeout(resizeTimer)
      gsap.ticker.remove(tick)
      setLenis(null)
      lenis.destroy()
    }
  }, [])

  return (
    <ThemeProvider>
      <WaitlistProvider>
        <a href="#capabilities" className="skip-link">
          Skip to content
        </a>
        <Nav />
        <main className="relative bg-bg text-text">
          <StorySection />
          <Marquee />
          <Features />
          <HowItWorks />
          <Stats />
          <Protocol />
          <Security />
          <Docs />
          <FinalCTA />
        </main>
        <Footer />
      </WaitlistProvider>
    </ThemeProvider>
  )
}
